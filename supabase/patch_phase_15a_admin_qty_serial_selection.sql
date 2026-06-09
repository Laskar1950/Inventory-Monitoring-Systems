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
