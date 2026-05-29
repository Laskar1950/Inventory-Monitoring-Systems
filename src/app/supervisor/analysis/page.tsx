import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { SupervisorAnalysisClient } from "./supervisor-analysis-client";

export default async function Page() {
  const profile = await requireProfile(["SUPERVISOR", "ADMIN"]);
  return (
    <AppShell profile={profile} title="Analisa Material">
      <SupervisorAnalysisClient />
    </AppShell>
  );
}
