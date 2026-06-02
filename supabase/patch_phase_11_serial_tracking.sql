-- Phase 11: Serial Number Tracking Ledger
-- Purpose: track SN journey from inbound -> gudang -> technician bag -> usage/return.
-- Run in Supabase SQL Editor after previous patches.

create table if not exists public.material_serial_movements (
  id uuid primary key default gen_random_uuid(),
  serial_number_id uuid not null references public.material_serial_numbers(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  movement_type text not null check (movement_type in ('INBOUND','REQUEST_APPROVED','USED','RETURN_REQUESTED','RETURNED','STOCK_OPNAME','ADJUSTMENT')),
  from_location_type text,
  to_location_type text,
  from_teknisi_id uuid references public.profiles(id),
  to_teknisi_id uuid references public.profiles(id),
  reference_type text,
  reference_id uuid,
  reference_item_id uuid,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_serial_movements_serial_created on public.material_serial_movements(serial_number_id, created_at desc);
create index if not exists idx_serial_movements_reference on public.material_serial_movements(reference_type, reference_id);
create index if not exists idx_serial_movements_material on public.material_serial_movements(material_id, created_at desc);

create or replace view public.material_serial_movement_detail as
select
  msm.id,
  msm.serial_number_id,
  msn.serial_number,
  msm.material_id,
  m.material_code,
  m.nama as material_nama,
  m.kondisi_default as material_kondisi,
  msm.movement_type,
  msm.from_location_type,
  msm.to_location_type,
  msm.from_teknisi_id,
  fp.nama as from_teknisi_nama,
  msm.to_teknisi_id,
  tp.nama as to_teknisi_nama,
  msm.reference_type,
  msm.reference_id,
  msm.reference_item_id,
  msm.note,
  msm.created_by,
  cp.nama as created_by_nama,
  msm.created_at,
  msm.metadata
from public.material_serial_movements msm
join public.material_serial_numbers msn on msn.id = msm.serial_number_id
join public.materials m on m.id = msm.material_id
left join public.profiles fp on fp.id = msm.from_teknisi_id
left join public.profiles tp on tp.id = msm.to_teknisi_id
left join public.profiles cp on cp.id = msm.created_by;

-- Helper avoids duplicate ledger rows for the same movement/reference.
create or replace function public.log_serial_movement(
  p_serial_number_id uuid,
  p_material_id uuid,
  p_movement_type text,
  p_from_location_type text default null,
  p_to_location_type text default null,
  p_from_teknisi_id uuid default null,
  p_to_teknisi_id uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reference_item_id uuid default null,
  p_note text default null,
  p_created_by uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_serial_number_id is null or p_material_id is null or p_movement_type is null then
    return null;
  end if;

  select id into v_id
  from public.material_serial_movements
  where serial_number_id = p_serial_number_id
    and movement_type = p_movement_type
    and coalesce(reference_type,'') = coalesce(p_reference_type,'')
    and coalesce(reference_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_reference_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(reference_item_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_reference_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.material_serial_movements(
    serial_number_id, material_id, movement_type, from_location_type, to_location_type,
    from_teknisi_id, to_teknisi_id, reference_type, reference_id, reference_item_id,
    note, created_by, metadata
  ) values (
    p_serial_number_id, p_material_id, p_movement_type, p_from_location_type, p_to_location_type,
    p_from_teknisi_id, p_to_teknisi_id, p_reference_type, p_reference_id, p_reference_item_id,
    p_note, p_created_by, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Trigger: initial SN creation means material entered gudang/ledger.
create or replace function public.trg_log_serial_inbound()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_serial_movement(
    new.id, new.material_id, 'INBOUND', null, new.location_type, null, new.teknisi_id,
    'materials', new.material_id, null, 'Serial number masuk ke gudang', null,
    jsonb_build_object('status', new.status, 'kondisi', new.kondisi)
  );
  return new;
end;
$$;

drop trigger if exists trg_serial_inbound_ledger on public.material_serial_numbers;
create trigger trg_serial_inbound_ledger
after insert on public.material_serial_numbers
for each row execute function public.trg_log_serial_inbound();

-- Trigger: request approval puts SN into technician bag.
create or replace function public.trg_log_serial_request_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_admin_id uuid;
begin
  if new.serial_number_id is null or new.source_request_id is null then
    return new;
  end if;

  select id into v_item_id
  from public.material_request_items
  where request_id = new.source_request_id and material_id = new.material_id
  order by created_at
  limit 1;

  select approved_by into v_admin_id from public.material_requests where id = new.source_request_id;

  perform public.log_serial_movement(
    new.serial_number_id, new.material_id, 'REQUEST_APPROVED', 'GUDANG', 'TEKNISI', null, new.teknisi_id,
    'material_requests', new.source_request_id, v_item_id, 'Serial number diberikan ke teknisi', v_admin_id,
    jsonb_build_object('bag_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_serial_request_approved_ledger on public.technician_bags;
create trigger trg_serial_request_approved_ledger
after insert on public.technician_bags
for each row execute function public.trg_log_serial_request_approved();

-- Trigger: usage item means SN is used.
create or replace function public.trg_log_serial_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teknisi_id uuid;
begin
  if new.serial_number_id is null then
    return new;
  end if;
  select teknisi_id into v_teknisi_id from public.material_usages where id = new.usage_id;
  perform public.log_serial_movement(
    new.serial_number_id, new.material_id, 'USED', 'TEKNISI', 'USED', v_teknisi_id, v_teknisi_id,
    'material_usages', new.usage_id, new.id, 'Serial number dipakai teknisi', v_teknisi_id,
    jsonb_build_object('bag_id', new.bag_id, 'qty', new.qty)
  );
  return new;
end;
$$;

drop trigger if exists trg_serial_used_ledger on public.material_usage_items;
create trigger trg_serial_used_ledger
after insert on public.material_usage_items
for each row execute function public.trg_log_serial_used();

-- Trigger: return item means SN is requested for return.
create or replace function public.trg_log_serial_return_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teknisi_id uuid;
begin
  if new.serial_number_id is null then
    return new;
  end if;
  select teknisi_id into v_teknisi_id from public.material_returns where id = new.return_id;
  perform public.log_serial_movement(
    new.serial_number_id, new.material_id, 'RETURN_REQUESTED', 'TEKNISI', 'RETURN_PENDING', v_teknisi_id, null,
    'material_returns', new.return_id, new.id, 'Serial number diajukan untuk pengembalian', v_teknisi_id,
    jsonb_build_object('qty', new.qty, 'kondisi', new.kondisi)
  );
  return new;
end;
$$;

drop trigger if exists trg_serial_return_requested_ledger on public.material_return_items;
create trigger trg_serial_return_requested_ledger
after insert on public.material_return_items
for each row execute function public.trg_log_serial_return_requested();

-- Trigger: approval return changes SN RETURN_PENDING -> RETURNED/GUDANG.
create or replace function public.trg_log_serial_returned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_return record;
begin
  if old.status = 'RETURN_PENDING' and new.status = 'RETURNED' and new.location_type = 'GUDANG' then
    select mri.* into v_item
    from public.material_return_items mri
    join public.material_returns mr on mr.id = mri.return_id
    where mri.serial_number_id = new.id and mr.status = 'APPROVED'
    order by mr.approved_at desc nulls last, mri.created_at desc
    limit 1;

    if v_item.id is not null then
      select * into v_return from public.material_returns where id = v_item.return_id;
      perform public.log_serial_movement(
        new.id, new.material_id, 'RETURNED', 'RETURN_PENDING', 'GUDANG', v_return.teknisi_id, null,
        'material_returns', v_return.id, v_item.id, 'Serial number diterima kembali ke gudang', v_return.approved_by,
        jsonb_build_object('kondisi', new.kondisi)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_serial_returned_ledger on public.material_serial_numbers;
create trigger trg_serial_returned_ledger
after update on public.material_serial_numbers
for each row execute function public.trg_log_serial_returned();

-- Backfill existing data so current transactions can appear in detail modals.
insert into public.material_serial_movements(serial_number_id, material_id, movement_type, from_location_type, to_location_type, reference_type, reference_id, note, metadata, created_at)
select sn.id, sn.material_id, 'INBOUND', null, 'GUDANG', 'materials', sn.material_id, 'Backfill serial inbound', jsonb_build_object('status', sn.status, 'kondisi', sn.kondisi), sn.created_at
from public.material_serial_numbers sn
where not exists (
  select 1 from public.material_serial_movements m where m.serial_number_id = sn.id and m.movement_type = 'INBOUND'
);

insert into public.material_serial_movements(serial_number_id, material_id, movement_type, from_location_type, to_location_type, to_teknisi_id, reference_type, reference_id, reference_item_id, note, created_by, metadata, created_at)
select tb.serial_number_id, tb.material_id, 'REQUEST_APPROVED', 'GUDANG', 'TEKNISI', tb.teknisi_id, 'material_requests', tb.source_request_id,
       (select mri.id from public.material_request_items mri where mri.request_id = tb.source_request_id and mri.material_id = tb.material_id order by mri.created_at limit 1),
       'Backfill request approved serial', mr.approved_by, jsonb_build_object('bag_id', tb.id), tb.created_at
from public.technician_bags tb
join public.material_requests mr on mr.id = tb.source_request_id
where tb.serial_number_id is not null and tb.source_request_id is not null
  and not exists (
    select 1 from public.material_serial_movements m where m.serial_number_id = tb.serial_number_id and m.movement_type = 'REQUEST_APPROVED' and m.reference_id = tb.source_request_id
  );

insert into public.material_serial_movements(serial_number_id, material_id, movement_type, from_location_type, to_location_type, from_teknisi_id, to_teknisi_id, reference_type, reference_id, reference_item_id, note, created_by, metadata, created_at)
select mui.serial_number_id, mui.material_id, 'USED', 'TEKNISI', 'USED', mu.teknisi_id, mu.teknisi_id, 'material_usages', mu.id, mui.id, 'Backfill used serial', mu.teknisi_id, jsonb_build_object('bag_id', mui.bag_id, 'qty', mui.qty), mui.created_at
from public.material_usage_items mui
join public.material_usages mu on mu.id = mui.usage_id
where mui.serial_number_id is not null
  and not exists (
    select 1 from public.material_serial_movements m where m.serial_number_id = mui.serial_number_id and m.movement_type = 'USED' and m.reference_id = mu.id
  );

insert into public.material_serial_movements(serial_number_id, material_id, movement_type, from_location_type, to_location_type, from_teknisi_id, reference_type, reference_id, reference_item_id, note, created_by, metadata, created_at)
select mri.serial_number_id, mri.material_id, 'RETURN_REQUESTED', 'TEKNISI', 'RETURN_PENDING', mr.teknisi_id, 'material_returns', mr.id, mri.id, 'Backfill return requested serial', mr.teknisi_id, jsonb_build_object('qty', mri.qty, 'kondisi', mri.kondisi), mri.created_at
from public.material_return_items mri
join public.material_returns mr on mr.id = mri.return_id
where mri.serial_number_id is not null
  and not exists (
    select 1 from public.material_serial_movements m where m.serial_number_id = mri.serial_number_id and m.movement_type = 'RETURN_REQUESTED' and m.reference_id = mr.id
  );
