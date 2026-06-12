-- Phase 16: Business Workflow Order Correction
-- Target flow:
-- TEKNISI request -> LEADER approve -> KOORDINATOR approve/sign -> SUPERVISOR approve/sign -> ADMIN process SJ/BAST + qty/SN -> TEKNISI receive.
-- This patch reuses existing status values to avoid risky enum replacement:
-- PENDING -> LEADER_APPROVED -> KOORDINATOR_SIGNED -> WAITING_SIGNATURE -> APPROVED -> COMPLETED
-- WAITING_SIGNATURE now means: waiting Admin Gudang to process Surat Jalan after Supervisor approval.

-- 1) Koordinator now acts immediately after Leader approval.
create or replace function public.koordinator_sign_surat_jalan(
  p_request_id uuid,
  p_koordinator_id uuid,
  p_signature_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_request record;
begin
  select role::text into v_role from public.profiles where id = p_koordinator_id and is_active = true;
  if v_role <> 'KOORDINATOR' then
    raise exception 'Hanya Koordinator yang boleh approve request mitra.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.status <> 'LEADER_APPROVED' then
    raise exception 'Request harus sudah disetujui Leader sebelum Koordinator approve.';
  end if;

  update public.material_requests
  set status = 'KOORDINATOR_SIGNED',
      koordinator_id = p_koordinator_id,
      koordinator_signed_at = now(),
      koordinator_signature_url = p_signature_url,
      updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_koordinator_id, 'KOORDINATOR', 'KOORDINATOR_APPROVE_REQUEST', 'material_requests', p_request_id,
          'Koordinator menyetujui request material ' || v_request.request_code,
          jsonb_build_object('request_code', v_request.request_code));

  return p_request_id;
end;
$$;

-- 2) Supervisor approves after Koordinator. This stage only records Supervisor signature/approval.
-- Stock movement and serial delivery are moved to Admin process stage.
create or replace function public.supervisor_approve_surat_jalan(
  p_request_id uuid,
  p_supervisor_id uuid,
  p_signature_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_request record;
begin
  select role::text into v_role from public.profiles where id = p_supervisor_id and is_active = true;
  if v_role <> 'SUPERVISOR' then
    raise exception 'Hanya Supervisor yang boleh approval final sebelum Admin Gudang.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.status <> 'KOORDINATOR_SIGNED' then
    raise exception 'Request harus sudah disetujui Koordinator sebelum Supervisor approve.';
  end if;

  update public.material_requests
  set status = 'WAITING_SIGNATURE',
      supervisor_id = p_supervisor_id,
      supervisor_signed_at = now(),
      supervisor_signature_url = p_signature_url,
      updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_supervisor_id, 'SUPERVISOR', 'SUPERVISOR_APPROVE_REQUEST', 'material_requests', p_request_id,
          'Supervisor menyetujui request material ' || v_request.request_code || ' dan meneruskan ke Admin Gudang',
          jsonb_build_object('request_code', v_request.request_code));

  return p_request_id;
end;
$$;

-- 3) Admin Gudang process stage: create SJ number, save Admin signature, validate qty/SN,
-- move material/SN from Gudang into technician bag, then mark request APPROVED/ready to receive.
create or replace function public.admin_process_material_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_signature_url text,
  p_catatan_admin text default null,
  p_surat_jalan_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_request record;
  v_item record;
  v_stock record;
  v_sn record;
  v_sn_count integer;
  v_sj_number text;
