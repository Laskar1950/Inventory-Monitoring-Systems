# PLN ICON PLUS Inventory Monitoring Systems

Project migrasi Inventory Monitoring dari Google Apps Script ke Next.js, Supabase, dan Vercel.

## Status Paket

Paket ini mencakup Phase 1 sampai Phase 7:

1. Fondasi Next.js App Router, Supabase Auth, role profile, protected layout.
2. Schema database Supabase utama, RLS dasar, Storage bucket script.
3. Master Material: tambah material non-SN/SN, validasi SN, stok awal, transaksi database.
4. Request Material dan Tas Teknisi: request teknisi, approval/reject admin, transfer stok gudang ke tas teknisi.
5. Penggunaan Material: teknisi menggunakan material dari tas, upload foto eviden, pengurangan stok tas, update serial number menjadi `USED`, dan preview laporan pemakaian untuk Admin/Supervisor.
6. Pengembalian Material: return dari tas, return manual, upload foto return, approval/reject Admin, update stok gudang dan serial number secara atomic.
7. Stok Opname: teknisi submit SO dari isi tas, upload foto bukti per item, Admin review per item dengan status Approved/Revisi/Rejected Final.

## Cara Menjalankan Lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Setup Supabase

1. Buat project Supabase.
2. Jalankan `supabase/schema.sql` di SQL Editor.
3. Jalankan `supabase/storage.sql` di SQL Editor.
4. Buat user melalui Supabase Auth.
5. Insert profile untuk user tersebut di tabel `profiles`.

Contoh profile:

```sql
insert into public.profiles (auth_user_id, nama, email, role, is_active)
values ('AUTH_USER_UUID', 'Admin Gudang', 'admin@email.com', 'ADMIN', true);
```

Role valid:

- `TEKNISI`
- `ADMIN`
- `SUPERVISOR`

## Alur Phase 4

### Teknisi

1. Login sebagai `TEKNISI`.
2. Buka menu **Permintaan Material**.
3. Pilih material dari stok gudang.
4. Masukkan qty.
5. Tambahkan ke daftar request.
6. Klik **Kirim Request**.
7. Request tersimpan sebagai `PENDING`.

### Admin Gudang

1. Login sebagai `ADMIN`.
2. Buka menu **Setujui Permintaan**.
3. Klik **Approve** atau **Reject**.
4. Jika approve, sistem validasi stok ulang, mengurangi stok gudang, dan memasukkan material ke `technician_bags`.
5. Jika reject, stok tidak berubah.

## Alur Phase 5

### Teknisi

1. Login sebagai `TEKNISI`.
2. Buka menu **Penggunaan**.
3. Pilih material dari **Tas Saya**.
4. Masukkan qty penggunaan.
5. Isi nomor tiket, data pelanggan/lokasi, dan root cause.
6. Upload foto eviden JPG/PNG/WEBP maksimal 5 MB.
7. Klik **Kirim Laporan**.
8. Sistem menyimpan usage dengan kode `USE-YYYYMMDD-0001`, mengurangi qty tas, dan mengubah serial number menjadi `USED` untuk material SN.

### Admin / Supervisor

1. Login sebagai `ADMIN` atau `SUPERVISOR`.
2. Buka menu **Laporan**.
3. Preview laporan pemakaian dapat difilter dengan keyword.

## Alur Phase 6

### Teknisi

1. Login sebagai `TEKNISI`.
2. Buka menu **Pengembalian**.
3. Pilih sumber return:
   - **Dari Tas Saya** untuk material yang sudah berada di tas teknisi.
   - **Manual** untuk material yang ditemukan/akan dikembalikan secara manual.
4. Isi kondisi, qty, keterangan, dan upload foto return.
5. Klik **Kirim Pengembalian**.
6. Return tersimpan dengan status `PENDING` dan kode `RET-YYYYMMDD-0001`.

### Admin Gudang

1. Login sebagai `ADMIN`.
2. Buka menu **Setujui Pengembalian**.
3. Klik **Approve** atau **Reject**.
4. Jika approve:
   - Stok gudang bertambah.
   - Qty tas teknisi berkurang untuk return dari tas.
   - Serial number diperbarui ke status `RETURNED` dan lokasi `GUDANG`.
   - Return manual dapat membuat master material baru jika Material ID belum ada.
5. Jika reject, stok gudang tidak berubah dan catatan reject tersimpan.

## Alur Phase 7

### Teknisi

1. Login sebagai `TEKNISI`.
2. Buka menu **Stok Opname**.
3. Sistem memuat seluruh material aktif dari **Tas Saya**.
4. Isi qty fisik, kondisi fisik, dan upload foto bukti untuk setiap item.
5. Klik **Kirim Laporan SO**.
6. Sistem menyimpan sesi stok opname dengan kode `SO-YYYYMMDD-0001` dan status `PENDING`.

### Admin Gudang

1. Login sebagai `ADMIN`.
2. Buka menu **Setujui Stok Opname**.
3. Pilih laporan SO yang berstatus `PENDING`.
4. Review setiap item dengan status `APPROVED`, `REVISION`, atau `REJECTED_FINAL`.
5. Catatan admin wajib untuk item berstatus `REVISION` atau `REJECTED_FINAL`.
6. Klik **Simpan Review**. Sistem menyimpan review, memperbarui status sesi, dan mencatat activity log.

## Catatan Penting

- Semua mutasi stok penting dilakukan melalui RPC PostgreSQL agar atomic.
- API tetap memvalidasi role user di server.
- UI menyediakan loading state dan notifikasi berhasil/gagal.
- Foto eviden penggunaan disimpan di bucket `usage-evidence`.
- Foto return disimpan di bucket `return-evidence`.
- Foto stok opname disimpan di bucket `stock-opname-evidence`.
- Untuk production, review ulang RLS sesuai kebutuhan organisasi.

## Phase Berikutnya

Phase 8: Dashboard Supervisor, monitoring material/teknisi, analisa material, report preview, dan export laporan.

## Phase 8 - Supervisor dan Laporan

Tambahan pada paket Phase 1-8:

- Dashboard Supervisor dengan ringkasan total material, stok rendah/kritis, teknisi aktif, request pending, penggunaan, return, dan stok opname.
- Monitoring Material untuk Supervisor/Admin:
  - stok gudang
  - stok teknisi
  - total stok
  - status stok AMAN/RENDAH/KRITIS
  - ringkasan serial number AVAILABLE/IN_TECHNICIAN_BAG/USED
- Monitoring Teknisi untuk Supervisor/Admin:
  - jumlah item di tas
  - total qty di tas
  - jumlah request, penggunaan, return, dan stok opname
  - aktivitas terakhir
- Laporan dan Export:
  - preview laporan pemakaian
  - filter keyword, tanggal mulai, tanggal akhir, teknisi
  - validasi tanggal mulai tidak boleh lebih besar dari tanggal akhir
  - export CSV hanya aktif jika preview memiliki data
- API tambahan:
  - `GET /api/dashboard/supervisor`
  - `GET /api/monitoring/materials`
  - `GET /api/monitoring/technicians`
  - `GET /api/reports/preview`
  - `GET /api/reports/export`
- SQL tambahan:
  - `supervisor_monitoring_materials`
  - `supervisor_monitoring_technicians`
  - `supervisor_top_material_usage`
  - `get_supervisor_dashboard_summary()`

Jalankan ulang `supabase/schema.sql` setelah deploy paket Phase 1-8 agar view dan function supervisor tersedia.
