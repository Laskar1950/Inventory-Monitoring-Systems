-- Phase 13: Surat Jalan approval flow correction
-- Correct role flow: TEKNISI -> LEADER -> ADMIN -> KOORDINATOR -> SUPERVISOR.
-- MANAGER role is intentionally not used; final approval uses existing SUPERVISOR role.
-- Run this in Supabase SQL Editor after previous patches.

-- 1) Extend enums safely.
do $$ begin
  alter type public.user_role add value if not exists 'LEADER';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.user_role add value if not exists 'KOORDINATOR';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.transaction_status add value if not exists 'LEADER_APPROVED';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.transaction_status add value if not exists 'WAITING_SIGNATURE';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.transaction_status add value if not exists 'KOORDINATOR_SIGNED';
exception when duplicate_object then null;
end $$;

-- 2) Add request workflow columns.
alter table public.material_requests add column if not exists basecamp text;
alter table public.material_requests add column if not exists referensi_pekerjaan text;
alter table public.material_requests add column if not exists leader_id uuid references public.profiles(id);
alter table public.material_requests add column if not exists leader_approved_at timestamptz;
alter table public.material_requests add column if not exists leader_catatan text;
alter table public.material_requests add column if not exists koordinator_id uuid references public.profiles(id);
alter table public.material_requests add column if not exists koordinator_signed_at timestamptz;
alter table public.material_requests add column if not exists koordinator_signature_url text;
alter table public.material_requests add column if not exists supervisor_id uuid references public.profiles(id);
alter table public.material_requests add column if not exists supervisor_signed_at timestamptz;
alter table public.material_requests add column if not exists supervisor_signature_url text;
alter table public.material_requests add column if not exists surat_jalan_number text;
alter table public.material_requests add column if not exists surat_jalan_url text;

create unique index if not exists idx_material_requests_surat_jalan_number_unique
on public.material_requests(surat_jalan_number)
where surat_jalan_number is not null;

-- 3) Recreate request summary with full surat jalan fields.
create or replace view public.material_request_summary as
select
  mr.id,
  mr.request_code,
  mr.teknisi_id,
  p.nama as teknisi_nama,
  p.email as teknisi_email,
  mr.basecamp,
  mr.referensi_pekerjaan,
  mr.status,
  mr.catatan_teknisi,
  mr.catatan_admin,
  mr.leader_id,
  lp.nama as leader_nama,
  mr.leader_approved_at,
  mr.leader_catatan,
  mr.approved_by,
  ap.nama as approved_by_nama,
  mr.approved_at,
  mr.koordinator_id,
  kp.nama as koordinator_nama,
  mr.koordinator_signed_at,
  mr.koordinator_signature_url,
  mr.supervisor_id,
  sp.nama as supervisor_nama,
  mr.supervisor_signed_at,
  mr.supervisor_signature_url,
  mr.surat_jalan_number,
  mr.surat_jalan_url,
  mr.created_at,
  mr.updated_at,
  count(mri.id)::integer as item_count,
  coalesce(sum(mri.qty_requested), 0)::integer as total_qty
from public.material_requests mr
join public.profiles p on p.id = mr.teknisi_id
left join public.profiles lp on lp.id = mr.leader_id
left join public.profiles ap on ap.id = mr.approved_by
left join public.profiles kp on kp.id = mr.koordinator_id
left join public.profiles sp on sp.id = mr.supervisor_id
left join public.material_request_items mri on mri.request_id = mr.id
group by mr.id, p.nama, p.email, lp.nama, ap.nama, kp.nama, sp.nama;

-- 4) List requests page RPC used by API.
create or replace function public.list_material_requests_page(
  p_profile_id uuid,
  p_role text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid,
  request_code text,
  teknisi_id uuid,
  teknisi_nama text,
  teknisi_email text,
  basecamp text,
  referensi_pekerjaan text,
  status public.transaction_status,
  catatan_teknisi text,
  catatan_admin text,
  leader_id uuid,
  leader_nama text,
  leader_approved_at timestamptz,
  leader_catatan text,
  approved_by uuid,
  approved_by_nama text,
  approved_at timestamptz,
  koordinator_id uuid,
  koordinator_nama text,
  koordinator_signed_at timestamptz,
  koordinator_signature_url text,
  supervisor_id uuid,
  supervisor_nama text,
  supervisor_signed_at timestamptz,
  supervisor_signature_url text,
  surat_jalan_number text,
  surat_jalan_url text,
  created_at timestamptz,
  updated_at timestamptz,
  item_count integer,
  total_qty integer,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select * from public.material_request_summary mrs
    where
      (p_role = 'TEKNISI' and mrs.teknisi_id = p_profile_id)
      or (p_role in ('ADMIN','SUPERVISOR','LEADER','KOORDINATOR'))
  )
  select
    f.id, f.request_code, f.teknisi_id, f.teknisi_nama, f.teknisi_email,
    f.basecamp, f.referensi_pekerjaan, f.status, f.catatan_teknisi, f.catatan_admin,
    f.leader_id, f.leader_nama, f.leader_approved_at, f.leader_catatan,
    f.approved_by, f.approved_by_nama, f.approved_at,
    f.koordinator_id, f.koordinator_nama, f.koordinator_signed_at, f.koordinator_signature_url,
    f.supervisor_id, f.supervisor_nama, f.supervisor_signed_at, f.supervisor_signature_url,
    f.surat_jalan_number, f.surat_jalan_url,
    f.created_at, f.updated_at, f.item_count, f.total_qty,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(1, p_limit)
  offset greatest(0, p_offset);
