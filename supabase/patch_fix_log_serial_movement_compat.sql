-- Fix helper untuk error input material:
-- function public.log_serial_movement(...) does not exist
-- Jalankan di Supabase SQL Editor, lalu coba input material ulang.
-- Note: material_serial_movement_detail di-drop dulu karena PostgreSQL tidak bisa
-- mengubah urutan/nama kolom view lama dengan CREATE OR REPLACE VIEW.

create table if not exists public.material_serial_movements (
  id uuid primary key default gen_random_uuid(),
  serial_number_id uuid references public.material_serial_numbers(id) on delete set null,
  material_id uuid references public.materials(id) on delete set null,
  from_status text,
  to_status text,
  from_location_type text,
  to_location_type text,
  from_teknisi_id uuid references public.profiles(id) on delete set null,
  to_teknisi_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  movement_type text,
  reference_type text,
  reference_id uuid,
  reference_item_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.material_serial_movements add column if not exists serial_number_id uuid references public.material_serial_numbers(id) on delete set null;
alter table public.material_serial_movements add column if not exists material_id uuid references public.materials(id) on delete set null;
alter table public.material_serial_movements add column if not exists from_status text;
alter table public.material_serial_movements add column if not exists to_status text;
alter table public.material_serial_movements add column if not exists from_location_type text;
alter table public.material_serial_movements add column if not exists to_location_type text;
alter table public.material_serial_movements add column if not exists from_teknisi_id uuid references public.profiles(id) on delete set null;
alter table public.material_serial_movements add column if not exists to_teknisi_id uuid references public.profiles(id) on delete set null;
alter table public.material_serial_movements add column if not exists actor_id uuid references public.profiles(id) on delete set null;
alter table public.material_serial_movements add column if not exists movement_type text;
alter table public.material_serial_movements add column if not exists reference_type text;
alter table public.material_serial_movements add column if not exists reference_id uuid;
alter table public.material_serial_movements add column if not exists reference_item_id uuid;
alter table public.material_serial_movements add column if not exists notes text;
alter table public.material_serial_movements add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.material_serial_movements add column if not exists created_at timestamptz not null default now();

create index if not exists idx_serial_movements_serial on public.material_serial_movements(serial_number_id);
create index if not exists idx_serial_movements_material on public.material_serial_movements(material_id);
create index if not exists idx_serial_movements_reference on public.material_serial_movements(reference_type, reference_id);

create or replace function public.log_serial_movement(
  p_serial_number_id uuid,
  p_material_id uuid,
  p_from_status text default null,
  p_to_status text default null,
  p_to_location_type public.location_type default null,
  p_from_location_type text default null,
  p_actor_id uuid default null,
  p_movement_type text default null,
  p_reference_id uuid default null,
  p_reference_type text default null,
  p_reference_item_id text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_reference_item_id uuid;
begin
  if p_reference_item_id is not null and p_reference_item_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_reference_item_id := p_reference_item_id::uuid;
  end if;

  insert into public.material_serial_movements(
    serial_number_id,
    material_id,
    from_status,
    to_status,
    from_location_type,
    to_location_type,
    actor_id,
    movement_type,
    reference_type,
    reference_id,
    reference_item_id,
    notes,
    metadata
  ) values (
    p_serial_number_id,
    p_material_id,
    p_from_status,
    p_to_status,
    p_from_location_type,
    p_to_location_type::text,
    p_actor_id,
    coalesce(p_movement_type, 'SERIAL_MOVEMENT'),
    p_reference_type,
    p_reference_id,
    v_reference_item_id,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

drop view if exists public.material_serial_movement_detail;

create view public.material_serial_movement_detail as
select
  msm.id,
  msm.serial_number_id,
  msn.serial_number,
  msm.material_id,
  m.material_code,
  m.nama as material_nama,
  msm.from_status,
  msm.to_status,
  msm.from_location_type,
  msm.to_location_type,
  msm.from_teknisi_id,
  ft.nama as from_teknisi_nama,
  msm.to_teknisi_id,
  tt.nama as to_teknisi_nama,
  msm.actor_id,
  ap.nama as actor_nama,
  msm.movement_type,
  msm.reference_type,
  msm.reference_id,
  msm.reference_item_id,
  msm.notes,
  msm.metadata,
  msm.created_at
from public.material_serial_movements msm
left join public.material_serial_numbers msn on msn.id = msm.serial_number_id
left join public.materials m on m.id = msm.material_id
left join public.profiles ft on ft.id = msm.from_teknisi_id
left join public.profiles tt on tt.id = msm.to_teknisi_id
left join public.profiles ap on ap.id = msm.actor_id;
