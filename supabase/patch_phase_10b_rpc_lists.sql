-- Phase 10B: database-side paginated list RPCs.
-- These functions limit base rows first, then aggregate item detail only for those rows.
-- Run after schema.sql and previous phase patches.

create or replace function public.list_material_usages_page(
  p_profile_id uuid,
  p_role text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  usage_code text,
  teknisi_id uuid,
  teknisi_nama text,
  no_tiket text,
  nama_pelanggan text,
  id_pelanggan text,
  alamat text,
  root_cause text,
  foto_url text,
  created_at timestamptz,
  item_count integer,
  total_qty integer,
  materials_used text,
  material_names text,
  serial_numbers text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with total as (
    select count(*)::bigint as total_count
    from public.material_usages mu
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or mu.teknisi_id = p_profile_id
  ), base as (
    select mu.*
    from public.material_usages mu
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or mu.teknisi_id = p_profile_id
    order by mu.created_at desc
    limit greatest(1, least(coalesce(p_limit,20), 100))
    offset greatest(0, coalesce(p_offset,0))
  )
  select
    b.id,
    b.usage_code,
    b.teknisi_id,
    p.nama as teknisi_nama,
    b.no_tiket,
    b.nama_pelanggan,
    b.id_pelanggan,
    b.alamat,
    b.root_cause,
    b.foto_url,
    b.created_at,
    coalesce(a.item_count,0)::integer as item_count,
    coalesce(a.total_qty,0)::integer as total_qty,
    a.materials_used,
    a.material_names,
    a.serial_numbers,
    total.total_count
  from base b
  join public.profiles p on p.id = b.teknisi_id
  cross join total
  left join lateral (
    select
      count(mui.id)::integer as item_count,
      coalesce(sum(mui.qty),0)::integer as total_qty,
      string_agg(distinct (m.material_code || ' - ' || m.nama), ', ' order by (m.material_code || ' - ' || m.nama)) as materials_used,
      string_agg(distinct m.nama, ', ' order by m.nama) as material_names,
      string_agg(distinct msn.serial_number, ', ' order by msn.serial_number) filter (where msn.serial_number is not null) as serial_numbers
    from public.material_usage_items mui
    join public.materials m on m.id = mui.material_id
    left join public.material_serial_numbers msn on msn.id = mui.serial_number_id
    where mui.usage_id = b.id
  ) a on true
  order by b.created_at desc;
$$;

create or replace function public.list_material_returns_page(
  p_profile_id uuid,
  p_role text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  return_code text,
  teknisi_id uuid,
  teknisi_nama text,
  source_type text,
  status text,
  kondisi text,
  qty_return integer,
  foto_url text,
  keterangan text,
  catatan_admin text,
  approved_by uuid,
  approved_by_nama text,
  approved_at timestamptz,
  created_at timestamptz,
  item_count integer,
  total_qty integer,
  materials_returned text,
  serial_numbers text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with total as (
    select count(*)::bigint as total_count
    from public.material_returns mr
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or mr.teknisi_id = p_profile_id
  ), base as (
    select mr.*
    from public.material_returns mr
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or mr.teknisi_id = p_profile_id
    order by mr.created_at desc
    limit greatest(1, least(coalesce(p_limit,20), 100))
    offset greatest(0, coalesce(p_offset,0))
  )
  select
    b.id,
    b.return_code,
    b.teknisi_id,
    p.nama as teknisi_nama,
    b.source_type,
    b.status,
    b.kondisi,
    b.qty_return,
    b.foto_url,
    b.keterangan,
    b.catatan_admin,
    b.approved_by,
    ap.nama as approved_by_nama,
    b.approved_at,
    b.created_at,
    coalesce(a.item_count,0)::integer as item_count,
    coalesce(a.total_qty,0)::integer as total_qty,
    a.materials_returned,
    a.serial_numbers,
    total.total_count
  from base b
  join public.profiles p on p.id = b.teknisi_id
  left join public.profiles ap on ap.id = b.approved_by
  cross join total
  left join lateral (
    select
      count(mri.id)::integer as item_count,
      coalesce(sum(mri.qty),0)::integer as total_qty,
      string_agg(distinct coalesce(m.material_code || ' - ' || m.nama, mri.manual_material_code || ' - ' || mri.manual_nama), ', ' order by coalesce(m.material_code || ' - ' || m.nama, mri.manual_material_code || ' - ' || mri.manual_nama)) as materials_returned,
      string_agg(distinct coalesce(msn.serial_number, mri.manual_serial_number), ', ' order by coalesce(msn.serial_number, mri.manual_serial_number)) filter (where coalesce(msn.serial_number, mri.manual_serial_number) is not null) as serial_numbers
    from public.material_return_items mri
    left join public.materials m on m.id = mri.material_id
    left join public.material_serial_numbers msn on msn.id = mri.serial_number_id
    where mri.return_id = b.id
  ) a on true
  order by b.created_at desc;
$$;
