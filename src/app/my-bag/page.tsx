import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MyBagClient } from "./my-bag-client";

export default async function Page() {
  const profile = await requireProfile(["TEKNISI"]);
  const supabase = createAdminClient();
  const { data } = await supabase.from("technician_bag_summary").select("*").eq("teknisi_id", profile.id).eq("status", "ACTIVE").order("created_at", { ascending: false });
  return (
    <AppShell profile={profile} title="Tas Saya">
      <MyBagClient initialItems={(data ?? []) as any} />
    </AppShell>
  );
}
