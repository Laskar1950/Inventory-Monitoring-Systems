import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN") return NextResponse.json({ error: "Akses monitoring teknisi ditolak." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword")?.trim();
  const supabase = createAdminClient();
  let query = supabase.from("supervisor_monitoring_technicians").select("*").order("nama");
  if (keyword) query = query.or(`nama.ilike.%${keyword}%,email.ilike.%${keyword}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat monitoring teknisi." }, { status: 500 });
  return NextResponse.json({ data });
}
