export type UserRole = "TEKNISI" | "ADMIN" | "SUPERVISOR";
export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVISION" | "REJECTED_FINAL" | "COMPLETED" | "CANCELLED";

export type Profile = {
  id: string;
  auth_user_id: string;
  nama: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Material = {
  id: string;
  material_code: string;
  nama: string;
  merk: string;
  satuan: string;
  kondisi_default: string;
  min_stock: number;
  wajib_sn: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  gudang_qty?: number;
  serial_count?: number;
};

export type RequestSummary = {
  id: string;
  request_code: string;
  teknisi_id: string;
  teknisi_nama: string;
  status: TransactionStatus;
  catatan_teknisi: string | null;
  catatan_admin: string | null;
  approved_by: string | null;
  approved_by_nama: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  total_qty: number;
};

export type RequestItemDetail = {
  id: string;
  request_id: string;
  material_id: string;
  material_code: string;
  material_nama: string;
  merk: string;
  satuan: string;
  wajib_sn: boolean;
  qty_requested: number;
  qty_approved: number | null;
  status: TransactionStatus;
};

export type RequestDetail = RequestSummary & {
  items: RequestItemDetail[];
};

export type TechnicianBagItem = {
  id: string;
  teknisi_id: string;
  teknisi_nama: string;
  material_id: string;
  material_code: string;
  material_nama: string;
  merk: string;
  satuan: string;
  wajib_sn: boolean;
  serial_number_id: string | null;
  serial_number: string | null;
  qty: number;
  kondisi: string;
  source_request_id: string | null;
  source_request_code: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SerialStatus =
  | "AVAILABLE"
  | "IN_TECHNICIAN_BAG"
  | "USED"
  | "RETURN_PENDING"
  | "RETURNED"
  | "SO_PENDING"
  | "LOST"
  | "DAMAGED";
