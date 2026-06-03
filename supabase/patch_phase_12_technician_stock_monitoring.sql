-- Phase 12: Technician Stock Monitoring
-- Purpose: classify material stock carried by each technician as AMAN, LOW_STOCK, KOSONG, or OVER_STOCK.
-- Run in Supabase SQL Editor after previous patches.

create table if not exists public.technician_stock_rules (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  min_qty integer not null default 1 check (min_qty >= 0),
  max_qty integer not null default 5 check (max_qty >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_stock_rules_range_check check (max_qty >= min_qty),
  constraint technician_stock_rules_material_unique unique(material_id)
);

drop trigger if exists trg_technician_stock_rules_updated_at on public.technician_stock_rules;
create trigger trg_technician_stock_rules_updated_at
before update on public.technician_stock_rules
for each row execute function public.set_updated_at();

-- Default rules:
-- 1) Kabel precon must be exactly 5 to be AMAN.
-- 2) Other material defaults to min 1, max 5.
insert into public.technician_stock_rules(material_id, min_qty, max_qty)
select
  m.id,
  case when lower(coalesce(m.nama,'') || ' ' || coalesce(m.material_code,'') || ' ' || coalesce(m.merk,'')) like '%precon%' then 5 else 1 end,
  case when lower(coalesce(m.nama,'') || ' ' || coalesce(m.material_code,'') || ' ' || coalesce(m.merk,'')) like '%precon%' then 5 else 5 end
from public.materials m
where m.is_active = true
on conflict (material_id) do update
set
  min_qty = case when lower(coalesce((select nama from public.materials where id = excluded.material_id),'') || ' ' || coalesce((select material_code from public.materials where id = excluded.material_id),'') || ' ' || coalesce((select merk from public.materials where id = excluded.material_id),'')) like '%precon%' then 5 else public.technician_stock_rules.min_qty end,
  max_qty = case when lower(coalesce((select nama from public.materials where id = excluded.material_id),'') || ' ' || coalesce((select material_code from public.materials where id = excluded.material_id),'') || ' ' || coalesce((select merk from public.materials where id = excluded.material_id),'')) like '%precon%' then 5 else public.technician_stock_rules.max_qty end,
  updated_at = now();

create or replace view public.technician_stock_status as
with bag_agg as (
  select
    tb.teknisi_id,
    tb.material_id,
    coalesce(nullif(tb.kondisi, ''), m.kondisi_default) as kondisi,
    sum(tb.qty)::integer as current_qty,
    count(tb.serial_number_id)::integer as serial_count
  from public.technician_bags tb
  join public.materials m on m.id = tb.material_id
  where tb.status = 'ACTIVE'
  group by tb.teknisi_id, tb.material_id, coalesce(nullif(tb.kondisi, ''), m.kondisi_default)
)
select
  ba.teknisi_id,
  p.nama as teknisi_nama,
  ba.material_id,
  m.material_code,
  m.nama as material_nama,
  m.merk,
  m.satuan,
  m.wajib_sn,
  ba.kondisi,
  ba.current_qty,
  ba.serial_count,
  coalesce(r.min_qty, case when lower(coalesce(m.nama,'') || ' ' || coalesce(m.material_code,'') || ' ' || coalesce(m.merk,'')) like '%precon%' then 5 else 1 end)::integer as min_qty,
  coalesce(r.max_qty, case when lower(coalesce(m.nama,'') || ' ' || coalesce(m.material_code,'') || ' ' || coalesce(m.merk,'')) like '%precon%' then 5 else 5 end)::integer as max_qty,
  case
    when ba.current_qty = 0 then 'KOSONG'
    when ba.current_qty < coalesce(r.min_qty, case when lower(coalesce(m.nama,'') || ' ' || coalesce(m.material_code,'') || ' ' || coalesce(m.merk,'')) like '%precon%' then 5 else 1 end) then 'LOW_STOCK'
    when ba.current_qty > coalesce(r.max_qty, case when lower(coalesce(m.nama,'') || ' ' || coalesce(m.material_code,'') || ' ' || coalesce(m.merk,'')) like '%precon%' then 5 else 5 end) then 'OVER_STOCK'
    else 'AMAN'
  end as stock_status
from bag_agg ba
join public.profiles p on p.id = ba.teknisi_id
join public.materials m on m.id = ba.material_id
left join public.technician_stock_rules r on r.material_id = ba.material_id and r.is_active = true
where p.role = 'TEKNISI' and p.is_active = true and m.is_active = true;

create or replace view public.technician_stock_summary as
select
  teknisi_id,
  teknisi_nama,
  count(*)::integer as material_count,
  coalesce(sum(current_qty), 0)::integer as total_qty,
  count(*) filter (where stock_status = 'AMAN')::integer as aman_count,
  count(*) filter (where stock_status = 'LOW_STOCK')::integer as low_count,
  count(*) filter (where stock_status = 'KOSONG')::integer as kosong_count,
  count(*) filter (where stock_status = 'OVER_STOCK')::integer as over_count,
  case
    when count(*) filter (where stock_status = 'KOSONG') > 0 or count(*) filter (where stock_status = 'LOW_STOCK') >= 3 then 'KRITIS'
    when count(*) filter (where stock_status in ('LOW_STOCK','OVER_STOCK')) > 0 then 'PERLU_PERHATIAN'
    else 'AMAN'
  end as overall_status
from public.technician_stock_status
where current_qty > 0
  and stock_status is not null
group by teknisi_id, teknisi_nama;

create or replace view public.technician_stock_alerts as
select *
from public.technician_stock_status
where stock_status in ('LOW_STOCK','KOSONG','OVER_STOCK')
order by
  case stock_status when 'KOSONG' then 1 when 'LOW_STOCK' then 2 when 'OVER_STOCK' then 3 else 4 end,
  teknisi_nama,
  material_nama;
