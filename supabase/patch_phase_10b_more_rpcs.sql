-- Phase 10B continuation: optimize request, stock opname, and report preview reads.
-- Run after patch_phase_10b_rpc_lists.sql.

create or replace function public.list_material_requests_page(
  p_profile_id uuid,
  p_role text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  request_code text,
  teknisi_id uuid,
  teknisi_nama text,
  status text,
  catatan_teknisi text,
  catatan_admin text,
  approved_by uuid,
  approved_by_nama text,
  approved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  item_count integer,
  total_qty integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with total as (
    select count(*)::bigint as total_count
    from public.material_requests mr
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or mr.teknisi_id = p_profile_id
  ), base as (
    select mr.*
    from public.material_requests mr
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or mr.teknisi_id = p_profile_id
    order by mr.created_at desc
    limit greatest(1, least(coalesce(p_limit,20), 100))
    offset greatest(0, coalesce(p_offset,0))
  )
  select
    b.id,
    b.request_code,
    b.teknisi_id,
    p.nama as teknisi_nama,
    b.status,
    b.catatan_teknisi,
    b.catatan_admin,
    b.approved_by,
    ap.nama as approved_by_nama,
    b.approved_at,
    b.created_at,
    b.updated_at,
    coalesce(a.item_count,0)::integer as item_count,
    coalesce(a.total_qty,0)::integer as total_qty,
    total.total_count
  from base b
  join public.profiles p on p.id = b.teknisi_id
  left join public.profiles ap on ap.id = b.approved_by
  cross join total
  left join lateral (
    select count(mri.id)::integer as item_count, coalesce(sum(mri.qty_requested),0)::integer as total_qty
    from public.material_request_items mri
    where mri.request_id = b.id
  ) a on true
  order by b.created_at desc;
$$;

create or replace function public.list_stock_opnames_page(
  p_profile_id uuid,
  p_role text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  so_code text,
  teknisi_id uuid,
  teknisi_nama text,
  status text,
  catatan_teknisi text,
  reviewed_by_nama text,
  reviewed_at timestamptz,
  created_at timestamptz,
  item_count integer,
  total_system_qty integer,
  total_physical_qty integer,
  total_selisih integer,
  problem_count integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with total as (
    select count(*)::bigint as total_count
    from public.stock_opnames so
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or so.teknisi_id = p_profile_id
  ), base as (
    select so.*
    from public.stock_opnames so
    where upper(coalesce(p_role,'')) <> 'TEKNISI' or so.teknisi_id = p_profile_id
    order by so.created_at desc
    limit greatest(1, least(coalesce(p_limit,20), 100))
    offset greatest(0, coalesce(p_offset,0))
  )
  select
    b.id,
    b.so_code,
    b.teknisi_id,
    p.nama as teknisi_nama,
    b.status,
    b.catatan_teknisi,
    rp.nama as reviewed_by_nama,
    b.reviewed_at,
    b.created_at,
    coalesce(a.item_count,0)::integer as item_count,
    coalesce(a.total_system_qty,0)::integer as total_system_qty,
    coalesce(a.total_physical_qty,0)::integer as total_physical_qty,
    coalesce(a.total_selisih,0)::integer as total_selisih,
    coalesce(a.problem_count,0)::integer as problem_count,
    total.total_count
  from base b
  join public.profiles p on p.id = b.teknisi_id
  left join public.profiles rp on rp.id = b.reviewed_by
  cross join total
  left join lateral (
    select
      count(soi.id)::integer as item_count,
      coalesce(sum(soi.qty_system),0)::integer as total_system_qty,
      coalesce(sum(soi.qty_physical),0)::integer as total_physical_qty,
      coalesce(sum(soi.qty_physical - soi.qty_system),0)::integer as total_selisih,
      count(*) filter (where soi.qty_physical <> soi.qty_system or soi.status_review in ('REVISION','REJECTED_FINAL'))::integer as problem_count
    from public.stock_opname_items soi
    where soi.stock_opname_id = b.id
  ) a on true
  order by b.created_at desc;
$$;

create or replace function public.list_usage_report_page(
  p_keyword text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_teknisi_id uuid default null,
  p_limit integer default 25,
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
  with filtered as (
    select mu.*
    from public.material_usages mu
    join public.profiles p on p.id = mu.teknisi_id
    where (p_start_date is null or mu.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or mu.created_at < (p_end_date + 1)::timestamptz)
      and (p_teknisi_id is null or mu.teknisi_id = p_teknisi_id)
      and (
        nullif(trim(coalesce(p_keyword,'')), '') is null
        or mu.usage_code ilike '%' || trim(p_keyword) || '%'
        or mu.no_tiket ilike '%' || trim(p_keyword) || '%'
        or coalesce(mu.nama_pelanggan,'') ilike '%' || trim(p_keyword) || '%'
        or p.nama ilike '%' || trim(p_keyword) || '%'
        or exists (
          select 1
          from public.material_usage_items mui
          join public.materials m on m.id = mui.material_id
          where mui.usage_id = mu.id
            and (m.material_code ilike '%' || trim(p_keyword) || '%' or m.nama ilike '%' || trim(p_keyword) || '%')
        )
      )
  ), total as (
    select count(*)::bigint as total_count from filtered
  ), base as (
    select * from filtered
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit,25), 100))
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
