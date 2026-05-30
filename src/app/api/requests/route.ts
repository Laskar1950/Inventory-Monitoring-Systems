import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifications";

const requestSchema = z.object({
  catatan_teknisi: z.string().optional().nullable(),
  items: z.array(z.object({ material_id: z.string().uuid(), qty: z.number().int().positive() })).min(1),
});

async function getRequestItems(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, any[]>();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("material_request_items")
    .select("id,request_id,material_id,qty_requested,qty_approved,status,materials(material_code,nama,merk,satuan,wajib_sn)")
    .in("request_id", requestIds)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const map = new Map<string, any[]>();
  for (const row of data ?? []) {
    const material = Array.isArray((row as any).materials) ? (row as any).materials[0] : (row as any).materials;
    const item = { id: row.id, request_id: row.request_id, material_id: row.material_id, material_code: material?.material_code ?? "-", material_nama: material?.nama ?? "-", merk: material?.merk ?? "-", satuan: material?.satuan ?? "-", wajib_sn: Boolean(material?.wajib_sn), qty_requested: row.qty_requested, qty_approved: row.qty_approved, status: row.status };
    const list = map.get(row.request_id) ?? [];
    list.push(item);
    map.set(row.request_id, list);
  }
  return map;
}

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  const supabase = createAdminClient();
  let query = supabase.from("material_request_summary").select("*").order("created_at", { ascending: false });
  if (profile.role === "TEKNISI") query = query.eq("teknisi_id", profile.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat request material." }, { status: 500 });
  try {
    const itemsMap = await getRequestItems((data ?? []).map((r: any) => r.id));
    const detailed = (data ?? []).map((r: any) => ({ ...r, items: itemsMap.get(r.id) ?? [] }));
    return NextResponse.json({ data: detailed });
  } catch {
    return NextResponse.json({ error: "Gagal memuat detail request." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "TEKNISI") return NextResponse.json({ error: "Hanya Teknisi yang boleh membuat request material." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload request material tidak valid." }, { status: 400 });

  const merged = new Map<string, number>();
  for (const item of parsed.data.items) merged.set(item.material_id, (merged.get(item.material_id) ?? 0) + item.qty);
  const items = [...merged.entries()].map(([material_id, qty]) => ({ material_id, qty }));

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_material_request", { p_teknisi_id: profile.id, p_catatan_teknisi: parsed.data.catatan_teknisi ?? null, p_items: items });
  if (error) return NextResponse.json({ error: error.message || "Gagal mengirim request material." }, { status: 400 });

  await notifyAdmins({ title: "Request material baru", message: `${profile.nama} mengirim request material baru.`, entityType: "material_requests", entityId: data, linkUrl: "/approvals/requests" });
  return NextResponse.json({ data, message: "Request berhasil dikirim." }, { status: 201 });
}
