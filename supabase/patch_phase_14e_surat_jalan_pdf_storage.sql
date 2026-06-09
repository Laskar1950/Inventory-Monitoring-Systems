-- Phase 14E: Surat Jalan Final PDF Storage
-- Purpose: store final generated Surat Jalan PDF after all signatures are complete.
-- Run in Supabase SQL Editor after Phase 14C.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('surat-jalan', 'surat-jalan', false, 10485760, array['application/pdf'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
