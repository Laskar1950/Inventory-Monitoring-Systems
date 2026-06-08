import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkflowApprovalClient } from "../workflow-approval-client";

const LIMIT = 6;

async function getInitialData() {
  const supabase = createAdminClient();
  const { data: requests, count } = await supabase.from("material_request_summary").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(0, LIMIT - 1);
  const requestIds = (requests ?? []).map((r: any) => r.id);
  const { data: items } = requestIds.length ? await supabase.from("material_request_items").select("id,request_id,material_id,qty_requested,qty_approved,status,materials(material_code,nama,merk,satuan,wajib_sn)").in("request_id", requestIds).order("created_at") : { data: [] as any[] };
  const map = new Map<string, any[]>();
  for (const row of items ?? []) {
    const material = Array.isArray((row as any).materials) ? (row as any).materials[0] : (row as any).materials;
    const list = map.get((row as any).request_id) ?? [];
    list.push({ id: row.id, request_id: row.request_id, material_id: row.material_id, material_code: material?.material_code ?? "-", material_nama: material?.nama ?? "-", merk: material?.merk ?? "-", satuan: material?.satuan ?? "-", wajib_sn: Boolean(material?.wajib_sn), qty_requested: row.qty_requested, qty_approved: row.qty_approved, status: row.status });
    map.set((row as any).request_id, list);
  }
  return { data: (requests ?? []).map((r: any) => ({ ...r, items: map.get(r.id) ?? [] })), total: count ?? 0 };
}

export default async function SupervisorApprovalPage() {
  const profile = await requireProfile(["SUPERVISOR"]);
  const initial = await getInitialData();
  return <AppShell profile={profile} title="Approval Final Surat Jalan"><WorkflowApprovalClient mode="SUPERVISOR" initialRequests={initial.data as any} initialMeta={{ page: 1, limit: LIMIT, total: initial.total, totalPages: Math.max(1, Math.ceil(initial.total / LIMIT)) }} /></AppShell>;
}
