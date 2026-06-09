-- Phase 15A: Admin Qty Approved and Serial Selection
-- Run after Phase 14E.

create table if not exists public.material_request_item_serials (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_requests(id) on delete cascade,
  request_item_id uuid not null references public.material_request_items(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  serial_number_id uuid not null references public.material_serial_numbers(id),
  selected_by uuid references public.profiles(id),
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(request_item_id, serial_number_id),
  unique(request_id, serial_number_id)
);

create index if not exists idx_request_item_serials_request on public.material_request_item_serials(request_id);
create index if not exists idx_request_item_serials_item on public.material_request_item_serials(request_item_id);
create index if not exists idx_request_item_serials_serial on public.material_request_item_serials(serial_number_id);

create or replace view public.material_request_selected_serial_detail as
select
  ris.id,
  ris.request_id,
  ris.request_item_id,
  ris.material_id,
  ris.serial_number_id,
  msn.serial_number,
  msn.status as serial_status,
  msn.location_type,
  msn.kondisi,
  m.material_code,
  m.nama as material_nama,
  ris.selected_by,
  p.nama as selected_by_nama,
  ris.selected_at,
  ris.created_at
from public.material_request_item_serials ris
join public.material_serial_numbers msn on msn.id = ris.serial_number_id
join public.materials m on m.id = ris.material_id
left join public.profiles p on p.id = ris.selected_by;

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
  v_item record;
  v_stock record;
  v_sn record;
  v_sn_count integer;
begin
  select role::text into v_role from public.profiles where id = p_supervisor_id and is_active = true;
  if v_role <> 'SUPERVISOR' then
    raise exception 'Hanya Supervisor yang boleh approval final surat jalan.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.status <> 'KOORDINATOR_SIGNED' then raise exception 'Surat jalan harus sudah ditandatangani Koordinator.'; end if;

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
        set status = 'IN_TECHNICIAN_BAG', location_type = 'TEKNISI', teknisi_id = v_request.teknisi_id, stock_id = null
        where id = v_sn.id;

        insert into public.technician_bags(teknisi_id, material_id, serial_number_id, qty, kondisi, source_request_id, status)
        values (v_request.teknisi_id, v_item.material_id, v_sn.id, 1, v_sn.kondisi, p_request_id, 'ACTIVE');
      end loop;
    else
      insert into public.technician_bags(teknisi_id, material_id, serial_number_id, qty, kondisi, source_request_id, status)
      values (v_request.teknisi_id, v_item.material_id, null, v_item.qty_approved, v_stock.kondisi, p_request_id, 'ACTIVE');
    end if;

    update public.material_stocks set qty = qty - v_item.qty_approved where id = v_stock.id;
    update public.material_request_items set status = 'APPROVED' where id = v_item.id;
  end loop;

  update public.material_request_items
  set status = 'REJECTED'
  where request_id = p_request_id and coalesce(qty_approved, 0) = 0;

  update public.material_requests
  set status = 'APPROVED', supervisor_id = p_supervisor_id, supervisor_signed_at = now(), supervisor_signature_url = p_signature_url, updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_supervisor_id, 'SUPERVISOR', 'SUPERVISOR_APPROVE_SURAT_JALAN', 'material_requests', p_request_id,
          'Supervisor approval final surat jalan ' || coalesce(v_request.surat_jalan_number, v_request.request_code),
          jsonb_build_object('request_code', v_request.request_code, 'surat_jalan_number', v_request.surat_jalan_number));

  return p_request_id;
end;
$$;
