import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

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
  const { data: requestBefore } = await supabase.from("material_requests").select("id,request_code,teknisi_id").eq("id", id).single();
  const { data, error } = await supabase.rpc("approve_material_request", { p_request_id: id, p_admin_id: profile.id, p_catatan_admin: parsed.data.catatan_admin ?? null });
  if (error) return NextResponse.json({ error: error.message || "Approval gagal diproses." }, { status: 400 });

  if (requestBefore?.teknisi_id) {
    await createNotification({ userId: requestBefore.teknisi_id, title: "Request disetujui", message: "Request " + requestBefore.request_code + " sudah disetujui Admin.", entityType: "material_requests", entityId: id, linkUrl: "/requests" });
  }

  return NextResponse.json({ data, message: "Request berhasil disetujui." });
}
