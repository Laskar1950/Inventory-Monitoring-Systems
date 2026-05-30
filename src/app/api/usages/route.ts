import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPagination, paginationMeta } from "@/lib/pagination";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
type UsageItemPayload = { bag_id: string; qty: number };

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  const { page, limit, from } = getPagination(request, 20, 75);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("list_material_usages_page", {
    p_profile_id: profile.id,
    p_role: profile.role,
    p_limit: limit,
    p_offset: from,
  });
  if (error) return NextResponse.json({ error: "Gagal memuat laporan penggunaan." }, { status: 500 });
  const rows = data ?? [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  const cleaned = rows.map(({ total_count, ...row }: any) => row);
  return NextResponse.json({ data: cleaned, meta: paginationMeta(total, page, limit) });
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "TEKNISI") return NextResponse.json({ error: "Hanya Teknisi yang dapat mencatat penggunaan material." }, { status: 403 });
  try {
    const formData = await request.formData();
    const noTiket = String(formData.get("no_tiket") ?? "").trim();
    const namaPelanggan = String(formData.get("nama_pelanggan") ?? "").trim();
    const idPelanggan = String(formData.get("id_pelanggan") ?? "").trim();
    const alamat = String(formData.get("alamat") ?? "").trim();
    const rootCause = String(formData.get("root_cause") ?? "").trim();
    const itemsRaw = String(formData.get("items") ?? "[]");
    const foto = formData.get("foto") as File | null;
    if (!noTiket) return NextResponse.json({ error: "Nomor tiket wajib diisi." }, { status: 400 });
    if (!rootCause) return NextResponse.json({ error: "Root cause wajib diisi." }, { status: 400 });
    if (!foto || foto.size === 0) return NextResponse.json({ error: "Foto eviden wajib diupload." }, { status: 400 });
    if (!ALLOWED_TYPES.has(foto.type)) return NextResponse.json({ error: "Foto eviden harus berupa JPG, PNG, atau WEBP." }, { status: 400 });
    if (foto.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran foto eviden maksimal 5 MB." }, { status: 400 });
    let items: UsageItemPayload[];
    try { items = JSON.parse(itemsRaw) as UsageItemPayload[]; } catch { return NextResponse.json({ error: "Payload item penggunaan tidak valid." }, { status: 400 }); }
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Minimal satu material harus ditambahkan." }, { status: 400 });
    for (const item of items) if (!item.bag_id || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0) return NextResponse.json({ error: "Material dan qty penggunaan wajib valid." }, { status: 400 });
    const supabase = createAdminClient();
    const ext = foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
    const filePath = `${profile.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await foto.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("usage-evidence").upload(filePath, buffer, { contentType: foto.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: `Foto gagal diupload: ${uploadError.message}` }, { status: 500 });
    const { data, error } = await supabase.rpc("create_material_usage", { p_teknisi_id: profile.id, p_no_tiket: noTiket, p_nama_pelanggan: namaPelanggan || null, p_id_pelanggan: idPelanggan || null, p_alamat: alamat || null, p_root_cause: rootCause, p_foto_url: filePath, p_items: items.map((item) => ({ bag_id: item.bag_id, qty: Number(item.qty) })) });
    if (error) { await supabase.storage.from("usage-evidence").remove([filePath]); return NextResponse.json({ error: error.message || "Gagal menyimpan penggunaan material." }, { status: 400 }); }
    return NextResponse.json({ data, message: "Penggunaan material berhasil dicatat." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan penggunaan material.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
