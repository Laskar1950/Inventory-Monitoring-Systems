import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR") return NextResponse.json({ error: "Hanya Supervisor yang boleh approval final surat jalan." }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: req } = await supabase.from("material_requests").select("id,request_code,teknisi_id,status,surat_jalan_number").eq("id", id).single();
  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (req.status !== "KOORDINATOR_SIGNED") return NextResponse.json({ error: "Surat jalan harus sudah diproses Koordinator." }, { status: 400 });

  const contentType = request.headers.get("content-type") || "";
  let fileUrl = "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const mode = String(formData.get("signature_type") || "digital");
    if (mode === "digital") {
      fileUrl = `digital-${profile.id}-${Date.now()}`;
    } else {
      const file = formData.get("signature") as File | null;
      if (!file || file.size === 0) return NextResponse.json({ error: "File wajib diupload." }, { status: 400 });
      if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "File harus berupa JPG, PNG, atau WEBP." }, { status: 400 });
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran file maksimal 3 MB." }, { status: 400 });
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filePath = `supervisor/${profile.id}/${id}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from("signatures").upload(filePath, buffer, { contentType: file.type, upsert: true });
      if (uploadError) return NextResponse.json({ error: `Gagal upload file: ${uploadError.message}` }, { status: 500 });
      fileUrl = filePath;
    }
  } else {
    fileUrl = `digital-${profile.id}-${Date.now()}`;
  }

  const { data, error } = await supabase.rpc("supervisor_approve_surat_jalan", { p_request_id: id, p_supervisor_id: profile.id, p_signature_url: fileUrl });
  if (error) return NextResponse.json({ error: error.message || "Gagal approval final surat jalan." }, { status: 400 });

  if (req.teknisi_id) await notifyUser(req.teknisi_id, { title: "Request material final approved", message: `Surat jalan ${req.surat_jalan_number ?? req.request_code} sudah final approved. Material masuk ke Tas Saya.`, entityType: "material_requests", entityId: id, linkUrl: "/my-bag" });

  return NextResponse.json({ data, message: "Approval final Supervisor berhasil. Material sudah masuk ke tas teknisi." });
}
