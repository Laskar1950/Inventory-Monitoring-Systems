-- Fix error input material:
-- new row for relation "material_serial_movements" violates check constraint
-- "material_serial_movements_movement_type_check"
--
-- Penyebab: ada nilai movement_type dari function lama/baru yang belum masuk daftar CHECK constraint.
-- Untuk fase stabilisasi testing, constraint ini dibuat fleksibel agar tidak memblokir input material/serial.
-- Script ini idempotent: aman dijalankan berulang.

alter table if exists public.material_serial_movements
  drop constraint if exists material_serial_movements_movement_type_check;

alter table if exists public.material_serial_movements
  drop constraint if exists material_serial_movements_movement_type_not_empty_check;

alter table if exists public.material_serial_movements
  add constraint material_serial_movements_movement_type_not_empty_check
  check (movement_type is null or length(trim(movement_type)) > 0);
