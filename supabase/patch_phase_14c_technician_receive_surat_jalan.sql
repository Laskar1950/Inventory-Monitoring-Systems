-- Phase 14C: Technician Receive Material
alter table public.material_requests add column if not exists teknisi_signature_url text;
alter table public.material_requests add column if not exists teknisi_signed_at timestamptz;
alter table public.material_requests add column if not exists received_at timestamptz;

drop function if exists public.list_material_requests_page(uuid, text, integer, integer);
drop view if exists public.material_request_summary;

create view public.material_request_summary as
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
  mr.admin_signature_url,
  mr.admin_signed_at,
  mr.koordinator_id,
  kp.nama as koordinator_nama,
  mr.koordinator_signed_at,
  mr.koordinator_signature_url,
  mr.supervisor_id,
  sp.nama as supervisor_nama,
  mr.supervisor_signed_at,
  mr.supervisor_signature_url,
  mr.teknisi_signature_url,
  mr.teknisi_signed_at,
  mr.received_at,
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

create function public.list_material_requests_page(
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
  admin_signature_url text,
  admin_signed_at timestamptz,
  koordinator_id uuid,
  koordinator_nama text,
  koordinator_signed_at timestamptz,
  koordinator_signature_url text,
  supervisor_id uuid,
  supervisor_nama text,
  supervisor_signed_at timestamptz,
  supervisor_signature_url text,
  teknisi_signature_url text,
  teknisi_signed_at timestamptz,
  received_at timestamptz,
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
    f.approved_by, f.approved_by_nama, f.approved_at, f.admin_signature_url, f.admin_signed_at,
    f.koordinator_id, f.koordinator_nama, f.koordinator_signed_at, f.koordinator_signature_url,
    f.supervisor_id, f.supervisor_nama, f.supervisor_signed_at, f.supervisor_signature_url,
    f.teknisi_signature_url, f.teknisi_signed_at, f.received_at,
    f.surat_jalan_number, f.surat_jalan_url,
    f.created_at, f.updated_at, f.item_count, f.total_qty,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(1, p_limit)
  offset greatest(0, p_offset);
$$;

create or replace function public.technician_receive_surat_jalan(
  p_request_id uuid,
  p_teknisi_id uuid,
  p_signature_url text
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
  select role::text into v_role from public.profiles where id = p_teknisi_id and is_active = true;
  if v_role <> 'TEKNISI' then
    raise exception 'Hanya Teknisi yang boleh tanda tangan penerimaan material.';
  end if;

  if p_signature_url is null or length(trim(p_signature_url)) = 0 then
    raise exception 'Tanda tangan teknisi belum tersedia.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request tidak ditemukan.'; end if;
  if v_request.teknisi_id <> p_teknisi_id then raise exception 'Teknisi hanya boleh menerima request miliknya.'; end if;
  if v_request.status <> 'APPROVED' then raise exception 'Material hanya dapat diterima setelah approval final Supervisor.'; end if;

  update public.material_requests
  set status = 'COMPLETED',
      teknisi_signature_url = p_signature_url,
      teknisi_signed_at = now(),
      received_at = now(),
      updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_teknisi_id, 'TEKNISI', 'TECHNICIAN_RECEIVE_SURAT_JALAN', 'material_requests', p_request_id,
          'Teknisi menandatangani penerimaan material ' || coalesce(v_request.surat_jalan_number, v_request.request_code),
          jsonb_build_object('request_code', v_request.request_code, 'surat_jalan_number', v_request.surat_jalan_number));

  return p_request_id;
end;
$$;
