-- Phase 10A performance indexes.
-- Run this once in Supabase SQL Editor.

create index if not exists idx_materials_created_at on public.materials(created_at desc);
create index if not exists idx_materials_active_code on public.materials(is_active, material_code);

create index if not exists idx_material_stocks_material_location on public.material_stocks(material_id, location_type, status);
create index if not exists idx_material_serial_material_status on public.material_serial_numbers(material_id, status, location_type);
create index if not exists idx_material_serial_teknisi_status on public.material_serial_numbers(teknisi_id, status);

create index if not exists idx_requests_teknisi_created on public.material_requests(teknisi_id, created_at desc);
create index if not exists idx_requests_status_created on public.material_requests(status, created_at desc);
create index if not exists idx_request_items_request on public.material_request_items(request_id);

create index if not exists idx_bags_teknisi_status_created on public.technician_bags(teknisi_id, status, created_at desc);
create index if not exists idx_bags_material_status on public.technician_bags(material_id, status);

create index if not exists idx_usages_teknisi_created on public.material_usages(teknisi_id, created_at desc);
create index if not exists idx_usage_items_usage on public.material_usage_items(usage_id);
create index if not exists idx_usage_items_material on public.material_usage_items(material_id);

create index if not exists idx_returns_teknisi_created on public.material_returns(teknisi_id, created_at desc);
create index if not exists idx_returns_status_created on public.material_returns(status, created_at desc);
create index if not exists idx_return_items_return on public.material_return_items(return_id);

create index if not exists idx_stock_opnames_teknisi_created on public.stock_opnames(teknisi_id, created_at desc);
create index if not exists idx_stock_opnames_status_created on public.stock_opnames(status, created_at desc);
create index if not exists idx_stock_opname_items_so on public.stock_opname_items(stock_opname_id);

create index if not exists idx_activity_logs_created on public.activity_logs(created_at desc);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
