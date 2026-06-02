import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN" && profile.role !== "SUPERVISOR") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const supabase = createAdminClient();
  const { data: requestRow, error: requestError } = await supabase
    .from("material_request_summary")
    .select("*")
    .eq("id", id)
    .single();

  if (requestError || !requestRow) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });

  const [{ data: itemRows, error: itemError }, { data: movementRows, error: movementError }] = await Promise.all([
    supabase
      .from("material_request_items")
      .select("id,request_id,material_id,qty_requested,qty_approved,status,materials(material_code,nama,merk,satuan,wajib_sn)")
      .eq("request_id", id)
      .order("created_at"),
    supabase
      .from("material_serial_movement_detail")
      .select("id,serial_number_id,serial_number,material_id,material_code,material_nama,movement_type,from_location_type,to_location_type,to_teknisi_nama,reference_id,reference_item_id,note,created_at")
      .eq("reference_type", "material_requests")
      .eq("reference_id", id)
      .eq("movement_type", "REQUEST_APPROVED")
      .order("created_at"),
  ]);

  if (itemError) return NextResponse.json({ error: "Gagal memuat item request." }, { status: 500 });
  if (movementError) return NextResponse.json({ error: "Gagal memuat riwayat serial number. Pastikan patch Phase 11 sudah dijalankan." }, { status: 500 });

  const movements = movementRows || [];
  const items = (itemRows || []).map((row: any) => {
    const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
    const serials = movements.filter((m: any) => m.reference_item_id === row.id || m.material_id === row.material_id);
    return {
      id: row.id,
      request_id: row.request_id,
      material_id: row.material_id,
      material_code: material?.material_code ?? "-",
      material_nama: material?.nama ?? "-",
      merk: material?.merk ?? "-",
      satuan: material?.satuan ?? "-",
      wajib_sn: Boolean(material?.wajib_sn),
      qty_requested: row.qty_requested,
      qty_approved: row.qty_approved,
      status: row.status,
      serials,
    };
  });

  return NextResponse.json({ data: { ...requestRow, items, movements } });
}
