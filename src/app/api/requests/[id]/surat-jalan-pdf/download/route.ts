import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSuratJalanPdf } from "@/lib/surat-jalan-pdf";

export const runtime = "nodejs";

function safeFileName(value?: string | null) {
  const raw = value || "surat-jalan";
  return raw.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: req, error: reqError } = await supabase
    .from("material_requests")
    .select("id,request_code,teknisi_id,status,surat_jalan_number,surat_jalan_url")
    .eq("id", id)
    .single();

  if (reqError || !req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (profile.role === "TEKNISI" && req.teknisi_id !== profile.id) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  if (req.status !== "COMPLETED") return NextResponse.json({ error: "PDF final tersedia setelah Surat Jalan berstatus selesai." }, { status: 400 });

  let filePath = req.surat_jalan_url as string | null;
  if (!filePath) {
    const generated = await generateSuratJalanPdf(supabase, id);
    filePath = generated.filePath;
  }

  const { data: file, error: downloadError } = await supabase.storage.from("surat-jalan").download(filePath);
  if (downloadError || !file) return NextResponse.json({ error: downloadError?.message || "File PDF Surat Jalan tidak ditemukan." }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${safeFileName(req.surat_jalan_number || req.request_code)}.pdf`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
