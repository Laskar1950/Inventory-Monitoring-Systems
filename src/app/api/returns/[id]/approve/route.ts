import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh approval pengembalian." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("approve_material_return", {
    p_return_id: id,
    p_admin_id: profile.id,
    p_catatan_admin: body.catatan_admin || null,
  });

  if (error) return NextResponse.json({ error: error.message || "Gagal approve pengembalian." }, { status: 400 });
  return NextResponse.json({ data, message: "Pengembalian berhasil disetujui." });
}
