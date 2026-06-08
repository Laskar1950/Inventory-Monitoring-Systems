import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function PATCH(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const formData = await request.formData();
  const signature = formData.get("signature") as File | null;
  if (!signature || signature.size === 0) return NextResponse.json({ error: "File tanda tangan wajib diupload." }, { status: 400 });
  if (!ALLOWED_TYPES.has(signature.type)) return NextResponse.json({ error: "Tanda tangan harus JPG, PNG, atau WEBP." }, { status: 400 });
  if (signature.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran tanda tangan maksimal 3 MB." }, { status: 400 });

  const supabase = createAdminClient();
  const ext = signature.type === "image/png" ? "png" : signature.type === "image/webp" ? "webp" : "jpg";
  const signaturePath = `${profile.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await signature.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("signatures").upload(signaturePath, buffer, { contentType: signature.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: `Tanda tangan gagal diupload: ${uploadError.message}` }, { status: 500 });

  const { data, error } = await supabase
    .from("profiles")
    .update({ signature_url: signaturePath, signature_type: "uploaded", signature_updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from("signatures").remove([signaturePath]);
    return NextResponse.json({ error: error.message || "Gagal menyimpan tanda tangan." }, { status: 400 });
  }

  return NextResponse.json({ data, message: "Tanda tangan berhasil disimpan." });
}

export async function DELETE() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  const supabase = createAdminClient();
  const { data: current } = await supabase.from("profiles").select("signature_url").eq("id", profile.id).single();
  const { data, error } = await supabase
    .from("profiles")
    .update({ signature_url: null, signature_type: null, signature_updated_at: null })
    .eq("id", profile.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message || "Gagal menghapus tanda tangan." }, { status: 400 });
  if (current?.signature_url && !String(current.signature_url).startsWith("http")) await supabase.storage.from("signatures").remove([current.signature_url]).catch(() => null);
  return NextResponse.json({ data, message: "Tanda tangan berhasil dihapus." });
}
