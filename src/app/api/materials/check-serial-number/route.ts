import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode } from "@/lib/normalize";

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const serialNumber = normalizeCode(body?.serial_number ?? "");
  if (!serialNumber) return NextResponse.json({ exists: false });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("material_serial_numbers")
    .select("id")
    .eq("serial_number", serialNumber)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Gagal cek serial number." }, { status: 500 });
  return NextResponse.json({ exists: Boolean(data) });
}
