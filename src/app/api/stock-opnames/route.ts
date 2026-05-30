import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPagination, paginationMeta } from "@/lib/pagination";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type StockOpnameItemPayload = { bag_id: string; qty_physical: number; kondisi_fisik: string; file_key: string };

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  const { page, limit, from, to } = getPagination(request, 20, 75);
  const supabase = createAdminClient();
  let query = supabase.from("stock_opname_summary").select("id,so_code,teknisi_id,teknisi_nama,status,catatan_teknisi,reviewed_by_nama,reviewed_at,created_at,item_count,total_system_qty,total_physical_qty,total_selisih,problem_count", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (profile.role === "TEKNISI") query = query.eq("teknisi_id", profile.id);
  const { data: summaries, error, count } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat stok opname." }, { status: 500 });
  const ids = (summaries || []).map((row) => row.id);
  let items: unknown[] = [];
  if (ids.length > 0) {
    const { data: itemRows, error: itemError } = await supabase.from("stock_opname_item_detail").select("id,stock_opname_id,bag_id,material_id,material_code,material_nama,serial_number,qty_system,qty_physical,selisih,kondisi_fisik,foto_url,status_review,catatan_admin,created_at").in("stock_opname_id", ids).order("created_at", { ascending: true });
    if (itemError) return NextResponse.json({ error: "Gagal memuat detail stok opname." }, { status: 500 });
    items = itemRows || [];
  }
  return NextResponse.json({ data: summaries || [], items, meta: paginationMeta(count, page, limit) });
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "TEKNISI") return NextResponse.json({ error: "Hanya Teknisi yang dapat mengirim stok opname." }, { status: 403 });
  const uploadedPaths: string[] = [];
  try {
    const formData = await request.formData();
    const catatanTeknisi = String(formData.get("catatan_teknisi") ?? "").trim();
    const itemsRaw = String(formData.get("items") ?? "[]");
    let items: StockOpnameItemPayload[];
    try { items = JSON.parse(itemsRaw) as StockOpnameItemPayload[]; } catch { return NextResponse.json({ error: "Payload item stok opname tidak valid." }, { status: 400 }); }
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Minimal harus ada satu item stok opname." }, { status: 400 });
    const supabase = createAdminClient();
    const rpcItems = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.bag_id || !Number.isFinite(Number(item.qty_physical)) || Number(item.qty_physical) < 0) return NextResponse.json({ error: "Qty fisik wajib angka dan tidak boleh negatif." }, { status: 400 });
      if (!item.kondisi_fisik?.trim()) return NextResponse.json({ error: "Kondisi fisik wajib dipilih untuk setiap item." }, { status: 400 });
      const fileKey = item.file_key || `foto_${index}`;
      const foto = formData.get(fileKey) as File | null;
      if (!foto || foto.size === 0) return NextResponse.json({ error: "Foto bukti wajib diupload untuk setiap item." }, { status: 400 });
      if (!ALLOWED_TYPES.has(foto.type)) return NextResponse.json({ error: "Foto bukti harus berupa JPG, PNG, atau WEBP." }, { status: 400 });
      if (foto.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran foto bukti maksimal 5 MB per item." }, { status: 400 });
      const ext = foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
      const filePath = `${profile.id}/${Date.now()}-${index}-${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await foto.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from("stock-opname-evidence").upload(filePath, buffer, { contentType: foto.type, upsert: false });
      if (uploadError) return NextResponse.json({ error: `Foto bukti gagal diupload: ${uploadError.message}` }, { status: 500 });
      uploadedPaths.push(filePath);
      rpcItems.push({ bag_id: item.bag_id, qty_physical: Number(item.qty_physical), kondisi_fisik: item.kondisi_fisik, foto_url: filePath });
    }
    const { data, error } = await supabase.rpc("create_stock_opname", { p_teknisi_id: profile.id, p_catatan_teknisi: catatanTeknisi || null, p_items: rpcItems });
    if (error) { await supabase.storage.from("stock-opname-evidence").remove(uploadedPaths); return NextResponse.json({ error: error.message || "Gagal menyimpan stok opname." }, { status: 400 }); }
    return NextResponse.json({ data, message: "Laporan stok opname berhasil dikirim." }, { status: 201 });
  } catch (error) {
    if (uploadedPaths.length > 0) await createAdminClient().storage.from("stock-opname-evidence").remove(uploadedPaths);
    const message = error instanceof Error ? error.message : "Gagal menyimpan stok opname.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
