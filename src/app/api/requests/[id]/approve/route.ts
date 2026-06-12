import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";

const schema = z.object({
  catatan_admin: z.string().optional().nullable(),
  items: z.array(z.object({
    item_id: z.string().uuid(),
    qty_approved: z.number().int().min(0),
    serial_ids: z.array(z.string().uuid()).optional().default([]),
  })).optional().default([]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh memproses surat jalan." }, { status: 403 });
  if (!profile.signature_url) return NextResponse.json({ error: "Tanda tangan Admin belum tersedia. Lengkapi tanda tangan digital di halaman Profil Saya terlebih dahulu." }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload approval tidak valid." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: requestBefore } = await supabase
    .from("material_requests")
    .select("id,request_code,teknisi_id,status")
    .eq("id", id)
    .single();

  if (!requestBefore) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (requestBefore.status !== "WAITING_SIGNATURE") {
    return NextResponse.json({ error: "Request harus sudah disetujui Supervisor sebelum Admin memproses Surat Jalan." }, { status: 400 });
  }

  const { data: requestItems, error: itemLoadError } = await supabase
    .from("material_request_items")
    .select("id,material_id,qty_requested,materials(material_code,nama,wajib_sn)")
    .eq("request_id", id);
  if (itemLoadError) return NextResponse.json({ error: "Gagal memuat item request." }, { status: 500 });

  const requestItemMap = new Map((requestItems ?? []).map((item: any) => [item.id, item]));
  const payloadItems = parsed.data.items.length > 0
    ? parsed.data.items
    : (requestItems ?? []).map((item: any) => ({ item_id: item.id, qty_approved: item.qty_requested, serial_ids: [] }));

  const usedSerialIds = new Set<string>();
  for (const item of payloadItems) {
    const requestItem: any = requestItemMap.get(item.item_id);
    if (!requestItem) return NextResponse.json({ error: "Item request tidak valid." }, { status: 400 });
    const material = Array.isArray(requestItem.materials) ? requestItem.materials[0] : requestItem.materials;
    const wajibSn = Boolean(material?.wajib_sn);
    if (item.qty_approved > requestItem.qty_requested) return NextResponse.json({ error: `Qty approved ${material?.material_code ?? "material"} tidak boleh melebihi qty diminta.` }, { status: 400 });
    if (wajibSn && item.serial_ids.length !== item.qty_approved) return NextResponse.json({ error: `Jumlah serial number ${material?.material_code ?? "material"} harus sama dengan qty approved.` }, { status: 400 });
    if (!wajibSn && item.serial_ids.length > 0) return NextResponse.json({ error: `Material ${material?.material_code ?? "material"} bukan material serial.` }, { status: 400 });
    for (const serialId of item.serial_ids) {
      if (usedSerialIds.has(serialId)) return NextResponse.json({ error: "Serial number tidak boleh dipilih lebih dari satu kali." }, { status: 400 });
      usedSerialIds.add(serialId);
    }
  }

  if (usedSerialIds.size > 0) {
    const { data: serialRows, error: serialError } = await supabase
      .from("material_serial_numbers")
      .select("id,material_id,serial_number,status,location_type")
      .in("id", Array.from(usedSerialIds));
    if (serialError) return NextResponse.json({ error: "Gagal validasi serial number." }, { status: 500 });
    const serialMap = new Map((serialRows ?? []).map((s: any) => [s.id, s]));
    for (const item of payloadItems) {
      const requestItem: any = requestItemMap.get(item.item_id);
      for (const serialId of item.serial_ids) {
        const serial: any = serialMap.get(serialId);
        if (!serial) return NextResponse.json({ error: "Serial number terpilih tidak ditemukan." }, { status: 400 });
        if (serial.material_id !== requestItem.material_id) return NextResponse.json({ error: `Serial number ${serial.serial_number} tidak sesuai material.` }, { status: 400 });
        if (serial.status !== "AVAILABLE" || serial.location_type !== "GUDANG") return NextResponse.json({ error: `Serial number ${serial.serial_number} tidak tersedia di gudang.` }, { status: 400 });
      }
    }
  }

  await supabase.from("material_request_item_serials").delete().eq("request_id", id);

  for (const item of payloadItems) {
    const requestItem: any = requestItemMap.get(item.item_id);
    const { error: itemError } = await supabase
      .from("material_request_items")
      .update({ qty_approved: item.qty_approved, status: item.qty_approved > 0 ? "APPROVED" : "REJECTED" })
      .eq("id", item.item_id);
    if (itemError) return NextResponse.json({ error: itemError.message || "Gagal update qty approved." }, { status: 400 });

    if (item.serial_ids.length > 0) {
      const rows = item.serial_ids.map((serialId) => ({
        request_id: id,
        request_item_id: item.item_id,
        material_id: requestItem.material_id,
        serial_number_id: serialId,
        selected_by: profile.id,
      }));
      const { error: serialInsertError } = await supabase.from("material_request_item_serials").insert(rows);
      if (serialInsertError) return NextResponse.json({ error: serialInsertError.message || "Gagal menyimpan serial pilihan Admin." }, { status: 400 });
    }
  }

  const now = new Date();
  const suratJalanNumber = `SJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${requestBefore.request_code}`;
  const { data, error } = await supabase.rpc("admin_process_material_request", {
    p_request_id: id,
    p_admin_id: profile.id,
    p_signature_url: profile.signature_url,
    p_catatan_admin: parsed.data.catatan_admin ?? null,
    p_surat_jalan_number: suratJalanNumber,
  });
  if (error) return NextResponse.json({ error: error.message || "Gagal memproses Surat Jalan." }, { status: 400 });

  if (requestBefore.teknisi_id) {
    await notifyUser(requestBefore.teknisi_id, {
      title: "Material siap diterima",
      message: `Request ${requestBefore.request_code} telah diproses Admin Gudang. Material masuk ke Tas Saya dan menunggu tanda tangan penerimaan.`,
      entityType: "material_requests",
      entityId: id,
      linkUrl: "/requests",
    });
  }

  return NextResponse.json({ data, surat_jalan_number: suratJalanNumber, message: "Surat Jalan berhasil diproses Admin Gudang. Material siap diterima teknisi." });
}
