import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyByRole, notifyUser } from "@/lib/notifications";

const schema = z.object({ catatan: z.string().optional().nullable() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "LEADER") return NextResponse.json({ error: "Hanya Leader yang dapat menyetujui request di tahap ini." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("leader_approve_request", {
    p_request_id: id,
    p_leader_id: profile.id,
    p_catatan: parsed.data.catatan ?? null,
  });
  if (error) return NextResponse.json({ error: error.message || "Gagal approve request." }, { status: 400 });

  // Ambil info request untuk notifikasi
  const { data: req } = await supabase.from("material_requests").select("request_code,teknisi_id").eq("id", id).single();

  // Notif ke Admin
  await notifyByRole(["ADMIN"], {
    title: "Request disetujui Leader",
    message: `Request ${req?.request_code ?? ""} telah disetujui Leader dan menunggu approval Admin Gudang.`,
    entityType: "material_requests",
    entityId: id,
    linkUrl: "/approvals/requests",
  });

  // Notif ke teknisi
  if (req?.teknisi_id) {
    await notifyUser(req.teknisi_id, {
      title: "Request disetujui Leader",
      message: `Request ${req.request_code} telah disetujui Leader. Menunggu approval Admin Gudang.`,
      entityType: "material_requests",
      entityId: id,
      linkUrl: "/requests",
    });
  }

  return NextResponse.json({ data, message: "Request berhasil disetujui Leader." });
}
