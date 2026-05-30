import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPagination, paginationMeta } from "@/lib/pagination";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ReturnItemPayload = { bag_id?: string; material_code?: string; nama?: string; merk?: string; satuan?: string; wajib_sn?: boolean; serial_number?: string; qty: number };

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  const { page, limit, from } = getPagination(request, 20, 75);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("list_material_returns_page", {
    p_profile_id: profile.id,
    p_role: profile.role,
    p_limit: limit,
    p_offset: from,
  });
  if (error) return NextResponse.json({ error: "Gagal memuat data pengembalian." }, { status: 500 });
  const rows = data ?? [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  const cleaned = rows.map(({ total_count, ...row }: any) => row);
  return NextResponse.json({ data: cleaned, meta: paginationMeta(total, page, limit) });
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "TEKNISI") return NextResponse.json({ error: "Hanya Teknisi yang dapat mengirim pengembalian material." }, { status: 403 });
  try {
    const formData = await request.formData();
    const sourceType = String(formData.get("source_type") ?? "").trim().toUpperCase();
    const kondisi = String(formData.get("kondisi") ?? "").trim().toUpperCase();
    const keterangan = String(formData.get("keterangan") ?? "").trim();
    const itemsRaw = String(formData.get("items") ?? "[]");
    const foto = formData.get("foto") as File | null;
    if (!["BAG", "MANUAL"].includes(sourceType)) return NextResponse.json({ error: "Sumber pengembalian tidak valid." }, { status: 400 });
    if (!kondisi) return NextResponse.json({ error: "Kondisi wajib dipilih." }, { status: 400 });
    if (!foto || foto.size === 0) return NextResponse.json({ error: "Foto material wajib diupload." }, { status: 400 });
    if (!ALLOWED_TYPES.has(foto.type)) return NextResponse.json({ error: "Foto return harus berupa JPG, PNG, atau WEBP." }, { status: 400 });
    if (foto.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran foto return maksimal 5 MB." }, { status: 400 });
    let items: ReturnItemPayload[];
    try { items = JSON.parse(itemsRaw) as ReturnItemPayload[]; } catch { return NextResponse.json({ error: "Payload item return tidak valid." }, { status: 400 }); }
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Minimal satu material pengembalian harus ditambahkan." }, { status: 400 });
    for (const item of items) {
      const qty = Number(item.qty);
      if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: "Qty return wajib lebih dari 0." }, { status: 400 });
      if (sourceType === "BAG" && !item.bag_id) return NextResponse.json({ error: "Material dari tas wajib dipilih." }, { status: 400 });
      if (sourceType === "MANUAL") {
        if (!item.material_code || !item.nama || !item.merk || !item.satuan) return NextResponse.json({ error: "Material ID, nama, merk, dan satuan wajib diisi untuk return manual." }, { status: 400 });
        if (item.wajib_sn && (!item.serial_number || qty !== 1)) return NextResponse.json({ error: "Material manual berserial wajib memiliki SN dan qty harus 1." }, { status: 400 });
      }
    }
    const supabase = createAdminClient();
    const ext = foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
    const filePath = `${profile.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await foto.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("return-evidence").upload(filePath, buffer, { contentType: foto.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: `Foto gagal diupload: ${uploadError.message}` }, { status: 500 });
    const normalizedItems = items.map((item) => ({ bag_id: item.bag_id || null, material_code: item.material_code ? String(item.material_code).toUpperCase().trim() : null, nama: item.nama ? String(item.nama).trim() : null, merk: item.merk ? String(item.merk).trim() : null, satuan: item.satuan ? String(item.satuan).toUpperCase().trim() : null, wajib_sn: Boolean(item.wajib_sn), serial_number: item.serial_number ? String(item.serial_number).toUpperCase().trim() : null, qty: Number(item.qty) }));
    const { data, error } = await supabase.rpc("create_material_return", { p_teknisi_id: profile.id, p_source_type: sourceType, p_kondisi: kondisi, p_foto_url: filePath, p_keterangan: keterangan || null, p_items: normalizedItems });
    if (error) { await supabase.storage.from("return-evidence").remove([filePath]); return NextResponse.json({ error: error.message || "Gagal menyimpan pengembalian material." }, { status: 400 }); }
    return NextResponse.json({ data, message: "Pengembalian material berhasil dikirim." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan pengembalian material.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
