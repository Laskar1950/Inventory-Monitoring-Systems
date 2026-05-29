-- PLN ICON PLUS Inventory Monitoring Systems
-- Phase 1-3 database schema: foundation, auth profiles, master material, stock, serial number.

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================
do $$ begin
  create type public.user_role as enum ('TEKNISI', 'ADMIN', 'SUPERVISOR');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.location_type as enum ('GUDANG', 'TEKNISI');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.serial_status as enum ('AVAILABLE', 'IN_TECHNICIAN_BAG', 'USED', 'RETURN_PENDING', 'RETURNED', 'SO_PENDING', 'LOST', 'DAMAGED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'REVISION', 'REJECTED_FINAL', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null;
end $$;

-- =========================
-- UTILITY
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- PROFILES
-- =========================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  nama text not null,
  email text not null,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- =========================
-- MASTER MATERIAL
-- =========================
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  material_code text not null unique,
  nama text not null,
  merk text not null,
  satuan text not null,
  kondisi_default text not null,
  min_stock integer not null default 0 check (min_stock >= 0),
  wajib_sn boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_materials_updated_at on public.materials;
create trigger trg_materials_updated_at before update on public.materials for each row execute function public.set_updated_at();

create table if not exists public.material_stocks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete restrict,
  location_type public.location_type not null default 'GUDANG',
  teknisi_id uuid references public.profiles(id),
  qty integer not null default 0 check (qty >= 0),
  kondisi text not null default 'BAIK',
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_stocks_location_check check (
    (location_type = 'GUDANG' and teknisi_id is null) or
    (location_type = 'TEKNISI' and teknisi_id is not null)
  )
);

drop trigger if exists trg_material_stocks_updated_at on public.material_stocks;
create trigger trg_material_stocks_updated_at before update on public.material_stocks for each row execute function public.set_updated_at();

create table if not exists public.material_serial_numbers (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete restrict,
  stock_id uuid references public.material_stocks(id) on delete set null,
  serial_number text not null unique,
  status public.serial_status not null default 'AVAILABLE',
  location_type public.location_type not null default 'GUDANG',
  teknisi_id uuid references public.profiles(id),
  kondisi text not null default 'BAIK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_serial_location_check check (
    (location_type = 'GUDANG' and teknisi_id is null) or
    (location_type = 'TEKNISI' and teknisi_id is not null)
  )
);

drop trigger if exists trg_material_serial_numbers_updated_at on public.material_serial_numbers;
create trigger trg_material_serial_numbers_updated_at before update on public.material_serial_numbers for each row execute function public.set_updated_at();

