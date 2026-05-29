import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MaterialsClient } from "./materials-client";
import type { Material } from "@/types/database";

async function getMaterials(): Promise<Material[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("materials_with_stock")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data as Material[];
}

export default async function MaterialsPage() {
  const profile = await requireProfile(["ADMIN"]);
  const materials = await getMaterials();

  return (
    <AppShell profile={profile} title="Master Material">
      <MaterialsClient initialMaterials={materials} />
    </AppShell>
  );
}
