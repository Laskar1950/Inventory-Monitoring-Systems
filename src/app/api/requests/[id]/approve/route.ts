import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyByRole, notifyUser } from "@/lib/notifications";

const schema = z.object({
  catatan_admin: z.string().optional().nullable(),
  item_serials: z.record(z.string().uuid(), z.array(z.string().uuid())).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh memproses surat jalan." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload approval tidak valid." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: requestBefore } = await supabase
    .from("material_requests")
    .select("id,request_code,teknisi_id,status")
    .eq("id", id)
    .single();

  if (!requestBefore) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });
  if (requestBefore.status !== "LEADER_APPROVED") {
    return NextResponse.json({ error: "Request harus sudah disetujui Leader sebelum Admin memproses surat jalan." }, { status: 400 });
  }

  const now = new Date();
  const suratJalanNumber = `SJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${requestBefore.request_code}`;

  const { error: updateError } = await supabase
    .from("material_requests")
    .update({
      status: "WAITING_SIGNATURE",
      approved_by: profile.id,
      approved_at: now.toISOString(),
      catatan_admin: parsed.data.catatan_admin ?? null,
      surat_jalan_number: suratJalanNumber,
      updated_at: now.toISOString(),
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message || "Gagal update status request." }, { status: 400 });

  const { data: items } = await supabase
    .from("material_request_items")
    .select("id,qty_requested")
    .eq("request_id", id);

  if (items && items.length > 0) {
    await supabase.from("material_request_items").upsert(
      items.map((item: any) => ({ id: item.id, qty_approved: item.qty_requested, status: "APPROVED" }))
    );
  }

  await notifyByRole(["KOORDINATOR"], {
    title: "Surat jalan menunggu tanda tangan Koordinator",
    message: `Surat jalan ${suratJalanNumber} siap ditandatangani Koordinator.`,
    entityType: "material_requests",
    entityId: id,
    linkUrl: "/approvals/koordinator",
  });

  await notifyByRole(["SUPERVISOR"], {
    title: "Surat jalan sedang diproses",
    message: `Surat jalan ${suratJalanNumber} sedang menunggu tanda tangan Koordinator sebelum approval final Supervisor.`,
    entityType: "material_requests",
    entityId: id,
    linkUrl: "/approvals/supervisor",
  });

  if (requestBefore.teknisi_id) {
    await notifyUser(requestBefore.teknisi_id, {
      title: "Request diproses Admin",
      message: `Request ${requestBefore.request_code} telah diproses Admin. Surat jalan sedang dalam proses penandatanganan.`,
      entityType: "material_requests",
      entityId: id,
      linkUrl: "/requests",
    });
  }

  return NextResponse.json({ data: id, surat_jalan_number: suratJalanNumber, message: "Request berhasil diproses. Surat jalan menunggu tanda tangan Koordinator." });
}
