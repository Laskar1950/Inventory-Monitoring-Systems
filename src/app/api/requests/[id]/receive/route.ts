import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyByRole } from "@/lib/notifications";
import { generateSuratJalanPdf } from "@/lib/surat-jalan-pdf";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "TEKNISI") return NextResponse.json({ error: "Hanya Teknisi yang dapat menerima material." }, { status: 403 });
  if (!profile.signature_url) return NextResponse.json({ error: "Tanda tangan Teknisi belum tersedia. Lengkapi tanda tangan digital di halaman Profil Saya terlebih dahulu." }, { status: 400 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: req } = await supabase.from("material_requests").select("id,request_code,teknisi_id,status,surat_jalan_number").eq("id", id).single();
  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (req.teknisi_id !== profile.id) return NextResponse.json({ error: "Teknisi hanya dapat menerima material miliknya sendiri." }, { status: 403 });
  if (req.status !== "APPROVED") return NextResponse.json({ error: "Material hanya bisa diterima setelah approval final Supervisor." }, { status: 400 });

  const { data, error } = await supabase.rpc("technician_receive_surat_jalan", { p_request_id: id, p_teknisi_id: profile.id, p_signature_url: profile.signature_url });
  if (error) return NextResponse.json({ error: error.message || "Gagal menerima material." }, { status: 400 });

  let pdfResult: { filePath: string; suratJalanNumber: string } | null = null;
  try {
    pdfResult = await generateSuratJalanPdf(supabase, id);
  } catch (pdfError) {
    await notifyByRole(["ADMIN", "SUPERVISOR"], {
      title: "Material diterima teknisi",
      message: `${profile.nama} telah menandatangani penerimaan material untuk ${req.surat_jalan_number ?? req.request_code}, tetapi PDF final belum berhasil dibuat: ${pdfError instanceof Error ? pdfError.message : "Gagal generate PDF"}.`,
      entityType: "material_requests",
      entityId: id,
      linkUrl: "/approvals/requests",
    });
    return NextResponse.json({ data, warning: pdfError instanceof Error ? pdfError.message : "Gagal generate PDF final.", message: "Material berhasil diterima, tetapi PDF final belum berhasil dibuat. Silakan generate ulang dari halaman Surat Jalan." });
  }

  await notifyByRole(["ADMIN", "SUPERVISOR"], {
    title: "Material diterima teknisi",
    message: `${profile.nama} telah menandatangani penerimaan material untuk ${req.surat_jalan_number ?? req.request_code}. PDF final Surat Jalan sudah dibuat.`,
    entityType: "material_requests",
    entityId: id,
    linkUrl: "/approvals/requests",
  });

  return NextResponse.json({ data: { request: data, pdf: pdfResult }, message: "Material berhasil diterima dan PDF final Surat Jalan telah dibuat." });
}
