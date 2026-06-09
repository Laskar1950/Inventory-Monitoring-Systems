-- Reset data untuk fresh testing.
-- PENTING: script ini menghapus data transaksi, master material, stok, serial, log, dan notifikasi.
-- Script ini TIDAK menghapus user login/auth.users dan TIDAK menghapus public.profiles.
-- Jalankan hanya di environment testing/dev setelah yakin backup sudah aman.

begin;

-- Data workflow dan transaksi
truncate table if exists public.material_request_item_serials cascade;
truncate table if exists public.material_serial_movements cascade;
truncate table if exists public.stock_opname_items cascade;
truncate table if exists public.stock_opnames cascade;
truncate table if exists public.material_return_items cascade;
truncate table if exists public.material_returns cascade;
truncate table if exists public.material_usage_items cascade;
truncate table if exists public.material_usages cascade;
truncate table if exists public.technician_bags cascade;
truncate table if exists public.material_request_items cascade;
truncate table if exists public.material_requests cascade;

-- Master material dan stok
truncate table if exists public.material_serial_numbers cascade;
truncate table if exists public.material_stocks cascade;
truncate table if exists public.materials cascade;

-- Log, notifikasi, dan sequence kode transaksi
truncate table if exists public.activity_logs cascade;
truncate table if exists public.notifications cascade;
truncate table if exists public.transaction_sequences cascade;

commit;

-- Setelah menjalankan script ini, user/profiles tetap ada.
-- Yang perlu dibuat ulang untuk testing dari nol:
-- 1. Lengkapi Profil Saya setiap user: No HP, Nama Perusahaan, Basecamp, Tanda Tangan.
-- 2. Input master material dan serial number.
-- 3. Buat request material baru dari teknisi.
