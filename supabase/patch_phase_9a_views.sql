-- Phase 9A patch: richer usage/return summaries for UI tables.
-- Run this after supabase/schema.sql if serial number columns do not appear in the UI.

create or replace view public.material_usage_summary as
select
  mu.id,
  mu.usage_code,
  mu.teknisi_id,
  p.nama as teknisi_nama,
  mu.no_tiket,
  mu.nama_pelanggan,
  mu.id_pelanggan,
  mu.alamat,
  mu.root_cause,
  mu.foto_url,
  mu.created_at,
  mu.updated_at,
  count(mui.id)::integer as item_count,
  coalesce(sum(mui.qty), 0)::integer as total_qty,
  string_agg(distinct (m.material_code || ' - ' || m.nama), ', ' order by (m.material_code || ' - ' || m.nama)) as materials_used,
  string_agg(distinct msn.serial_number, ', ' order by msn.serial_number) filter (where msn.serial_number is not null) as serial_numbers
from public.material_usages mu
join public.profiles p on p.id = mu.teknisi_id
left join public.material_usage_items mui on mui.usage_id = mu.id
left join public.materials m on m.id = mui.material_id
left join public.material_serial_numbers msn on msn.id = mui.serial_number_id
group by mu.id, p.nama;

create or replace view public.material_return_summary as
select
  mr.id,
  mr.return_code,
  mr.teknisi_id,
  p.nama as teknisi_nama,
  mr.source_type,
  mr.status,
  mr.kondisi,
  mr.qty_return,
  mr.foto_url,
  mr.keterangan,
  mr.catatan_admin,
  mr.approved_by,
  ap.nama as approved_by_nama,
  mr.approved_at,
  mr.created_at,
  mr.updated_at,
  count(mri.id)::integer as item_count,
  coalesce(sum(mri.qty), 0)::integer as total_qty,
  string_agg(distinct coalesce(m.material_code || ' - ' || m.nama, mri.manual_material_code || ' - ' || mri.manual_nama), ', ' order by coalesce(m.material_code || ' - ' || m.nama, mri.manual_material_code || ' - ' || mri.manual_nama)) as materials_returned,
  string_agg(distinct coalesce(msn.serial_number, mri.manual_serial_number), ', ' order by coalesce(msn.serial_number, mri.manual_serial_number)) filter (where coalesce(msn.serial_number, mri.manual_serial_number) is not null) as serial_numbers
from public.material_returns mr
join public.profiles p on p.id = mr.teknisi_id
left join public.profiles ap on ap.id = mr.approved_by
left join public.material_return_items mri on mri.return_id = mr.id
left join public.materials m on m.id = mri.material_id
left join public.material_serial_numbers msn on msn.id = mri.serial_number_id
group by mr.id, p.nama, ap.nama;
