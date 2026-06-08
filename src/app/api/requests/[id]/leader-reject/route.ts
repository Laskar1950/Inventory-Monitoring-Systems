import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";

const schema = z.object({ catatan: z.string().min(1, "Catatan wajib diisi saat menolak.") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "LEADER") return NextResponse.json({ error: "Hanya Leader yang dapat menolak request di tahap ini." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Catatan wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("leader_reject_request", {
    p_request_id: id,
    p_leader_id: profile.id,
    p_catatan: parsed.data.catatan,
  });
  if (error) return NextResponse.json({ error: error.message || "Gagal menolak request." }, { status: 400 });

  const { data: req } = await supabase.from("material_requests").select("request_code,teknisi_id").eq("id", id).single();
  if (req?.teknisi_id) {
    await notifyUser(req.teknisi_id, {
      title: "Request ditolak Leader",
      message: `Request ${req.request_code} ditolak Leader. Catatan: ${parsed.data.catatan}`,
      entityType: "material_requests",
      entityId: id,
      linkUrl: "/requests",
    });
  }

  return NextResponse.json({ data, message: "Request berhasil ditolak." });
}
