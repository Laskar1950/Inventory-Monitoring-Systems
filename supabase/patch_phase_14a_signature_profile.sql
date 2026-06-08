-- Phase 14A: Signature Profile
-- Purpose: store default digital signature per account, used as snapshot source for Surat Jalan signatures.
-- Run in Supabase SQL Editor.

alter table public.profiles add column if not exists signature_url text;
alter table public.profiles add column if not exists signature_type text default 'uploaded';
alter table public.profiles add column if not exists signature_updated_at timestamptz;

-- Ensure storage bucket exists for signature images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
