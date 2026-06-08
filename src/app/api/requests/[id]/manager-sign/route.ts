import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser, notifyByRole } from "@/lib/notifications";

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "MANAGER") return NextResponse.json({ error: "Hanya Manager yang dapat menandatangani di tahap ini." }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: req } = await supabase
    .from("material_requests")
    .select("id,request_code,teknisi_id,status,surat_jalan_number")
    .eq("id", id)
    .single();

  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (req.status !== "KOORDINATOR_SIGNED") return NextResponse.json({ error: "Request belum ditandatangani Koordinator." }, { status: 400 });

  const contentType = request.headers.get("content-type") || "";
  let signatureUrl = "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const signatureType = String(formData.get("signature_type") || "upload");

    if (signatureType === "digital") {
      signatureUrl = `digital:${profile.nama}:${new Date().toISOString()}`;
    } else {
      const file = formData.get("signature") as File | null;
      if (!file || file.size === 0) return NextResponse.json({ error: "File tanda tangan wajib diupload." }, { status: 400 });
      if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Tanda tangan harus berupa JPG, PNG, atau WEBP." }, { status: 400 });
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran file tanda tangan maksimal 3 MB." }, { status: 400 });

      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filePath = `manager/${profile.id}/${id}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(filePath, buffer, { contentType: file.type, upsert: true });

      if (uploadError) return NextResponse.json({ error: `Gagal upload tanda tangan: ${uploadError.message}` }, { status: 500 });
      signatureUrl = filePath;
    }
  } else {
    return NextResponse.json({ error: "Content-Type harus multipart/form-data." }, { status: 400 });
  }

  // Manager sign → material masuk ke tas teknisi via RPC
  const { error } = await supabase.rpc("manager_sign_request", {
    p_request_id: id,
    p_manager_id: profile.id,
    p_signature_url: signatureUrl,
  });
  if (error) return NextResponse.json({ error: error.message || "Gagal menyimpan tanda tangan Manager." }, { status: 400 });

  // Notif ke teknisi: material siap
  if (req.teknisi_id) {
    await notifyUser(req.teknisi_id, {
      title: "✅ Material siap diambil!",
      message: `Surat Jalan ${req.surat_jalan_number ?? ""} telah ditandatangani semua pihak. Material sudah masuk ke Tas Saya.`,
      entityType: "material_requests",
      entityId: id,
      linkUrl: "/my-bag",
    });
  }

  // Notif ke Admin
  await notifyByRole(["ADMIN"], {
    title: "Surat Jalan selesai ditandatangani",
    message: `Surat Jalan ${req.surat_jalan_number ?? ""} telah ditandatangani Manager. Material sudah masuk ke tas teknisi.`,
    entityType: "material_requests",
    entityId: id,
    linkUrl: "/approvals/requests",
  });

  return NextResponse.json({ message: "Tanda tangan Manager berhasil. Material sudah masuk ke tas teknisi." });
}
