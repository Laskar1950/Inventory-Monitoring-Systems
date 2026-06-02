import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type RevisionItemPayload = { item_id: string; file_key: string };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "TEKNISI") return NextResponse.json({ error: "Hanya Teknisi yang dapat mengirim revisi stok opname." }, { status: 403 });

  const uploadedPaths: string[] = [];
  const supabase = createAdminClient();

  try {
    const { data: so, error: soError } = await supabase
      .from("stock_opnames")
      .select("id,teknisi_id,status")
      .eq("id", id)
      .single();

    if (soError || !so) return NextResponse.json({ error: "Data stok opname tidak ditemukan." }, { status: 404 });
    if (so.teknisi_id !== profile.id) return NextResponse.json({ error: "Teknisi hanya boleh merevisi stok opname miliknya." }, { status: 403 });
    if (so.status !== "REVISION") return NextResponse.json({ error: "Stok opname ini tidak sedang berstatus revisi." }, { status: 400 });

    const formData = await request.formData();
    const itemsRaw = String(formData.get("items") ?? "[]");
    let items: RevisionItemPayload[];
    try { items = JSON.parse(itemsRaw) as RevisionItemPayload[]; } catch { return NextResponse.json({ error: "Payload revisi tidak valid." }, { status: 400 }); }
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Minimal ada satu foto revisi yang dikirim." }, { status: 400 });

    const ids = items.map((item) => item.item_id).filter(Boolean);
    const { data: revisionRows, error: itemError } = await supabase
      .from("stock_opname_items")
      .select("id,stock_opname_id,status_review")
      .eq("stock_opname_id", id)
      .in("id", ids);

    if (itemError) return NextResponse.json({ error: "Gagal memvalidasi item revisi." }, { status: 500 });
    const revisionMap = new Map((revisionRows || []).map((row) => [row.id, row]));

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const row = revisionMap.get(item.item_id);
      if (!row) return NextResponse.json({ error: "Item revisi tidak ditemukan." }, { status: 404 });
      if (row.status_review !== "REVISION") return NextResponse.json({ error: "Hanya item berstatus Revisi yang dapat diupload ulang." }, { status: 400 });

      const fileKey = item.file_key || `foto_revisi_${index}`;
      const foto = formData.get(fileKey) as File | null;
      if (!foto || foto.size === 0) return NextResponse.json({ error: "Foto revisi wajib diupload untuk setiap item revisi." }, { status: 400 });
      if (!ALLOWED_TYPES.has(foto.type)) return NextResponse.json({ error: "Foto revisi harus berupa JPG, PNG, atau WEBP." }, { status: 400 });
      if (foto.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran foto revisi maksimal 5 MB per item." }, { status: 400 });

      const ext = foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
      const filePath = `${profile.id}/revision-${id}-${Date.now()}-${index}-${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await foto.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from("stock-opname-evidence").upload(filePath, buffer, { contentType: foto.type, upsert: false });
      if (uploadError) return NextResponse.json({ error: `Foto revisi gagal diupload: ${uploadError.message}` }, { status: 500 });
      uploadedPaths.push(filePath);

      const { error: updateItemError } = await supabase
        .from("stock_opname_items")
        .update({ foto_url: filePath, status_review: "PENDING" })
        .eq("id", item.item_id)
        .eq("stock_opname_id", id);
      if (updateItemError) return NextResponse.json({ error: updateItemError.message || "Gagal menyimpan foto revisi." }, { status: 400 });
    }

    const { error: updateSoError } = await supabase
      .from("stock_opnames")
      .update({ status: "PENDING", reviewed_at: null })
      .eq("id", id);
    if (updateSoError) return NextResponse.json({ error: updateSoError.message || "Gagal mengubah status stok opname." }, { status: 400 });

    await supabase.from("activity_logs").insert({
      actor_id: profile.id,
      actor_role: "TEKNISI",
      action: "REVISION_STOCK_OPNAME",
      entity_type: "stock_opnames",
      entity_id: id,
      description: "Teknisi mengirim revisi foto stok opname",
      metadata: { item_count: items.length },
    });

    return NextResponse.json({ message: "Revisi stok opname berhasil dikirim untuk review ulang admin." });
  } catch (error) {
    if (uploadedPaths.length > 0) await supabase.storage.from("stock-opname-evidence").remove(uploadedPaths);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengirim revisi stok opname." }, { status: 500 });
  }
}