-- =========================
-- TRANSACTION TABLES - foundation for next phases
-- =========================
create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  teknisi_id uuid not null references public.profiles(id),
  status public.transaction_status not null default 'PENDING',
  catatan_teknisi text,
  catatan_admin text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_requests(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  qty_requested integer not null check (qty_requested > 0),
  qty_approved integer check (qty_approved is null or qty_approved >= 0),
  serial_number_id uuid references public.material_serial_numbers(id),
  status public.transaction_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table if not exists public.technician_bags (
  id uuid primary key default gen_random_uuid(),
  teknisi_id uuid not null references public.profiles(id),
  material_id uuid not null references public.materials(id),
  serial_number_id uuid references public.material_serial_numbers(id),
  qty integer not null check (qty >= 0),
  kondisi text not null default 'BAIK',
  source_request_id uuid references public.material_requests(id),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_usages (
  id uuid primary key default gen_random_uuid(),
  usage_code text not null unique,
  teknisi_id uuid not null references public.profiles(id),
  no_tiket text not null,
  nama_pelanggan text,
  id_pelanggan text,
  alamat text,
  root_cause text,
  foto_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_usage_items (
  id uuid primary key default gen_random_uuid(),
  usage_id uuid not null references public.material_usages(id) on delete cascade,
  bag_id uuid references public.technician_bags(id),
  material_id uuid not null references public.materials(id),
  serial_number_id uuid references public.material_serial_numbers(id),
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.material_returns (
  id uuid primary key default gen_random_uuid(),
  return_code text not null unique,
  teknisi_id uuid not null references public.profiles(id),
  source_type text not null check (source_type in ('BAG', 'MANUAL')),
  status public.transaction_status not null default 'PENDING',
  kondisi text not null,
  qty_return integer not null check (qty_return > 0),
  foto_url text not null,
  keterangan text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.material_returns(id) on delete cascade,
  bag_id uuid references public.technician_bags(id),
  material_id uuid references public.materials(id),
  serial_number_id uuid references public.material_serial_numbers(id),
  qty integer not null check (qty > 0),
  kondisi text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_opnames (
  id uuid primary key default gen_random_uuid(),
  so_code text not null unique,
  teknisi_id uuid not null references public.profiles(id),
  status public.transaction_status not null default 'PENDING',
  catatan_teknisi text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_opname_items (
  id uuid primary key default gen_random_uuid(),
  stock_opname_id uuid not null references public.stock_opnames(id) on delete cascade,
  bag_id uuid references public.technician_bags(id),
  material_id uuid not null references public.materials(id),
  serial_number_id uuid references public.material_serial_numbers(id),
  qty_system integer not null check (qty_system >= 0),
  qty_physical integer not null check (qty_physical >= 0),
  selisih integer generated always as (qty_physical - qty_system) stored,
  kondisi_fisik text not null,
  foto_url text not null,
  status_review public.transaction_status not null default 'PENDING',
  catatan_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Updated_at triggers for transaction headers/items with updated_at column
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['material_requests','technician_bags','material_usages','material_returns','stock_opnames','stock_opname_items']
  LOOP
    EXECUTE format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    EXECUTE format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- =========================
-- VIEWS
-- =========================
create or replace view public.materials_with_stock as
select
  m.*,
  coalesce(sum(ms.qty) filter (where ms.location_type = 'GUDANG'), 0)::integer as gudang_qty,
  count(sn.id)::integer as serial_count
from public.materials m
left join public.material_stocks ms on ms.material_id = m.id
left join public.material_serial_numbers sn on sn.material_id = m.id
group by m.id;

-- =========================
-- TRANSACTIONAL RPC - MASTER MATERIAL
-- =========================
create or replace function public.create_material_with_initial_stock(
  p_material_code text,
  p_nama text,
  p_merk text,
  p_satuan text,
  p_kondisi_default text,
  p_min_stock integer,
  p_wajib_sn boolean,
  p_qty_awal integer,
  p_serial_numbers text[],
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material_id uuid;
  v_stock_id uuid;
  v_sn text;
  v_distinct_count integer;
  v_total_count integer;
begin
  p_material_code := upper(trim(p_material_code));
  p_satuan := upper(trim(p_satuan));
  p_kondisi_default := upper(trim(p_kondisi_default));

  if p_material_code is null or p_material_code = '' then
    raise exception 'Material ID wajib diisi.';
  end if;
  if p_nama is null or trim(p_nama) = '' then
    raise exception 'Nama material wajib diisi.';
  end if;
  if p_merk is null or trim(p_merk) = '' then
    raise exception 'Merk wajib diisi.';
  end if;
  if p_min_stock < 0 then
    raise exception 'Minimum stok tidak boleh negatif.';
  end if;

  if exists (select 1 from public.materials where material_code = p_material_code) then
    raise exception 'Material ID % sudah terdaftar.', p_material_code;
  end if;

  if p_wajib_sn then
    select count(*), count(distinct upper(trim(x)))
    into v_total_count, v_distinct_count
    from unnest(coalesce(p_serial_numbers, array[]::text[])) x
    where upper(trim(x)) <> '';

    if v_total_count = 0 then
      raise exception 'Material wajib SN minimal harus memiliki satu serial number.';
    end if;
    if v_total_count <> v_distinct_count then
      raise exception 'Serial number duplikat di form.';
    end if;
    if exists (
      select 1
      from public.material_serial_numbers msn
      where msn.serial_number in (
        select upper(trim(x)) from unnest(p_serial_numbers) x where upper(trim(x)) <> ''
      )
    ) then
      raise exception 'Serial number sudah terdaftar di database.';
    end if;
    p_qty_awal := v_total_count;
  else
    if p_qty_awal < 0 then
      raise exception 'Qty awal tidak boleh negatif.';
    end if;
  end if;

  insert into public.materials (material_code, nama, merk, satuan, kondisi_default, min_stock, wajib_sn, created_by)
  values (p_material_code, trim(p_nama), trim(p_merk), p_satuan, p_kondisi_default, p_min_stock, p_wajib_sn, p_created_by)
  returning id into v_material_id;

  insert into public.material_stocks (material_id, location_type, teknisi_id, qty, kondisi, status)
  values (v_material_id, 'GUDANG', null, p_qty_awal, p_kondisi_default, 'AVAILABLE')
  returning id into v_stock_id;

  if p_wajib_sn then
    foreach v_sn in array p_serial_numbers
    loop
      v_sn := upper(trim(v_sn));
      if v_sn <> '' then
        insert into public.material_serial_numbers (material_id, stock_id, serial_number, status, location_type, teknisi_id, kondisi)
        values (v_material_id, v_stock_id, v_sn, 'AVAILABLE', 'GUDANG', null, p_kondisi_default);
      end if;
    end loop;
  end if;

  insert into public.activity_logs (actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  select p_created_by, pr.role, 'CREATE_MATERIAL', 'materials', v_material_id,
         'Admin membuat material ' || p_material_code,
         jsonb_build_object('wajib_sn', p_wajib_sn, 'qty_awal', p_qty_awal)
  from public.profiles pr
  where pr.id = p_created_by;

  return v_material_id;
end;
$$;

-- =========================
-- TRANSACTION CODE GENERATOR FOUNDATION
-- =========================
create table if not exists public.transaction_sequences (
  seq_date date not null,
  prefix text not null,
  last_number integer not null default 0,
  primary key (seq_date, prefix)
);

create or replace function public.generate_transaction_code(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := current_date;
  v_number integer;
begin
  insert into public.transaction_sequences(seq_date, prefix, last_number)
  values (v_date, p_prefix, 1)
  on conflict (seq_date, prefix)
  do update set last_number = public.transaction_sequences.last_number + 1
  returning last_number into v_number;

  return p_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_number::text, 4, '0');
end;
$$;

-- =========================
-- RLS BASIC
-- =========================
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.material_stocks enable row level security;
alter table public.material_serial_numbers enable row level security;
alter table public.material_requests enable row level security;
alter table public.material_request_items enable row level security;
alter table public.technician_bags enable row level security;
alter table public.material_usages enable row level security;
alter table public.material_usage_items enable row level security;
alter table public.material_returns enable row level security;
alter table public.material_return_items enable row level security;
alter table public.stock_opnames enable row level security;
alter table public.stock_opname_items enable row level security;
alter table public.activity_logs enable row level security;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() and is_active = true limit 1;
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid() and is_active = true limit 1;
$$;

-- Drop old policies to keep script re-runnable
DO $$
DECLARE r record;
BEGIN
  FOR r IN select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

create policy "profiles_select_own_or_admin_supervisor" on public.profiles
for select using (
  auth_user_id = auth.uid() or public.current_role() in ('ADMIN', 'SUPERVISOR')
);

create policy "materials_read_authenticated" on public.materials
for select using (auth.role() = 'authenticated');

create policy "stocks_read_authenticated" on public.material_stocks
for select using (auth.role() = 'authenticated');

create policy "serials_read_authenticated" on public.material_serial_numbers
for select using (auth.role() = 'authenticated');

create policy "requests_read_by_role" on public.material_requests
for select using (
  public.current_role() in ('ADMIN', 'SUPERVISOR') or teknisi_id = public.current_profile_id()
);

create policy "bags_read_by_role" on public.technician_bags
for select using (
  public.current_role() in ('ADMIN', 'SUPERVISOR') or teknisi_id = public.current_profile_id()
);

create policy "usages_read_by_role" on public.material_usages
for select using (
  public.current_role() in ('ADMIN', 'SUPERVISOR') or teknisi_id = public.current_profile_id()
);

create policy "returns_read_by_role" on public.material_returns
for select using (
  public.current_role() in ('ADMIN', 'SUPERVISOR') or teknisi_id = public.current_profile_id()
);

create policy "stock_opnames_read_by_role" on public.stock_opnames
for select using (
  public.current_role() in ('ADMIN', 'SUPERVISOR') or teknisi_id = public.current_profile_id()
);

create policy "activity_logs_read_admin_supervisor" on public.activity_logs
for select using (public.current_role() in ('ADMIN', 'SUPERVISOR'));

-- Mutations are intentionally performed through validated server routes / security definer RPC in this phase.


-- =========================
-- PHASE 4 - REQUEST MATERIAL, APPROVAL, TAS TEKNISI
-- Re-runnable patch. Safe to execute after the base schema.
-- =========================

create or replace view public.material_request_summary as
select
  mr.id,
  mr.request_code,
  mr.teknisi_id,
  p.nama as teknisi_nama,
  mr.status,
  mr.catatan_teknisi,
  mr.catatan_admin,
  mr.approved_by,
  ap.nama as approved_by_nama,
  mr.approved_at,
  mr.created_at,
  mr.updated_at,
  count(mri.id)::integer as item_count,
  coalesce(sum(mri.qty_requested), 0)::integer as total_qty
from public.material_requests mr
join public.profiles p on p.id = mr.teknisi_id
left join public.profiles ap on ap.id = mr.approved_by
left join public.material_request_items mri on mri.request_id = mr.id
group by mr.id, p.nama, ap.nama;

create or replace view public.technician_bag_summary as
select
  tb.id,
  tb.teknisi_id,
  p.nama as teknisi_nama,
  tb.material_id,
  m.material_code,
  m.nama as material_nama,
  m.merk,
  m.satuan,
  m.wajib_sn,
  tb.serial_number_id,
  msn.serial_number,
  tb.qty,
  tb.kondisi,
  tb.source_request_id,
  mr.request_code as source_request_code,
  tb.status,
  tb.created_at,
  tb.updated_at
from public.technician_bags tb
join public.profiles p on p.id = tb.teknisi_id
join public.materials m on m.id = tb.material_id
left join public.material_serial_numbers msn on msn.id = tb.serial_number_id
left join public.material_requests mr on mr.id = tb.source_request_id;

create or replace function public.create_material_request(
  p_teknisi_id uuid,
  p_catatan_teknisi text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_request_code text;
  v_item jsonb;
  v_material_id uuid;
  v_qty integer;
  v_available integer;
  v_profile_role public.user_role;
  v_material record;
begin
  select role into v_profile_role from public.profiles where id = p_teknisi_id and is_active = true;
  if v_profile_role is distinct from 'TEKNISI' then
    raise exception 'Hanya teknisi aktif yang boleh membuat request.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Request minimal memiliki satu item.';
  end if;

  -- validate first, before inserting anything
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_material_id := nullif(v_item->>'material_id', '')::uuid;
    v_qty := coalesce((v_item->>'qty')::integer, 0);
    if v_material_id is null then
      raise exception 'Material wajib dipilih.';
    end if;
    if v_qty <= 0 then
      raise exception 'Qty wajib lebih dari 0.';
    end if;

    select * into v_material from public.materials where id = v_material_id and is_active = true;
    if v_material.id is null then
      raise exception 'Material tidak ditemukan atau tidak aktif.';
    end if;

    select coalesce(sum(qty),0)::integer into v_available
    from public.material_stocks
    where material_id = v_material_id and location_type = 'GUDANG' and status = 'AVAILABLE';

    if v_qty > v_available then
      raise exception 'Stok gudang tidak cukup untuk material %.', v_material.material_code;
    end if;
  end loop;

  v_request_code := public.generate_transaction_code('REQ');

  insert into public.material_requests(request_code, teknisi_id, status, catatan_teknisi)
  values (v_request_code, p_teknisi_id, 'PENDING', nullif(trim(coalesce(p_catatan_teknisi,'')), ''))
  returning id into v_request_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_material_id := (v_item->>'material_id')::uuid;
    v_qty := (v_item->>'qty')::integer;

    insert into public.material_request_items(request_id, material_id, qty_requested, status)
    values (v_request_id, v_material_id, v_qty, 'PENDING');
  end loop;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_teknisi_id, 'TEKNISI', 'CREATE_REQUEST', 'material_requests', v_request_id,
          'Teknisi membuat request material ' || v_request_code,
          jsonb_build_object('item_count', jsonb_array_length(p_items)));

  return v_request_id;
end;
$$;

create or replace function public.approve_material_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_catatan_admin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role public.user_role;
  v_request record;
  v_item record;
  v_stock record;
  v_material record;
  v_sn record;
  v_sn_count integer;
begin
  select role into v_admin_role from public.profiles where id = p_admin_id and is_active = true;
  if v_admin_role is distinct from 'ADMIN' then
    raise exception 'Hanya Admin Gudang yang boleh approval request.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'Request tidak ditemukan.';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Request sudah diproses dan tidak boleh diproses dua kali.';
  end if;

  for v_item in
    select mri.*, m.material_code, m.nama, m.wajib_sn
    from public.material_request_items mri
    join public.materials m on m.id = mri.material_id
    where mri.request_id = p_request_id
    order by mri.created_at
  loop
    select * into v_stock
    from public.material_stocks
    where material_id = v_item.material_id and location_type = 'GUDANG' and status = 'AVAILABLE'
    order by created_at
    limit 1
    for update;

    if v_stock.id is null or v_stock.qty < v_item.qty_requested then
      raise exception 'Stok gudang tidak cukup untuk material %.', v_item.material_code;
    end if;

    if v_item.wajib_sn then
      select count(*) into v_sn_count
      from (
        select id
        from public.material_serial_numbers
        where material_id = v_item.material_id
          and status = 'AVAILABLE'
          and location_type = 'GUDANG'
        order by created_at
        limit v_item.qty_requested
        for update
      ) s;

      if v_sn_count < v_item.qty_requested then
        raise exception 'Serial number tersedia tidak cukup untuk material %.', v_item.material_code;
      end if;

      for v_sn in
        select *
        from public.material_serial_numbers
        where material_id = v_item.material_id
          and status = 'AVAILABLE'
          and location_type = 'GUDANG'
        order by created_at
        limit v_item.qty_requested
        for update
      loop
        update public.material_serial_numbers
        set status = 'IN_TECHNICIAN_BAG', location_type = 'TEKNISI', teknisi_id = v_request.teknisi_id, stock_id = null
        where id = v_sn.id;

        insert into public.technician_bags(teknisi_id, material_id, serial_number_id, qty, kondisi, source_request_id, status)
        values (v_request.teknisi_id, v_item.material_id, v_sn.id, 1, v_sn.kondisi, p_request_id, 'ACTIVE');
      end loop;
    else
      insert into public.technician_bags(teknisi_id, material_id, serial_number_id, qty, kondisi, source_request_id, status)
      values (v_request.teknisi_id, v_item.material_id, null, v_item.qty_requested, v_stock.kondisi, p_request_id, 'ACTIVE')
      on conflict do nothing;
    end if;

    update public.material_stocks
    set qty = qty - v_item.qty_requested
    where id = v_stock.id;

    update public.material_request_items
    set qty_approved = v_item.qty_requested, status = 'APPROVED'
    where id = v_item.id;
  end loop;

  update public.material_requests
  set status = 'APPROVED', catatan_admin = nullif(trim(coalesce(p_catatan_admin,'')), ''), approved_by = p_admin_id, approved_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_admin_id, 'ADMIN', 'APPROVE_REQUEST', 'material_requests', p_request_id,
          'Admin menyetujui request material ' || v_request.request_code,
          jsonb_build_object('request_code', v_request.request_code));

  return p_request_id;
end;
$$;

create or replace function public.reject_material_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_catatan_admin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role public.user_role;
  v_request record;
begin
  select role into v_admin_role from public.profiles where id = p_admin_id and is_active = true;
  if v_admin_role is distinct from 'ADMIN' then
    raise exception 'Hanya Admin Gudang yang boleh reject request.';
  end if;

  select * into v_request from public.material_requests where id = p_request_id for update;
  if v_request.id is null then
    raise exception 'Request tidak ditemukan.';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Request sudah diproses dan tidak boleh diproses dua kali.';
  end if;

  update public.material_request_items
  set qty_approved = 0, status = 'REJECTED'
  where request_id = p_request_id;

  update public.material_requests
  set status = 'REJECTED', catatan_admin = nullif(trim(coalesce(p_catatan_admin,'')), ''), approved_by = p_admin_id, approved_at = now()
  where id = p_request_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_admin_id, 'ADMIN', 'REJECT_REQUEST', 'material_requests', p_request_id,
          'Admin menolak request material ' || v_request.request_code,
          jsonb_build_object('request_code', v_request.request_code, 'catatan_admin', p_catatan_admin));

  return p_request_id;
end;
$$;

-- =========================
-- PHASE 5 - PENGGUNAAN MATERIAL
-- Penggunaan material dari Tas Teknisi, upload eviden, pengurangan stok tas, laporan pemakaian.
-- =========================

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
  string_agg(distinct (m.material_code || ' - ' || m.nama), ', ' order by (m.material_code || ' - ' || m.nama)) as materials_used
from public.material_usages mu
join public.profiles p on p.id = mu.teknisi_id
left join public.material_usage_items mui on mui.usage_id = mu.id
left join public.materials m on m.id = mui.material_id
group by mu.id, p.nama;

create or replace function public.create_material_usage(
  p_teknisi_id uuid,
  p_no_tiket text,
  p_nama_pelanggan text,
  p_id_pelanggan text,
  p_alamat text,
  p_root_cause text,
  p_foto_url text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_id uuid;
  v_usage_code text;
  v_item jsonb;
  v_bag_id uuid;
  v_qty integer;
  v_bag record;
  v_profile_role public.user_role;
begin
  select role into v_profile_role from public.profiles where id = p_teknisi_id and is_active = true;
  if v_profile_role is distinct from 'TEKNISI' then
    raise exception 'Hanya teknisi aktif yang boleh mencatat penggunaan material.';
  end if;

  if p_no_tiket is null or trim(p_no_tiket) = '' then
    raise exception 'Nomor tiket wajib diisi.';
  end if;
  if p_root_cause is null or trim(p_root_cause) = '' then
    raise exception 'Root cause wajib diisi.';
  end if;
  if p_foto_url is null or trim(p_foto_url) = '' then
    raise exception 'Foto eviden wajib diupload.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal satu material harus ditambahkan.';
  end if;

  -- Validate all items first under row locks, so partial usage cannot happen.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_bag_id := nullif(v_item->>'bag_id', '')::uuid;
    v_qty := coalesce((v_item->>'qty')::integer, 0);

    if v_bag_id is null then
      raise exception 'Material dari tas wajib dipilih.';
    end if;
    if v_qty <= 0 then
      raise exception 'Qty penggunaan wajib lebih dari 0.';
    end if;

    select tb.*, m.material_code, m.nama as material_nama, m.wajib_sn
    into v_bag
    from public.technician_bags tb
    join public.materials m on m.id = tb.material_id
    where tb.id = v_bag_id
    for update;

    if v_bag.id is null then
      raise exception 'Material tas tidak ditemukan.';
    end if;
    if v_bag.teknisi_id <> p_teknisi_id then
      raise exception 'Teknisi hanya boleh menggunakan material dari tasnya sendiri.';
    end if;
    if v_bag.status <> 'ACTIVE' then
      raise exception 'Material % sudah tidak aktif di tas teknisi.', v_bag.material_code;
    end if;
    if v_qty > v_bag.qty then
      raise exception 'Qty penggunaan material % melebihi stok tas.', v_bag.material_code;
    end if;
    if v_bag.wajib_sn and v_qty <> 1 then
      raise exception 'Material berserial % hanya boleh digunakan qty 1.', v_bag.material_code;
    end if;
  end loop;

  v_usage_code := public.generate_transaction_code('USE');

  insert into public.material_usages(
    usage_code, teknisi_id, no_tiket, nama_pelanggan, id_pelanggan, alamat, root_cause, foto_url
  ) values (
    v_usage_code,
    p_teknisi_id,
    upper(trim(p_no_tiket)),
    nullif(trim(coalesce(p_nama_pelanggan,'')), ''),
    nullif(trim(coalesce(p_id_pelanggan,'')), ''),
    nullif(trim(coalesce(p_alamat,'')), ''),
    trim(p_root_cause),
    trim(p_foto_url)
  ) returning id into v_usage_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_bag_id := (v_item->>'bag_id')::uuid;
    v_qty := (v_item->>'qty')::integer;

    select tb.*, m.material_code, m.wajib_sn
    into v_bag
    from public.technician_bags tb
    join public.materials m on m.id = tb.material_id
    where tb.id = v_bag_id
    for update;

    insert into public.material_usage_items(usage_id, bag_id, material_id, serial_number_id, qty)
    values (v_usage_id, v_bag.id, v_bag.material_id, v_bag.serial_number_id, v_qty);

    update public.technician_bags
    set qty = qty - v_qty,
        status = case when qty - v_qty <= 0 then 'USED' else status end
    where id = v_bag.id;

    if v_bag.serial_number_id is not null then
      update public.material_serial_numbers
      set status = 'USED', location_type = 'TEKNISI', teknisi_id = p_teknisi_id
      where id = v_bag.serial_number_id;
    end if;
  end loop;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_teknisi_id, 'TEKNISI', 'CREATE_USAGE', 'material_usages', v_usage_id,
          'Teknisi mencatat penggunaan material ' || v_usage_code,
          jsonb_build_object('usage_code', v_usage_code, 'no_tiket', upper(trim(p_no_tiket)), 'item_count', jsonb_array_length(p_items)));

  return v_usage_id;
end;
$$;

-- Phase 5 hardening: aggregate duplicate bag rows in backend validation.
create or replace function public.create_material_usage(
  p_teknisi_id uuid,
  p_no_tiket text,
  p_nama_pelanggan text,
  p_id_pelanggan text,
  p_alamat text,
  p_root_cause text,
  p_foto_url text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_id uuid;
  v_usage_code text;
  v_row record;
  v_bag record;
  v_profile_role public.user_role;
begin
  select role into v_profile_role from public.profiles where id = p_teknisi_id and is_active = true;
  if v_profile_role is distinct from 'TEKNISI' then
    raise exception 'Hanya teknisi aktif yang boleh mencatat penggunaan material.';
  end if;

  if p_no_tiket is null or trim(p_no_tiket) = '' then
    raise exception 'Nomor tiket wajib diisi.';
  end if;
  if p_root_cause is null or trim(p_root_cause) = '' then
    raise exception 'Root cause wajib diisi.';
  end if;
  if p_foto_url is null or trim(p_foto_url) = '' then
    raise exception 'Foto eviden wajib diupload.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal satu material harus ditambahkan.';
  end if;

  for v_row in
    select
      nullif(item->>'bag_id', '')::uuid as bag_id,
      sum(coalesce((item->>'qty')::integer, 0))::integer as qty
    from jsonb_array_elements(p_items) item
    group by nullif(item->>'bag_id', '')::uuid
  loop
    if v_row.bag_id is null then
      raise exception 'Material dari tas wajib dipilih.';
    end if;
    if v_row.qty <= 0 then
      raise exception 'Qty penggunaan wajib lebih dari 0.';
    end if;

    select tb.*, m.material_code, m.nama as material_nama, m.wajib_sn
    into v_bag
    from public.technician_bags tb
    join public.materials m on m.id = tb.material_id
    where tb.id = v_row.bag_id
    for update;

    if v_bag.id is null then
      raise exception 'Material tas tidak ditemukan.';
    end if;
    if v_bag.teknisi_id <> p_teknisi_id then
      raise exception 'Teknisi hanya boleh menggunakan material dari tasnya sendiri.';
    end if;
    if v_bag.status <> 'ACTIVE' then
      raise exception 'Material % sudah tidak aktif di tas teknisi.', v_bag.material_code;
    end if;
    if v_row.qty > v_bag.qty then
      raise exception 'Qty penggunaan material % melebihi stok tas.', v_bag.material_code;
    end if;
    if v_bag.wajib_sn and v_row.qty <> 1 then
      raise exception 'Material berserial % hanya boleh digunakan qty 1.', v_bag.material_code;
    end if;
  end loop;

  v_usage_code := public.generate_transaction_code('USE');

  insert into public.material_usages(
    usage_code, teknisi_id, no_tiket, nama_pelanggan, id_pelanggan, alamat, root_cause, foto_url
  ) values (
    v_usage_code,
    p_teknisi_id,
    upper(trim(p_no_tiket)),
    nullif(trim(coalesce(p_nama_pelanggan,'')), ''),
    nullif(trim(coalesce(p_id_pelanggan,'')), ''),
    nullif(trim(coalesce(p_alamat,'')), ''),
    trim(p_root_cause),
    trim(p_foto_url)
  ) returning id into v_usage_id;

  for v_row in
    select
      nullif(item->>'bag_id', '')::uuid as bag_id,
      sum(coalesce((item->>'qty')::integer, 0))::integer as qty
    from jsonb_array_elements(p_items) item
    group by nullif(item->>'bag_id', '')::uuid
  loop
    select tb.*, m.material_code, m.wajib_sn
    into v_bag
    from public.technician_bags tb
    join public.materials m on m.id = tb.material_id
    where tb.id = v_row.bag_id
    for update;

    insert into public.material_usage_items(usage_id, bag_id, material_id, serial_number_id, qty)
    values (v_usage_id, v_bag.id, v_bag.material_id, v_bag.serial_number_id, v_row.qty);

    update public.technician_bags
    set qty = qty - v_row.qty,
        status = case when qty - v_row.qty <= 0 then 'USED' else status end
    where id = v_bag.id;

    if v_bag.serial_number_id is not null then
      update public.material_serial_numbers
      set status = 'USED', location_type = 'TEKNISI', teknisi_id = p_teknisi_id
      where id = v_bag.serial_number_id;
    end if;
  end loop;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_teknisi_id, 'TEKNISI', 'CREATE_USAGE', 'material_usages', v_usage_id,
          'Teknisi mencatat penggunaan material ' || v_usage_code,
          jsonb_build_object('usage_code', v_usage_code, 'no_tiket', upper(trim(p_no_tiket)), 'item_count', jsonb_array_length(p_items)));

  return v_usage_id;
end;
$$;

-- =========================
-- PHASE 6 - PENGEMBALIAN MATERIAL
-- Return dari tas teknisi, return manual, upload eviden, approval admin, update stok gudang/SN secara atomic.
-- =========================

alter table public.material_returns add column if not exists catatan_admin text;
alter table public.material_return_items add column if not exists manual_material_code text;
alter table public.material_return_items add column if not exists manual_nama text;
alter table public.material_return_items add column if not exists manual_merk text;
alter table public.material_return_items add column if not exists manual_satuan text;
alter table public.material_return_items add column if not exists manual_wajib_sn boolean;
alter table public.material_return_items add column if not exists manual_serial_number text;

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
  string_agg(distinct coalesce(m.material_code || ' - ' || m.nama, mri.manual_material_code || ' - ' || mri.manual_nama), ', ' order by coalesce(m.material_code || ' - ' || m.nama, mri.manual_material_code || ' - ' || mri.manual_nama)) as materials_returned
from public.material_returns mr
join public.profiles p on p.id = mr.teknisi_id
left join public.profiles ap on ap.id = mr.approved_by
left join public.material_return_items mri on mri.return_id = mr.id
left join public.materials m on m.id = mri.material_id
group by mr.id, p.nama, ap.nama;

create or replace function public.create_material_return(
  p_teknisi_id uuid,
  p_source_type text,
  p_kondisi text,
  p_foto_url text,
  p_keterangan text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return_id uuid;
  v_return_code text;
  v_row jsonb;
  v_bag record;
  v_profile_role public.user_role;
  v_qty integer;
  v_total_qty integer := 0;
  v_source_type text := upper(trim(coalesce(p_source_type, '')));
  v_material_id uuid;
  v_material_code text;
  v_manual_sn text;
begin
  select role into v_profile_role from public.profiles where id = p_teknisi_id and is_active = true;
  if v_profile_role is distinct from 'TEKNISI' then
    raise exception 'Hanya teknisi aktif yang boleh mengirim pengembalian material.';
  end if;

  if v_source_type not in ('BAG', 'MANUAL') then
    raise exception 'Sumber pengembalian tidak valid.';
  end if;
  if p_kondisi is null or trim(p_kondisi) = '' then
    raise exception 'Kondisi material wajib dipilih.';
  end if;
  if p_foto_url is null or trim(p_foto_url) = '' then
    raise exception 'Foto material wajib diupload.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal satu material pengembalian harus ditambahkan.';
  end if;

  if v_source_type = 'BAG' then
    for v_row in select * from jsonb_array_elements(p_items)
    loop
      v_qty := coalesce((v_row->>'qty')::integer, 0);
      if nullif(v_row->>'bag_id', '') is null then
        raise exception 'Material dari tas wajib dipilih.';
      end if;
      if v_qty <= 0 then
        raise exception 'Qty return wajib lebih dari 0.';
      end if;

      select tb.*, m.material_code, m.nama as material_nama, m.wajib_sn
      into v_bag
      from public.technician_bags tb
      join public.materials m on m.id = tb.material_id
      where tb.id = (v_row->>'bag_id')::uuid
      for update;

      if v_bag.id is null then
        raise exception 'Material tas tidak ditemukan.';
      end if;
      if v_bag.teknisi_id <> p_teknisi_id then
        raise exception 'Teknisi hanya boleh mengembalikan material dari tasnya sendiri.';
      end if;
      if v_bag.status <> 'ACTIVE' then
        raise exception 'Material % sudah tidak aktif di tas teknisi.', v_bag.material_code;
      end if;
      if v_qty > v_bag.qty then
        raise exception 'Qty return material % melebihi stok tas.', v_bag.material_code;
      end if;
      if v_bag.wajib_sn and v_qty <> 1 then
        raise exception 'Material berserial % hanya boleh qty 1 per pengajuan.', v_bag.material_code;
      end if;
      v_total_qty := v_total_qty + v_qty;
    end loop;
  else
    for v_row in select * from jsonb_array_elements(p_items)
    loop
      v_qty := coalesce((v_row->>'qty')::integer, 0);
      v_material_code := upper(trim(coalesce(v_row->>'material_code', '')));
      v_manual_sn := upper(trim(coalesce(v_row->>'serial_number', '')));
      if v_material_code = '' or trim(coalesce(v_row->>'nama', '')) = '' or trim(coalesce(v_row->>'merk', '')) = '' or trim(coalesce(v_row->>'satuan', '')) = '' then
        raise exception 'Material ID, nama material, merk, dan satuan wajib diisi untuk return manual.';
      end if;
      if v_qty <= 0 then
        raise exception 'Qty return wajib lebih dari 0.';
      end if;
      if coalesce((v_row->>'wajib_sn')::boolean, false) then
        if v_manual_sn = '' then
          raise exception 'Serial number wajib diisi untuk material manual berserial.';
        end if;
        if v_qty <> 1 then
          raise exception 'Return manual material berserial hanya boleh qty 1 per pengajuan.';
        end if;
        if exists (select 1 from public.material_serial_numbers where serial_number = v_manual_sn) then
          raise exception 'Serial number % sudah terdaftar di database.', v_manual_sn;
        end if;
      end if;
      v_total_qty := v_total_qty + v_qty;
    end loop;
  end if;

  v_return_code := public.generate_transaction_code('RET');

  insert into public.material_returns(return_code, teknisi_id, source_type, status, kondisi, qty_return, foto_url, keterangan)
  values (v_return_code, p_teknisi_id, v_source_type, 'PENDING', upper(trim(p_kondisi)), v_total_qty, trim(p_foto_url), nullif(trim(coalesce(p_keterangan,'')), ''))
  returning id into v_return_id;

  for v_row in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_row->>'qty')::integer, 0);
    if v_source_type = 'BAG' then
      select tb.* into v_bag from public.technician_bags tb where tb.id = (v_row->>'bag_id')::uuid for update;
      insert into public.material_return_items(return_id, bag_id, material_id, serial_number_id, qty, kondisi)
      values (v_return_id, v_bag.id, v_bag.material_id, v_bag.serial_number_id, v_qty, upper(trim(p_kondisi)));
      if v_bag.serial_number_id is not null then
        update public.material_serial_numbers set status = 'RETURN_PENDING' where id = v_bag.serial_number_id;
      end if;
    else
      v_material_code := upper(trim(v_row->>'material_code'));
      select id into v_material_id from public.materials where material_code = v_material_code limit 1;
      insert into public.material_return_items(
        return_id, bag_id, material_id, serial_number_id, qty, kondisi,
        manual_material_code, manual_nama, manual_merk, manual_satuan, manual_wajib_sn, manual_serial_number
      ) values (
        v_return_id, null, v_material_id, null, v_qty, upper(trim(p_kondisi)),
        v_material_code, trim(v_row->>'nama'), trim(v_row->>'merk'), upper(trim(v_row->>'satuan')),
        coalesce((v_row->>'wajib_sn')::boolean, false), nullif(upper(trim(coalesce(v_row->>'serial_number',''))), '')
      );
    end if;
  end loop;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_teknisi_id, 'TEKNISI', 'CREATE_RETURN', 'material_returns', v_return_id,
          'Teknisi mengirim pengembalian material ' || v_return_code,
          jsonb_build_object('return_code', v_return_code, 'source_type', v_source_type, 'qty_return', v_total_qty));

  return v_return_id;
end;
$$;

create or replace function public.approve_material_return(
  p_return_id uuid,
  p_admin_id uuid,
  p_catatan_admin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role public.user_role;
  v_return record;
  v_item record;
  v_bag record;
  v_material_id uuid;
  v_stock_id uuid;
  v_wajib_sn boolean;
  v_serial_id uuid;
begin
  select role into v_admin_role from public.profiles where id = p_admin_id and is_active = true;
  if v_admin_role is distinct from 'ADMIN' then
    raise exception 'Hanya Admin Gudang yang boleh approval pengembalian.';
  end if;

  select * into v_return from public.material_returns where id = p_return_id for update;
  if v_return.id is null then
    raise exception 'Data pengembalian tidak ditemukan.';
  end if;
  if v_return.status <> 'PENDING' then
    raise exception 'Pengembalian sudah diproses dan tidak boleh diproses dua kali.';
  end if;

  for v_item in select * from public.material_return_items where return_id = p_return_id order by created_at
  loop
    if v_return.source_type = 'BAG' then
      select tb.*, m.wajib_sn, m.material_code
      into v_bag
      from public.technician_bags tb
      join public.materials m on m.id = tb.material_id
      where tb.id = v_item.bag_id
      for update;

      if v_bag.id is null then
        raise exception 'Material tas tidak ditemukan saat approval.';
      end if;
      if v_bag.teknisi_id <> v_return.teknisi_id then
        raise exception 'Material tas tidak sesuai teknisi pengaju.';
      end if;
      if v_bag.qty < v_item.qty then
        raise exception 'Qty tas tidak cukup untuk approval return material %.', v_bag.material_code;
      end if;

      update public.technician_bags
      set qty = qty - v_item.qty,
          status = case when qty - v_item.qty <= 0 then 'RETURNED' else status end
      where id = v_bag.id;

      v_material_id := v_bag.material_id;
      v_wajib_sn := v_bag.wajib_sn;
      v_serial_id := v_bag.serial_number_id;
    else
      v_material_id := v_item.material_id;
      if v_material_id is null then
        insert into public.materials(material_code, nama, merk, satuan, kondisi_default, min_stock, wajib_sn, created_by)
        values (upper(trim(v_item.manual_material_code)), trim(v_item.manual_nama), trim(v_item.manual_merk), upper(trim(v_item.manual_satuan)), upper(trim(v_item.kondisi)), 0, coalesce(v_item.manual_wajib_sn,false), p_admin_id)
        on conflict (material_code) do update set updated_at = now()
        returning id, wajib_sn into v_material_id, v_wajib_sn;
      else
        select wajib_sn into v_wajib_sn from public.materials where id = v_material_id;
      end if;
    end if;

    select id into v_stock_id
    from public.material_stocks
    where material_id = v_material_id and location_type = 'GUDANG' and teknisi_id is null and kondisi = upper(trim(v_item.kondisi)) and status = 'AVAILABLE'
    order by created_at
    limit 1
    for update;

    if v_stock_id is null then
      insert into public.material_stocks(material_id, location_type, teknisi_id, qty, kondisi, status)
      values (v_material_id, 'GUDANG', null, v_item.qty, upper(trim(v_item.kondisi)), 'AVAILABLE')
      returning id into v_stock_id;
    else
      update public.material_stocks set qty = qty + v_item.qty where id = v_stock_id;
    end if;

    if v_wajib_sn then
      if v_return.source_type = 'BAG' and v_serial_id is not null then
        update public.material_serial_numbers
        set status = 'RETURNED', location_type = 'GUDANG', teknisi_id = null, stock_id = v_stock_id, kondisi = upper(trim(v_item.kondisi))
        where id = v_serial_id;
      elsif v_return.source_type = 'MANUAL' then
        insert into public.material_serial_numbers(material_id, stock_id, serial_number, status, location_type, teknisi_id, kondisi)
        values (v_material_id, v_stock_id, upper(trim(v_item.manual_serial_number)), 'RETURNED', 'GUDANG', null, upper(trim(v_item.kondisi)))
        returning id into v_serial_id;
        update public.material_return_items set material_id = v_material_id, serial_number_id = v_serial_id where id = v_item.id;
      end if;
    end if;
  end loop;

  update public.material_returns
  set status = 'APPROVED', catatan_admin = nullif(trim(coalesce(p_catatan_admin,'')), ''), approved_by = p_admin_id, approved_at = now()
  where id = p_return_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_admin_id, 'ADMIN', 'APPROVE_RETURN', 'material_returns', p_return_id,
          'Admin menyetujui pengembalian material ' || v_return.return_code,
          jsonb_build_object('return_code', v_return.return_code, 'source_type', v_return.source_type));

  return p_return_id;
end;
$$;

create or replace function public.reject_material_return(
  p_return_id uuid,
  p_admin_id uuid,
  p_catatan_admin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role public.user_role;
  v_return record;
  v_item record;
begin
  select role into v_admin_role from public.profiles where id = p_admin_id and is_active = true;
  if v_admin_role is distinct from 'ADMIN' then
    raise exception 'Hanya Admin Gudang yang boleh reject pengembalian.';
  end if;

  select * into v_return from public.material_returns where id = p_return_id for update;
  if v_return.id is null then
    raise exception 'Data pengembalian tidak ditemukan.';
  end if;
  if v_return.status <> 'PENDING' then
    raise exception 'Pengembalian sudah diproses dan tidak boleh diproses dua kali.';
  end if;

  for v_item in select * from public.material_return_items where return_id = p_return_id
  loop
    if v_item.serial_number_id is not null then
      update public.material_serial_numbers
      set status = 'IN_TECHNICIAN_BAG'
      where id = v_item.serial_number_id and status = 'RETURN_PENDING';
    end if;
  end loop;

  update public.material_returns
  set status = 'REJECTED', catatan_admin = nullif(trim(coalesce(p_catatan_admin,'')), ''), approved_by = p_admin_id, approved_at = now()
  where id = p_return_id;

  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_admin_id, 'ADMIN', 'REJECT_RETURN', 'material_returns', p_return_id,
          'Admin menolak pengembalian material ' || v_return.return_code,
          jsonb_build_object('return_code', v_return.return_code, 'catatan_admin', p_catatan_admin));

  return p_return_id;
end;
$$;

-- =========================
-- PHASE 7 - STOK OPNAME
-- Teknisi submit SO, Admin review per item.
-- =========================

create or replace view public.stock_opname_summary as
select
  so.id,
  so.so_code,
  so.teknisi_id,
  p.nama as teknisi_nama,
  so.status,
  so.catatan_teknisi,
  so.reviewed_by,
  rp.nama as reviewed_by_nama,
  so.reviewed_at,
  so.created_at,
  so.updated_at,
  count(soi.id)::integer as item_count,
  coalesce(sum(soi.qty_system), 0)::integer as total_system_qty,
  coalesce(sum(soi.qty_physical), 0)::integer as total_physical_qty,
  coalesce(sum(soi.selisih), 0)::integer as total_selisih,
  count(soi.id) filter (where soi.selisih <> 0 or upper(soi.kondisi_fisik) not in ('BAIK', 'GOOD'))::integer as problem_count
from public.stock_opnames so
join public.profiles p on p.id = so.teknisi_id
left join public.profiles rp on rp.id = so.reviewed_by
left join public.stock_opname_items soi on soi.stock_opname_id = so.id
group by so.id, p.nama, rp.nama;

create or replace view public.stock_opname_item_detail as
select
  soi.id,
  soi.stock_opname_id,
  soi.bag_id,
  soi.material_id,
  m.material_code,
  m.nama as material_nama,
  m.merk,
  m.satuan,
  m.wajib_sn,
  soi.serial_number_id,
  msn.serial_number,
  soi.qty_system,
  soi.qty_physical,
  soi.selisih,
  soi.kondisi_fisik,
  soi.foto_url,
  soi.status_review,
  soi.catatan_admin,
  soi.created_at,
  soi.updated_at
from public.stock_opname_items soi
join public.materials m on m.id = soi.material_id
left join public.material_serial_numbers msn on msn.id = soi.serial_number_id;

create or replace function public.create_stock_opname(
  p_teknisi_id uuid,
  p_catatan_teknisi text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_so_id uuid;
  v_so_code text;
  v_row jsonb;
  v_bag record;
  v_qty_physical integer;
  v_kondisi text;
  v_foto text;
begin
  select role into v_role from public.profiles where id = p_teknisi_id and is_active = true;
  if v_role is distinct from 'TEKNISI' then
    raise exception 'Hanya Teknisi aktif yang dapat mengirim stok opname.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal harus ada satu item stok opname.';
  end if;
  for v_row in select * from jsonb_array_elements(p_items)
  loop
    if nullif(trim(coalesce(v_row->>'bag_id','')), '') is null then raise exception 'Material dari tas wajib dipilih.'; end if;
    v_qty_physical := coalesce((v_row->>'qty_physical')::integer, -1);
    v_kondisi := upper(trim(coalesce(v_row->>'kondisi_fisik', '')));
    v_foto := trim(coalesce(v_row->>'foto_url', ''));
    if v_qty_physical < 0 then raise exception 'Qty fisik wajib angka dan tidak boleh negatif.'; end if;
    if v_kondisi = '' then raise exception 'Kondisi fisik wajib dipilih untuk setiap item.'; end if;
    if v_foto = '' then raise exception 'Foto bukti wajib diupload untuk setiap item.'; end if;
    select tb.*, m.material_code, m.wajib_sn into v_bag from public.technician_bags tb join public.materials m on m.id = tb.material_id where tb.id = (v_row->>'bag_id')::uuid for update;
    if v_bag.id is null then raise exception 'Material tas tidak ditemukan.'; end if;
    if v_bag.teknisi_id <> p_teknisi_id then raise exception 'Teknisi hanya boleh stok opname material dari tasnya sendiri.'; end if;
    if v_bag.status <> 'ACTIVE' or v_bag.qty <= 0 then raise exception 'Material % tidak aktif di tas teknisi.', v_bag.material_code; end if;
    if v_bag.wajib_sn and v_qty_physical not in (0, 1) then raise exception 'Qty fisik material berserial % harus 0 atau 1.', v_bag.material_code; end if;
  end loop;
  v_so_code := public.generate_transaction_code('SO');
  insert into public.stock_opnames(so_code, teknisi_id, status, catatan_teknisi)
  values (v_so_code, p_teknisi_id, 'PENDING', nullif(trim(coalesce(p_catatan_teknisi,'')), '')) returning id into v_so_id;
  for v_row in select * from jsonb_array_elements(p_items)
  loop
    select tb.*, m.wajib_sn into v_bag from public.technician_bags tb join public.materials m on m.id = tb.material_id where tb.id = (v_row->>'bag_id')::uuid for update;
    v_qty_physical := (v_row->>'qty_physical')::integer;
    v_kondisi := upper(trim(v_row->>'kondisi_fisik'));
    v_foto := trim(v_row->>'foto_url');
    insert into public.stock_opname_items(stock_opname_id, bag_id, material_id, serial_number_id, qty_system, qty_physical, kondisi_fisik, foto_url, status_review)
    values (v_so_id, v_bag.id, v_bag.material_id, v_bag.serial_number_id, v_bag.qty, v_qty_physical, v_kondisi, v_foto, 'PENDING');
    if v_bag.serial_number_id is not null then
      update public.material_serial_numbers set status = 'SO_PENDING' where id = v_bag.serial_number_id and status = 'IN_TECHNICIAN_BAG';
    end if;
  end loop;
  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_teknisi_id, 'TEKNISI', 'CREATE_STOCK_OPNAME', 'stock_opnames', v_so_id, 'Teknisi mengirim stok opname ' || v_so_code, jsonb_build_object('so_code', v_so_code, 'item_count', jsonb_array_length(p_items)));
  return v_so_id;
end;
$$;

create or replace function public.review_stock_opname(
  p_stock_opname_id uuid,
  p_admin_id uuid,
  p_reviews jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role public.user_role;
  v_so record;
  v_row jsonb;
  v_item record;
  v_status public.transaction_status;
  v_catatan text;
  v_total_items integer;
  v_review_count integer;
  v_revision_count integer;
  v_rejected_count integer;
  v_final_status public.transaction_status;
begin
  select role into v_admin_role from public.profiles where id = p_admin_id and is_active = true;
  if v_admin_role is distinct from 'ADMIN' then raise exception 'Hanya Admin Gudang yang boleh review stok opname.'; end if;
  select * into v_so from public.stock_opnames where id = p_stock_opname_id for update;
  if v_so.id is null then raise exception 'Sesi stok opname tidak ditemukan.'; end if;
  if v_so.status <> 'PENDING' then raise exception 'Stok opname sudah direview dan tidak boleh diproses dua kali.'; end if;
  if p_reviews is null or jsonb_typeof(p_reviews) <> 'array' or jsonb_array_length(p_reviews) = 0 then raise exception 'Minimal ada satu item untuk direview.'; end if;
  select count(*) into v_total_items from public.stock_opname_items where stock_opname_id = p_stock_opname_id;
  if v_total_items = 0 then raise exception 'Sesi stok opname tidak memiliki item.'; end if;
  for v_row in select * from jsonb_array_elements(p_reviews)
  loop
    if nullif(trim(coalesce(v_row->>'item_id','')), '') is null then raise exception 'Item review tidak valid.'; end if;
    v_status := (v_row->>'status_review')::public.transaction_status;
    v_catatan := nullif(trim(coalesce(v_row->>'catatan_admin','')), '');
    if v_status not in ('APPROVED', 'REVISION', 'REJECTED_FINAL') then raise exception 'Status item review tidak valid.'; end if;
    if v_status in ('REVISION', 'REJECTED_FINAL') and v_catatan is null then raise exception 'Catatan admin wajib untuk status Revisi dan Rejected Final.'; end if;
    select * into v_item from public.stock_opname_items where id = (v_row->>'item_id')::uuid and stock_opname_id = p_stock_opname_id for update;
    if v_item.id is null then raise exception 'Item stok opname tidak ditemukan.'; end if;
    update public.stock_opname_items set status_review = v_status, catatan_admin = v_catatan where id = v_item.id;
    if v_item.serial_number_id is not null then
      update public.material_serial_numbers
      set status = case when v_status = 'REJECTED_FINAL' and v_item.qty_physical = 0 then 'LOST'::public.serial_status when upper(v_item.kondisi_fisik) in ('RUSAK', 'DAMAGED') then 'DAMAGED'::public.serial_status else 'IN_TECHNICIAN_BAG'::public.serial_status end,
          kondisi = upper(v_item.kondisi_fisik)
      where id = v_item.serial_number_id;
    end if;
  end loop;
  select count(*) filter (where status_review <> 'PENDING'), count(*) filter (where status_review = 'REVISION'), count(*) filter (where status_review = 'REJECTED_FINAL')
  into v_review_count, v_revision_count, v_rejected_count from public.stock_opname_items where stock_opname_id = p_stock_opname_id;
  if v_review_count < v_total_items then raise exception 'Semua item stok opname harus direview.'; end if;
  if v_rejected_count > 0 then v_final_status := 'REJECTED_FINAL'; elsif v_revision_count > 0 then v_final_status := 'REVISION'; else v_final_status := 'APPROVED'; end if;
  update public.stock_opnames set status = v_final_status, reviewed_by = p_admin_id, reviewed_at = now() where id = p_stock_opname_id;
  insert into public.activity_logs(actor_id, actor_role, action, entity_type, entity_id, description, metadata)
  values (p_admin_id, 'ADMIN', 'REVIEW_STOCK_OPNAME', 'stock_opnames', p_stock_opname_id, 'Admin mereview stok opname ' || v_so.so_code, jsonb_build_object('so_code', v_so.so_code, 'status', v_final_status, 'item_count', v_total_items));
  return p_stock_opname_id;
end;
$$;

-- =========================
-- PHASE 8 - SUPERVISOR DASHBOARD, MONITORING, REPORT PREVIEW/EXPORT
-- =========================

create or replace view public.supervisor_monitoring_materials as
select
  m.id as material_id,
  m.material_code,
  m.nama,
  m.merk,
  m.satuan,
  m.wajib_sn,
  m.min_stock,
  coalesce(sum(ms.qty) filter (where ms.location_type = 'GUDANG'), 0)::integer as stock_gudang,
  coalesce(sum(ms.qty) filter (where ms.location_type = 'TEKNISI'), 0)::integer as stock_teknisi,
  coalesce(sum(ms.qty), 0)::integer as total_stock,
  count(sn.id) filter (where sn.status = 'AVAILABLE')::integer as serial_available,
  count(sn.id) filter (where sn.status = 'IN_TECHNICIAN_BAG')::integer as serial_in_bag,
  count(sn.id) filter (where sn.status = 'USED')::integer as serial_used,
  case
    when coalesce(sum(ms.qty) filter (where ms.location_type = 'GUDANG'), 0) = 0 then 'KRITIS'
    when coalesce(sum(ms.qty) filter (where ms.location_type = 'GUDANG'), 0) <= m.min_stock then 'RENDAH'
    else 'AMAN'
  end as stock_status
from public.materials m
left join public.material_stocks ms on ms.material_id = m.id
left join public.material_serial_numbers sn on sn.material_id = m.id
where m.is_active = true
group by m.id, m.material_code, m.nama, m.merk, m.satuan, m.wajib_sn, m.min_stock;

create or replace view public.supervisor_monitoring_technicians as
select
  p.id as teknisi_id,
  p.nama,
  p.email,
  coalesce(count(distinct tb.id) filter (where tb.status = 'ACTIVE' and tb.qty > 0), 0)::integer as bag_item_count,
  coalesce(sum(tb.qty) filter (where tb.status = 'ACTIVE' and tb.qty > 0), 0)::integer as bag_total_qty,
  coalesce(count(distinct mr.id), 0)::integer as request_count,
  coalesce(count(distinct mu.id), 0)::integer as usage_count,
  coalesce(count(distinct ret.id), 0)::integer as return_count,
  coalesce(count(distinct so.id), 0)::integer as stock_opname_count,
  (
    coalesce(count(distinct mr.id), 0) +
    coalesce(count(distinct mu.id), 0) +
    coalesce(count(distinct ret.id), 0) +
    coalesce(count(distinct so.id), 0)
  )::integer as total_activity,
  greatest(max(mr.created_at), max(mu.created_at), max(ret.created_at), max(so.created_at)) as last_activity_at
from public.profiles p
left join public.technician_bags tb on tb.teknisi_id = p.id
left join public.material_requests mr on mr.teknisi_id = p.id
left join public.material_usages mu on mu.teknisi_id = p.id
left join public.material_returns ret on ret.teknisi_id = p.id
left join public.stock_opnames so on so.teknisi_id = p.id
where p.role = 'TEKNISI' and p.is_active = true
group by p.id, p.nama, p.email;

create or replace view public.supervisor_top_material_usage as
select
  m.id as material_id,
  m.material_code,
  m.nama,
  coalesce(sum(mui.qty), 0)::integer as total_used
from public.materials m
join public.material_usage_items mui on mui.material_id = m.id
group by m.id, m.material_code, m.nama
order by total_used desc, m.nama asc;

create or replace function public.get_supervisor_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'total_material', (select count(*) from public.materials where is_active = true),
    'low_stock', (select count(*) from public.supervisor_monitoring_materials where stock_status in ('RENDAH','KRITIS')),
    'total_teknisi', (select count(*) from public.profiles where role = 'TEKNISI' and is_active = true),
    'active_teknisi', (select count(*) from public.supervisor_monitoring_technicians where total_activity > 0),
    'total_usage', (select count(*) from public.material_usages),
    'total_return', (select count(*) from public.material_returns),
    'total_stock_opname', (select count(*) from public.stock_opnames),
    'total_request_pending', (select count(*) from public.material_requests where status = 'PENDING')
  ) into v_result;
  return v_result;
end;
$$;
