import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSuratJalanPdf } from "@/lib/surat-jalan-pdf";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: req } = await supabase.from("material_requests").select("id,teknisi_id,status").eq("id", id).single();
  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (profile.role === "TEKNISI" && req.teknisi_id !== profile.id) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  if (req.status !== "COMPLETED") return NextResponse.json({ error: "PDF final hanya dapat dibuat setelah Teknisi menerima material." }, { status: 400 });
  try {
    const data = await generateSuratJalanPdf(supabase, id);
    return NextResponse.json({ data, message: "PDF final Surat Jalan berhasil dibuat." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat PDF Surat Jalan." }, { status: 400 });
  }
}
