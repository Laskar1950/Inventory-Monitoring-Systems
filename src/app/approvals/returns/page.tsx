import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApprovalReturnsClient } from "./approval-returns-client";

export default async function Page() {
  const profile = await requireProfile(["ADMIN"]);
  const supabase = createAdminClient();
  const { data } = await supabase.from("material_return_summary").select("*").order("created_at", { ascending: false });
  return (
    <AppShell profile={profile} title="Setujui Pengembalian">
      <ApprovalReturnsClient initialReturns={(data ?? []) as any} />
    </AppShell>
  );
}
