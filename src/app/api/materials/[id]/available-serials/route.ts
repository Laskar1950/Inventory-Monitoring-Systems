import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN" && profile.role !== "SUPERVISOR") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("material_serial_numbers")
    .select("id,serial_number,kondisi,status,location_type,created_at")
    .eq("material_id", id)
    .eq("status", "AVAILABLE")
    .eq("location_type", "GUDANG")
    .order("serial_number", { ascending: true });

  if (error) return NextResponse.json({ error: "Gagal memuat serial tersedia." }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}
