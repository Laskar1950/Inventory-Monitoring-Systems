import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR") return NextResponse.json({ error: "Hanya Supervisor yang boleh approval final surat jalan." }, { status: 403 });
  if (!profile.signature_url) return NextResponse.json({ error: "Tanda tangan Supervisor belum tersedia. Lengkapi tanda tangan digital di halaman Profil Saya terlebih dahulu." }, { status: 400 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: req } = await supabase.from("material_requests").select("id,request_code,teknisi_id,status,surat_jalan_number").eq("id", id).single();
  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (req.status !== "KOORDINATOR_SIGNED") return NextResponse.json({ error: "Surat jalan harus sudah diproses Koordinator." }, { status: 400 });

  const { data, error } = await supabase.rpc("supervisor_approve_surat_jalan", { p_request_id: id, p_supervisor_id: profile.id, p_signature_url: profile.signature_url });
  if (error) return NextResponse.json({ error: error.message || "Gagal approval final surat jalan." }, { status: 400 });

  if (req.teknisi_id) await notifyUser(req.teknisi_id, { title: "Request material final approved", message: `Surat jalan ${req.surat_jalan_number ?? req.request_code} sudah final approved. Material masuk ke Tas Saya dan menunggu tanda tangan penerimaan teknisi.`, entityType: "material_requests", entityId: id, linkUrl: "/requests" });

  return NextResponse.json({ data, message: "Approval final Supervisor berhasil. Material sudah masuk ke tas teknisi." });
}
