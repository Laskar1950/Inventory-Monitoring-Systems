-- Optional helper: create storage buckets from SQL Editor if allowed by your Supabase project.
-- If this is blocked, create them manually in Supabase Dashboard > Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('usage-evidence', 'usage-evidence', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('return-evidence', 'return-evidence', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('stock-opname-evidence', 'stock-opname-evidence', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
