import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RequestsClient } from "./requests-client";

export default async function Page() {
  const profile = await requireProfile(["TEKNISI"]);
  const supabase = createAdminClient();
  const [{ data: materials }, { data: requests, count }] = await Promise.all([
    supabase.from("materials_with_stock").select("id,material_code,nama,merk,satuan,min_stock,wajib_sn,is_active,gudang_qty,serial_count,created_at,updated_at").order("material_code").limit(100),
    supabase.from("material_request_summary").select("id,request_code,teknisi_id,teknisi_nama,status,catatan_teknisi,catatan_admin,approved_by,approved_by_nama,approved_at,created_at,updated_at,item_count,total_qty", { count: "exact" }).eq("teknisi_id", profile.id).order("created_at", { ascending: false }).range(0, 19),
  ]);
  const requestIds = (requests ?? []).map((r: any) => r.id);
  const { data: items } = requestIds.length
    ? await supabase.from("material_request_items").select("id,request_id,material_id,qty_requested,qty_approved,status,materials(material_code,nama,merk,satuan,wajib_sn)").in("request_id", requestIds).order("created_at")
    : { data: [] as any[] };
  const itemsMap = new Map<string, any[]>();
  for (const row of items ?? []) {
    const material = Array.isArray((row as any).materials) ? (row as any).materials[0] : (row as any).materials;
    const list = itemsMap.get((row as any).request_id) ?? [];
    list.push({ id: row.id, request_id: row.request_id, material_id: row.material_id, material_code: material?.material_code ?? "-", material_nama: material?.nama ?? "-", merk: material?.merk ?? "-", satuan: material?.satuan ?? "-", wajib_sn: Boolean(material?.wajib_sn), qty_requested: row.qty_requested, qty_approved: row.qty_approved, status: row.status });
    itemsMap.set((row as any).request_id, list);
  }
  const detailed = (requests ?? []).map((r: any) => ({ ...r, items: itemsMap.get(r.id) ?? [] }));
  return (
    <AppShell profile={profile} title="Permintaan Material">
      <RequestsClient initialMaterials={(materials ?? []) as any} initialRequests={detailed as any} initialMeta={{ page: 1, limit: 20, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / 20)) }} />
    </AppShell>
  );
}
