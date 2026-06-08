-- Phase 14B: Signature Snapshot for Surat Jalan
-- Purpose: snapshot account signatures into material_requests when Admin, Koordinator, and Supervisor approve/sign.
-- Run in Supabase SQL Editor after Phase 13 and Phase 14A.

alter table public.material_requests add column if not exists admin_signature_url text;
alter table public.material_requests add column if not exists admin_signed_at timestamptz;

-- Recreate request summary because new snapshot columns must be exposed to the app.
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
    f.surat_jalan_number, f.surat_jalan_url,
    f.created_at, f.updated_at, f.item_count, f.total_qty,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(1, p_limit)
  offset greatest(0, p_offset);
$$;
