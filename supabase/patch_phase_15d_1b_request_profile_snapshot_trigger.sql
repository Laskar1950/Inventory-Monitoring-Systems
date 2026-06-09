-- Phase 15D-1B: Snapshot technician profile fields when request is created.
-- Run after patch_phase_15d_1_pdf_profile_request_fields.sql.

create or replace function public.trg_snapshot_request_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
begin
  select phone_number, company_name, basecamp into v_profile
  from public.profiles
  where id = new.teknisi_id;

  new.teknisi_phone_number := coalesce(new.teknisi_phone_number, v_profile.phone_number);
  new.teknisi_company_name := coalesce(new.teknisi_company_name, v_profile.company_name);
  new.teknisi_basecamp := coalesce(new.teknisi_basecamp, v_profile.basecamp);
  new.basecamp := coalesce(new.basecamp, v_profile.basecamp);
  return new;
end;
$$;

drop trigger if exists trg_snapshot_request_profile on public.material_requests;
create trigger trg_snapshot_request_profile
before insert on public.material_requests
for each row execute function public.trg_snapshot_request_profile();
