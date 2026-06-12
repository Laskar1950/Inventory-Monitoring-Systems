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
  if (req.status !== "LEADER_APPROVED") return NextResponse.json({ error: "Request harus sudah disetujui Leader sebelum Koordinator approve." }, { status: 400 });

  const { error } = await supabase.rpc("koordinator_sign_surat_jalan", { p_request_id: id, p_koordinator_id: profile.id, p_signature_url: profile.signature_url });
  if (error) return NextResponse.json({ error: error.message || "Gagal memproses Koordinator." }, { status: 400 });

  await notifyByRole(["SUPERVISOR"], { title: "Request menunggu approval Supervisor", message: `Request ${req.request_code} sudah disetujui Koordinator dan menunggu approval Supervisor.`, entityType: "material_requests", entityId: id, linkUrl: "/approvals/supervisor" });
  if (req.teknisi_id) await notifyUser(req.teknisi_id, { title: "Request disetujui Koordinator", message: `Request ${req.request_code} menunggu approval Supervisor.`, entityType: "material_requests", entityId: id, linkUrl: "/requests" });

  return NextResponse.json({ message: "Request berhasil di-approve Koordinator." });
}
