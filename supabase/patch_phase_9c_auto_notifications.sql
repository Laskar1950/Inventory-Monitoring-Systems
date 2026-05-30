-- Phase 9C auto notification triggers.
-- Run after patch_phase_9c_profile_notifications.sql.

create or replace function public.notify_admins(
  p_title text,
  p_message text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_link_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, title, message, entity_type, entity_id, link_url)
  select id, p_title, p_message, p_entity_type, p_entity_id, p_link_url
  from public.profiles
  where role = 'ADMIN' and is_active = true;
end;
$$;

create or replace function public.notify_profile(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_link_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is not null then
    insert into public.notifications(user_id, title, message, entity_type, entity_id, link_url)
    values (p_user_id, p_title, p_message, p_entity_type, p_entity_id, p_link_url);
  end if;
end;
$$;

create or replace function public.trg_notify_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
  select nama into v_name from public.profiles where id = new.teknisi_id;
  perform public.notify_admins('Request material baru', coalesce(v_name,'Teknisi') || ' mengirim request material ' || new.request_code || '.', 'material_requests', new.id, '/approvals/requests');
  return new;
end;
$$;

drop trigger if exists notify_request_created on public.material_requests;
create trigger notify_request_created
after insert on public.material_requests
for each row execute function public.trg_notify_request_created();

create or replace function public.trg_notify_request_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('APPROVED','REJECTED') then
    perform public.notify_profile(new.teknisi_id, 'Update request material', 'Request ' || new.request_code || ' berstatus ' || new.status || '.', 'material_requests', new.id, '/requests');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_request_status on public.material_requests;
create trigger notify_request_status
after update of status on public.material_requests
for each row execute function public.trg_notify_request_status();

create or replace function public.trg_notify_return_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
  select nama into v_name from public.profiles where id = new.teknisi_id;
  perform public.notify_admins('Pengembalian material baru', coalesce(v_name,'Teknisi') || ' mengirim pengembalian material ' || new.return_code || '.', 'material_returns', new.id, '/approvals/returns');
  return new;
end;
$$;

drop trigger if exists notify_return_created on public.material_returns;
create trigger notify_return_created
after insert on public.material_returns
for each row execute function public.trg_notify_return_created();

create or replace function public.trg_notify_return_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('APPROVED','REJECTED') then
    perform public.notify_profile(new.teknisi_id, 'Update pengembalian material', 'Pengembalian ' || new.return_code || ' berstatus ' || new.status || '.', 'material_returns', new.id, '/returns');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_return_status on public.material_returns;
create trigger notify_return_status
after update of status on public.material_returns
for each row execute function public.trg_notify_return_status();

create or replace function public.trg_notify_stock_opname_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
  select nama into v_name from public.profiles where id = new.teknisi_id;
  perform public.notify_admins('Stok opname baru', coalesce(v_name,'Teknisi') || ' mengirim stok opname ' || new.so_code || '.', 'stock_opnames', new.id, '/approvals/stock-opnames');
  return new;
end;
$$;

drop trigger if exists notify_stock_opname_created on public.stock_opnames;
create trigger notify_stock_opname_created
after insert on public.stock_opnames
for each row execute function public.trg_notify_stock_opname_created();

create or replace function public.trg_notify_stock_opname_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('APPROVED','REVISION','REJECTED_FINAL') then
    perform public.notify_profile(new.teknisi_id, 'Update stok opname', 'Stok opname ' || new.so_code || ' berstatus ' || new.status || '.', 'stock_opnames', new.id, '/stock-opnames');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_stock_opname_status on public.stock_opnames;
create trigger notify_stock_opname_status
after update of status on public.stock_opnames
for each row execute function public.trg_notify_stock_opname_status();

create or replace function public.trg_notify_usage_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
  select nama into v_name from public.profiles where id = new.teknisi_id;
  perform public.notify_admins('Penggunaan material baru', coalesce(v_name,'Teknisi') || ' mencatat penggunaan material untuk tiket ' || new.no_tiket || '.', 'material_usages', new.id, '/laporan-penggunaan');
  return new;
end;
$$;

drop trigger if exists notify_usage_created on public.material_usages;
create trigger notify_usage_created
after insert on public.material_usages
for each row execute function public.trg_notify_usage_created();
