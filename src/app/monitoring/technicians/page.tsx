import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { MonitoringTechniciansClient } from "./monitoring-technicians-client";

export default async function Page() {
  const profile = await requireProfile(["SUPERVISOR", "ADMIN"]);
  return (
    <AppShell profile={profile} title="Monitoring Teknisi">
      <MonitoringTechniciansClient />
    </AppShell>
  );
}
