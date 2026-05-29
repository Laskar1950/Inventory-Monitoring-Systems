import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const supabase = createAdminClient();
  let query = supabase.from("technician_bag_summary").select("*").order("created_at", { ascending: false });
  if (profile.role === "TEKNISI") query = query.eq("teknisi_id", profile.id).eq("status", "ACTIVE");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat tas teknisi." }, { status: 500 });
  return NextResponse.json({ data });
}
