import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { MonitoringMaterialsClient } from "./monitoring-materials-client";

export default async function Page() {
  const profile = await requireProfile(["SUPERVISOR", "ADMIN"]);
  return (
    <AppShell profile={profile} title="Monitoring Material">
      <MonitoringMaterialsClient />
    </AppShell>
  );
}
