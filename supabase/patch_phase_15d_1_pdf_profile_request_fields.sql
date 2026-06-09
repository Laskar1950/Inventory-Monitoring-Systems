-- Phase 15D-1: Profile and Request fields for Surat Jalan PDF layout
-- Run after Phase 15A.

alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists basecamp text;

alter table public.material_requests add column if not exists basecamp text;
alter table public.material_requests add column if not exists referensi_pekerjaan text;
alter table public.material_requests add column if not exists teknisi_phone_number text;
alter table public.material_requests add column if not exists teknisi_company_name text;
alter table public.material_requests add column if not exists teknisi_basecamp text;

-- Keep older deployments safe if these workflow columns were not added by previous patches.
alter table public.material_requests add column if not exists leader_id uuid references public.profiles(id);
alter table public.material_requests add column if not exists leader_approved_at timestamptz;
alter table public.material_requests add column if not exists leader_catatan text;
alter table public.material_requests add column if not exists admin_signature_url text;
alter table public.material_requests add column if not exists admin_signed_at timestamptz;
alter table public.material_requests add column if not exists koordinator_id uuid references public.profiles(id);
alter table public.material_requests add column if not exists koordinator_signed_at timestamptz;
alter table public.material_requests add column if not exists koordinator_signature_url text;
alter table public.material_requests add column if not exists supervisor_id uuid references public.profiles(id);
alter table public.material_requests add column if not exists supervisor_signed_at timestamptz;
alter table public.material_requests add column if not exists supervisor_signature_url text;
alter table public.material_requests add column if not exists teknisi_signature_url text;
alter table public.material_requests add column if not exists teknisi_signed_at timestamptz;
alter table public.material_requests add column if not exists received_at timestamptz;
alter table public.material_requests add column if not exists surat_jalan_number text;
alter table public.material_requests add column if not exists surat_jalan_url text;

-- Backfill request snapshot fields from current technician profile when empty.
update public.material_requests mr
set
  teknisi_phone_number = coalesce(mr.teknisi_phone_number, p.phone_number),
  teknisi_company_name = coalesce(mr.teknisi_company_name, p.company_name),
  teknisi_basecamp = coalesce(mr.teknisi_basecamp, p.basecamp),
  basecamp = coalesce(mr.basecamp, p.basecamp)
from public.profiles p
where p.id = mr.teknisi_id;

create or replace view public.material_request_summary as
select
  mr.id,
  mr.request_code,
  mr.teknisi_id,
  p.nama as teknisi_nama,
  p.email as teknisi_email,
  coalesce(mr.teknisi_phone_number, p.phone_number) as teknisi_phone_number,
  coalesce(mr.teknisi_company_name, p.company_name) as teknisi_company_name,
  coalesce(mr.basecamp, mr.teknisi_basecamp, p.basecamp) as basecamp,
  mr.referensi_pekerjaan,
  mr.status,
  mr.catatan_teknisi,
  mr.catatan_admin,
  mr.leader_id,
  lp.nama as leader_nama,
  lp.phone_number as leader_phone_number,
  lp.company_name as leader_company_name,
  mr.leader_approved_at,
  mr.leader_catatan,
  mr.approved_by,
  ap.nama as approved_by_nama,
  ap.phone_number as approved_by_phone_number,
  ap.company_name as approved_by_company_name,
  mr.approved_at,
  mr.admin_signature_url,
  mr.admin_signed_at,
  mr.koordinator_id,
  kp.nama as koordinator_nama,
  kp.phone_number as koordinator_phone_number,
  kp.company_name as koordinator_company_name,
  mr.koordinator_signed_at,
  mr.koordinator_signature_url,
  mr.supervisor_id,
  sp.nama as supervisor_nama,
  sp.phone_number as supervisor_phone_number,
  sp.company_name as supervisor_company_name,
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
group by mr.id, p.nama, p.email, p.phone_number, p.company_name, p.basecamp, lp.nama, lp.phone_number, lp.company_name, ap.nama, ap.phone_number, ap.company_name, kp.nama, kp.phone_number, kp.company_name, sp.nama, sp.phone_number, sp.company_name;

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
  teknisi_phone_number text,
  teknisi_company_name text,
  basecamp text,
  referensi_pekerjaan text,
  status public.transaction_status,
  catatan_teknisi text,
  catatan_admin text,
  leader_id uuid,
  leader_nama text,
  leader_phone_number text,
  leader_company_name text,
  leader_approved_at timestamptz,
  leader_catatan text,
  approved_by uuid,
  approved_by_nama text,
  approved_by_phone_number text,
  approved_by_company_name text,
  approved_at timestamptz,
  admin_signature_url text,
  admin_signed_at timestamptz,
  koordinator_id uuid,
  koordinator_nama text,
  koordinator_phone_number text,
  koordinator_company_name text,
  koordinator_signed_at timestamptz,
  koordinator_signature_url text,
  supervisor_id uuid,
  supervisor_nama text,
  supervisor_phone_number text,
  supervisor_company_name text,
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
    select mrs.*
    from public.material_request_summary mrs
    where
      (p_role = 'TEKNISI' and mrs.teknisi_id = p_profile_id)
      or (p_role = 'LEADER' and mrs.status in ('PENDING','LEADER_APPROVED','WAITING_SIGNATURE','KOORDINATOR_SIGNED','APPROVED','COMPLETED','REJECTED'))
      or (p_role = 'ADMIN' and mrs.status in ('LEADER_APPROVED','WAITING_SIGNATURE','KOORDINATOR_SIGNED','APPROVED','COMPLETED','REJECTED'))
      or (p_role = 'KOORDINATOR' and mrs.status in ('WAITING_SIGNATURE','KOORDINATOR_SIGNED','APPROVED','COMPLETED'))
      or (p_role = 'SUPERVISOR' and mrs.status in ('KOORDINATOR_SIGNED','APPROVED','COMPLETED','REJECTED'))
  )
  select f.*, count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
