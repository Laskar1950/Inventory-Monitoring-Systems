-- Phase 9C patch: profile metadata and notification foundation.

alter table public.profiles add column if not exists keterangan text;
alter table public.profiles add column if not exists photo_url text;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select using (user_id = public.current_profile_id());

create or replace function public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_link_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications(user_id, title, message, entity_type, entity_id, link_url)
  values (p_user_id, p_title, p_message, p_entity_type, p_entity_id, p_link_url)
  returning id into v_id;
  return v_id;
end;
$$;
