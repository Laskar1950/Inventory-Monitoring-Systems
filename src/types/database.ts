export type UserRole = "TEKNISI" | "ADMIN" | "SUPERVISOR" | "LEADER" | "KOORDINATOR";

export type TransactionStatus =
  | "PENDING"
  | "LEADER_APPROVED"
  | "WAITING_SIGNATURE"
  | "KOORDINATOR_SIGNED"
  | "APPROVED"
  | "REJECTED"
  | "REVISION"
  | "REJECTED_FINAL"
  | "COMPLETED"
  | "CANCELLED";

export type Profile = {
  id: string;
  auth_user_id: string;
  nama: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  keterangan?: string | null;
  photo_url?: string | null;
  signature_url?: string | null;
  signature_type?: string | null;
  signature_updated_at?: string | null;
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
  teknisi_email: string | null;
  basecamp: string | null;
  referensi_pekerjaan: string | null;
  status: TransactionStatus;
  catatan_teknisi: string | null;
  catatan_admin: string | null;
  leader_id: string | null;
  leader_nama: string | null;
  leader_approved_at: string | null;
  leader_catatan: string | null;
  approved_by: string | null;
  approved_by_nama: string | null;
  approved_at: string | null;
  admin_signature_url: string | null;
  admin_signed_at: string | null;
  koordinator_id: string | null;
  koordinator_nama: string | null;
  koordinator_signed_at: string | null;
  koordinator_signature_url: string | null;
  supervisor_id: string | null;
  supervisor_nama: string | null;
  supervisor_signed_at: string | null;
  supervisor_signature_url: string | null;
  surat_jalan_number: string | null;
  surat_jalan_url: string | null;
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
  serial_numbers?: string[];
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

export type SuratJalanData = {
  request_code: string;
  surat_jalan_number: string;
  teknisi_nama: string;
  teknisi_email: string | null;
  basecamp: string | null;
  referensi_pekerjaan: string | null;
  created_at: string;
  approved_at: string | null;
  admin_nama: string | null;
  admin_signature_url: string | null;
  admin_signed_at: string | null;
  koordinator_nama: string | null;
  koordinator_signature_url: string | null;
  koordinator_signed_at: string | null;
  supervisor_nama: string | null;
  supervisor_signature_url: string | null;
  supervisor_signed_at: string | null;
  items: Array<{
    no: number;
    material_nama: string;
    material_code: string;
    qty: number;
    kondisi: string;
    serial_numbers: string[];
  }>;
};
