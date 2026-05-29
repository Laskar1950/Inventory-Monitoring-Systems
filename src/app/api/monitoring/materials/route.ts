import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN") return NextResponse.json({ error: "Akses monitoring material ditolak." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword")?.trim();
  const status = searchParams.get("status")?.trim();
  const supabase = createAdminClient();
  let query = supabase.from("supervisor_monitoring_materials").select("*").order("material_code");
  if (keyword) query = query.or(`material_code.ilike.%${keyword}%,nama.ilike.%${keyword}%,merk.ilike.%${keyword}%`);
  if (status && status !== "ALL") query = query.eq("stock_status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat monitoring material." }, { status: 500 });
  return NextResponse.json({ data });
}
