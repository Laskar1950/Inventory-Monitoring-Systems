import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { ReportsClient } from "./reports-client";

export default async function Page() {
  const profile = await requireProfile(["ADMIN", "SUPERVISOR"]);
  return (
    <AppShell profile={profile} title="Laporan Pemakaian">
      <ReportsClient />
    </AppShell>
  );
}