begin
  select role::text into v_role from public.profiles where id = p_admin_id and is_active = true;
  if v_role <> 'ADMIN' then
    raise exception 'Hanya Admin Gudang yang boleh memproses Surat Jalan.';
  end if;

  if p_signature_url is null or length(trim(p_signature_url)) = 0 then
    raise exception 'Tanda tangan Admin Gudang belum tersedia.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.status <> 'WAITING_SIGNATURE' then
    raise exception 'Request harus sudah disetujui Supervisor sebelum Admin Gudang memproses Surat Jalan.';
  end if;

  v_sj_number := coalesce(nullif(trim(p_surat_jalan_number), ''), v_request.surat_jalan_number);
  if v_sj_number is null then
    raise exception 'Nomor Surat Jalan wajib diisi.';
  end if;

  for v_item in
    select mri.*, m.material_code, m.wajib_sn
    from public.material_request_items mri
    join public.materials m on m.id = mri.material_id
    where mri.request_id = p_request_id and coalesce(mri.qty_approved, 0) > 0
    order by mri.created_at
  loop
    select * into v_stock
    from public.material_stocks
    where material_id = v_item.material_id and location_type = 'GUDANG' and status = 'AVAILABLE'
    order by created_at
    limit 1
    for update;

    if v_stock.id is null or v_stock.qty < v_item.qty_approved then
      raise exception 'Stok gudang tidak cukup untuk material %.', v_item.material_code;
    end if;

    if v_item.wajib_sn then
      select count(*) into v_sn_count
      from public.material_request_item_serials ris
      join public.material_serial_numbers msn on msn.id = ris.serial_number_id
      where ris.request_item_id = v_item.id
        and ris.request_id = p_request_id
        and msn.material_id = v_item.material_id
        and msn.status = 'AVAILABLE'
        and msn.location_type = 'GUDANG';

      if v_sn_count <> v_item.qty_approved then
        raise exception 'Jumlah serial number terpilih untuk material % harus sama dengan qty approved.', v_item.material_code;
      end if;

      for v_sn in
        select msn.*
        from public.material_request_item_serials ris
        join public.material_serial_numbers msn on msn.id = ris.serial_number_id
        where ris.request_item_id = v_item.id
          and ris.request_id = p_request_id
          and msn.material_id = v_item.material_id
          and msn.status = 'AVAILABLE'
          and msn.location_type = 'GUDANG'
        order by ris.selected_at
        for update of msn
      loop
        update public.material_serial_numbers
        set status = 'IN_TECHNICIAN_BAG',
            location_type = 'TEKNISI',
            teknisi_id = v_request.teknisi_id,
            stock_id = null,
            updated_at = now()
        where id = v_sn.id;

        insert into public.technician_bags(teknisi_id, material_id, serial_number_id, qty, kondisi, source_request_id, status)
        values (v_request.teknisi_id, v_item.material_id, v_sn.id, 1, v_sn.kondisi, p_request_id, 'ACTIVE');
      end loop;
    else
      insert into public.technician_bags(teknisi_id, material_id, serial_number_id, qty, kondisi, source_request_id, status)
      values (v_request.teknisi_id, v_item.material_id, null, v_item.qty_approved, v_stock.kondisi, p_request_id, 'ACTIVE');
    end if;

    update public.material_stocks set qty = qty - v_item.qty_approved, updated_at = now() where id = v_stock.id;
    update public.material_request_items set status = 'APPROVED' where id = v_item.id;
  end loop;

  update public.material_request_items
  set status = 'REJECTED'
  where request_id = p_request_id and coalesce(qty_approved, 0) = 0;

  update public.material_requests
  set status = 'APPROVED',
      approved_by = p_admin_id,
      approved_at = now(),
      admin_signature_url = p_signature_url,
      admin_signed_at = now(),
      catatan_admin = nullif(trim(coalesce(p_catatan_admin, '')), ''),
      surat_jalan_number = v_sj_number,
      updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_admin_id, 'ADMIN', 'ADMIN_PROCESS_SURAT_JALAN', 'material_requests', p_request_id,
          'Admin Gudang memproses Surat Jalan ' || v_sj_number || ' dan material siap diterima teknisi',
          jsonb_build_object('request_code', v_request.request_code, 'surat_jalan_number', v_sj_number));

  return p_request_id;
end;
$$;
