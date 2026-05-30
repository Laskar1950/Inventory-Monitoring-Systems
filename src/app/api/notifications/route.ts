import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,message,entity_type,entity_id,link_url,is_read,created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: "Gagal memuat notifikasi." }, { status: 500 });
  return NextResponse.json({ data: data ?? [], unread: (data ?? []).filter((n) => !n.is_read).length });
}

export async function PATCH(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = body.id ? String(body.id) : null;
  const supabase = createAdminClient();

  let query = supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id);
  if (id) query = query.eq("id", id);

  const { error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memperbarui notifikasi." }, { status: 500 });
  return NextResponse.json({ message: "Notifikasi diperbarui." });
}
