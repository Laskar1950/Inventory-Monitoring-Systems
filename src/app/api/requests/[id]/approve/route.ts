import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ catatan_admin: z.string().optional().nullable() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh approval request." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload approval tidak valid." }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("approve_material_request", {
    p_request_id: id,
    p_admin_id: profile.id,
    p_catatan_admin: parsed.data.catatan_admin ?? null,
  });
  if (error) return NextResponse.json({ error: error.message || "Approval gagal diproses." }, { status: 400 });
  return NextResponse.json({ data, message: "Request berhasil disetujui." });
}
