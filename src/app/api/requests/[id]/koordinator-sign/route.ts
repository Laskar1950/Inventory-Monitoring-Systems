import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyByRole, notifyUser } from "@/lib/notifications";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "KOORDINATOR") return NextResponse.json({ error: "Hanya Koordinator yang dapat memproses tahap ini." }, { status: 403 });
  if (!profile.signature_url) return NextResponse.json({ error: "Tanda tangan Koordinator belum tersedia. Lengkapi tanda tangan digital di halaman Profil Saya terlebih dahulu." }, { status: 400 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: req } = await supabase.from("material_requests").select("id,request_code,teknisi_id,status,surat_jalan_number").eq("id", id).single();
  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (req.status !== "WAITING_SIGNATURE") return NextResponse.json({ error: "Request tidak dalam status menunggu Koordinator." }, { status: 400 });

  const { error } = await supabase.rpc("koordinator_sign_surat_jalan", { p_request_id: id, p_koordinator_id: profile.id, p_signature_url: profile.signature_url });
  if (error) return NextResponse.json({ error: error.message || "Gagal memproses Koordinator." }, { status: 400 });

  await notifyByRole(["SUPERVISOR"], { title: "Surat jalan menunggu approval final", message: `Surat jalan ${req.surat_jalan_number ?? req.request_code} menunggu approval final Supervisor.`, entityType: "material_requests", entityId: id, linkUrl: "/approvals/supervisor" });
  if (req.teknisi_id) await notifyUser(req.teknisi_id, { title: "Surat jalan diproses Koordinator", message: `Surat jalan ${req.surat_jalan_number ?? req.request_code} menunggu approval final Supervisor.`, entityType: "material_requests", entityId: id, linkUrl: "/requests" });

  return NextResponse.json({ message: "Surat jalan berhasil ditandatangani Koordinator." });
}
