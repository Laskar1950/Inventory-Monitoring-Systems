import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MaterialsClient } from "./materials-client";
import type { Material } from "@/types/database";

async function getMaterials(): Promise<{ data: Material[]; total: number }> {
  const supabase = createAdminClient();
  const { data, error, count } = await supabase
    .from("materials_with_stock")
    .select("id,material_code,nama,merk,satuan,kondisi_default,min_stock,wajib_sn,is_active,created_at,updated_at,gudang_qty,serial_count", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(0, 5);

  if (error) return { data: [], total: 0 };
  return { data: data as Material[], total: count ?? 0 };
}

export default async function MaterialsPage() {
  const profile = await requireProfile(["ADMIN"]);
  const materials = await getMaterials();

  return (
    <AppShell profile={profile} title="Master Material">
      <MaterialsClient initialMaterials={materials.data} initialMeta={{ page: 1, limit: 6, total: materials.total, totalPages: Math.max(1, Math.ceil(materials.total / 6)) }} />
    </AppShell>
  );
}
