import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function PATCH(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const formData = await request.formData();
  const nama = String(formData.get("nama") ?? "").trim();
  const keterangan = String(formData.get("keterangan") ?? "").trim();
  const photo = formData.get("photo") as File | null;

  if (!nama) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  let photoPath: string | null = null;

  if (photo && photo.size > 0) {
    if (!ALLOWED_TYPES.has(photo.type)) return NextResponse.json({ error: "Foto harus JPG, PNG, atau WEBP." }, { status: 400 });
    if (photo.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran foto maksimal 3 MB." }, { status: 400 });
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    photoPath = `${profile.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(photoPath, buffer, { contentType: photo.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: `Foto gagal diupload: ${uploadError.message}` }, { status: 500 });
  }

  const patch: Record<string, string | null> = { nama, keterangan: keterangan || null };
  if (photoPath) patch.photo_url = photoPath;

  const { data, error } = await supabase.from("profiles").update(patch).eq("id", profile.id).select("*").single();
  if (error) {
    if (photoPath) await supabase.storage.from("profile-photos").remove([photoPath]);
    return NextResponse.json({ error: error.message || "Gagal menyimpan profil." }, { status: 400 });
  }

  return NextResponse.json({ data, message: "Profil berhasil diperbarui." });
}
