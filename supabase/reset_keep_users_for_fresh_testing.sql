-- Reset data untuk fresh testing.
-- PENTING: script ini menghapus data transaksi, master material, stok, serial, log, dan notifikasi.
-- Script ini TIDAK menghapus user login/auth.users dan TIDAK menghapus public.profiles.
-- Jalankan hanya di environment testing/dev setelah yakin backup sudah aman.

begin;

-- PostgreSQL tidak mendukung TRUNCATE TABLE IF EXISTS, jadi pengecekan tabel
-- dilakukan lewat to_regclass agar script tetap aman untuk database yang skemanya berbeda.
do $$
declare
  table_name text;
  tables_to_reset text[] := array[
    'public.material_request_item_serials',
    'public.material_serial_movements',
    'public.stock_opname_items',
    'public.stock_opnames',
    'public.material_return_items',
    'public.material_returns',
    'public.material_usage_items',
    'public.material_usages',
    'public.technician_bags',
    'public.material_request_items',
    'public.material_requests',
    'public.material_serial_numbers',
    'public.material_stocks',
    'public.materials',
    'public.activity_logs',
    'public.notifications',
    'public.transaction_sequences'
  ];
begin
  foreach table_name in array tables_to_reset loop
    if to_regclass(table_name) is not null then
      execute format('truncate table %s cascade', table_name);
    end if;
  end loop;
end $$;

commit;

-- Setelah menjalankan script ini, user/profiles tetap ada.
-- Yang perlu dibuat ulang untuk testing dari nol:
-- 1. Lengkapi Profil Saya setiap user: No HP, Nama Perusahaan, Basecamp, Tanda Tangan.
-- 2. Input master material dan serial number.
-- 3. Buat request material baru dari teknisi.
