import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSuratJalanPdf } from "@/lib/surat-jalan-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: req } = await supabase.from("material_requests").select("id,teknisi_id,status,surat_jalan_url").eq("id", id).single();
  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (profile.role === "TEKNISI" && req.teknisi_id !== profile.id) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  if (req.status !== "COMPLETED") return NextResponse.json({ error: "PDF final tersedia setelah Surat Jalan berstatus selesai." }, { status: 400 });

  let filePath = req.surat_jalan_url as string | null;
  if (!filePath) {
    const generated = await generateSuratJalanPdf(supabase, id);
    filePath = generated.filePath;
  }

  const { data, error } = await supabase.storage.from("surat-jalan").createSignedUrl(filePath, 60 * 10);
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || "Gagal membuat link PDF." }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl, path: filePath });
}