$$;

-- 5) Leader approval/rejection.
create or replace function public.leader_approve_material_request(
  p_request_id uuid,
  p_leader_id uuid,
  p_catatan text default null
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
  select role::text into v_role from public.profiles where id = p_leader_id and is_active = true;
  if v_role <> 'LEADER' then
    raise exception 'Hanya Leader yang boleh approve request teknisi.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.status <> 'PENDING' then raise exception 'Request tidak dalam status PENDING.'; end if;

  update public.material_requests
  set status = 'LEADER_APPROVED', leader_id = p_leader_id, leader_approved_at = now(), leader_catatan = nullif(trim(coalesce(p_catatan,'')), ''), updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_leader_id, 'LEADER', 'LEADER_APPROVE_REQUEST', 'material_requests', p_request_id,
          'Leader menyetujui request material ' || v_request.request_code,
          jsonb_build_object('request_code', v_request.request_code));

  return p_request_id;
end;
$$;

create or replace function public.leader_reject_material_request(
  p_request_id uuid,
  p_leader_id uuid,
  p_catatan text default null
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
  select role::text into v_role from public.profiles where id = p_leader_id and is_active = true;
  if v_role <> 'LEADER' then
    raise exception 'Hanya Leader yang boleh reject request teknisi.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.status <> 'PENDING' then raise exception 'Request tidak dalam status PENDING.'; end if;

  update public.material_request_items set qty_approved = 0, status = 'REJECTED' where request_id = p_request_id;
  update public.material_requests
  set status = 'REJECTED', leader_id = p_leader_id, leader_approved_at = now(), leader_catatan = nullif(trim(coalesce(p_catatan,'')), ''), updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_leader_id, 'LEADER', 'LEADER_REJECT_REQUEST', 'material_requests', p_request_id,
          'Leader menolak request material ' || v_request.request_code,
          jsonb_build_object('request_code', v_request.request_code, 'catatan', p_catatan));

  return p_request_id;
end;
$$;

-- 6) Koordinator signature.
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
    raise exception 'Hanya Koordinator yang boleh tanda tangan surat jalan.';
  end if;
  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.status <> 'WAITING_SIGNATURE' then raise exception 'Surat jalan belum menunggu tanda tangan Koordinator.'; end if;

  update public.material_requests
  set status = 'KOORDINATOR_SIGNED', koordinator_id = p_koordinator_id, koordinator_signed_at = now(), koordinator_signature_url = p_signature_url, updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_koordinator_id, 'KOORDINATOR', 'KOORDINATOR_SIGN_SURAT_JALAN', 'material_requests', p_request_id,
          'Koordinator menandatangani surat jalan ' || coalesce(v_request.surat_jalan_number, v_request.request_code),
          jsonb_build_object('request_code', v_request.request_code, 'surat_jalan_number', v_request.surat_jalan_number));

  return p_request_id;
end;
$$;

-- 7) Supervisor final approval: after this, stock moves to technician bag.
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
    select mri.*, m.material_code, m.nama, m.wajib_sn
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
      from (
        select id
        from public.material_serial_numbers
        where material_id = v_item.material_id and status = 'AVAILABLE' and location_type = 'GUDANG'
        order by created_at
        limit v_item.qty_approved
        for update
      ) s;
      if v_sn_count < v_item.qty_approved then
        raise exception 'Serial number tersedia tidak cukup untuk material %.', v_item.material_code;
      end if;

      for v_sn in
        select *
        from public.material_serial_numbers
        where material_id = v_item.material_id and status = 'AVAILABLE' and location_type = 'GUDANG'
        order by created_at
        limit v_item.qty_approved
        for update
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
