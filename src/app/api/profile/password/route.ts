import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (password.length < 6) return NextResponse.json({ error: "Password baru minimal 6 karakter." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(profile.auth_user_id, { password });
  if (error) return NextResponse.json({ error: error.message || "Gagal mengganti password." }, { status: 400 });

  return NextResponse.json({ message: "Password berhasil diganti." });
}
