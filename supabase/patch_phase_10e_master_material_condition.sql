-- Phase 10E: Master Material condition handling and stock count fix.
-- Run this in Supabase SQL Editor after previous patches.

-- 1) Allow the same material_code to exist with different material condition.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'materials_material_code_key'
      and conrelid = 'public.materials'::regclass
  ) then
    alter table public.materials drop constraint materials_material_code_key;
  end if;
end $$;

create unique index if not exists idx_materials_code_condition_unique
on public.materials (upper(material_code), upper(kondisi_default));

-- 2) Fix stock view so stock is not multiplied by serial join rows.
create or replace view public.materials_with_stock as
select
  m.*,
  coalesce(stock.gudang_qty, 0)::integer as gudang_qty,
  coalesce(serial.serial_count, 0)::integer as serial_count
from public.materials m
left join lateral (
  select coalesce(sum(ms.qty), 0)::integer as gudang_qty
  from public.material_stocks ms
  where ms.material_id = m.id
    and ms.location_type = 'GUDANG'
    and ms.status = 'AVAILABLE'
) stock on true
left join lateral (
  select count(sn.id)::integer as serial_count
  from public.material_serial_numbers sn
  where sn.material_id = m.id
    and sn.location_type = 'GUDANG'
    and sn.status = 'AVAILABLE'
) serial on true;

-- 3) Update creation RPC to validate uniqueness by material_code + condition,
--    not material_code only, and keep user-facing condition names.
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
  p_kondisi_default := trim(p_kondisi_default);

  if p_material_code is null or p_material_code = '' then
    raise exception 'Material ID wajib diisi.';
  end if;
  if p_nama is null or trim(p_nama) = '' then
    raise exception 'Nama material wajib diisi.';
  end if;
  if p_merk is null or trim(p_merk) = '' then
    raise exception 'Merk wajib diisi.';
  end if;
  if p_kondisi_default not in ('New', 'Ex-Project', 'Rusak') then
    raise exception 'Kondisi material harus New, Ex-Project, atau Rusak.';
  end if;
  if p_min_stock < 0 then
    raise exception 'Minimum stok tidak boleh negatif.';
  end if;

  if exists (
    select 1
    from public.materials
    where upper(material_code) = p_material_code
      and upper(kondisi_default) = upper(p_kondisi_default)
  ) then
    raise exception 'Material ID % dengan kondisi % sudah terdaftar.', p_material_code, p_kondisi_default;
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
         'Admin membuat material ' || p_material_code || ' kondisi ' || p_kondisi_default,
         jsonb_build_object('wajib_sn', p_wajib_sn, 'qty_awal', p_qty_awal, 'kondisi', p_kondisi_default)
  from public.profiles pr
  where pr.id = p_created_by;

  return v_material_id;
end;
$$;
