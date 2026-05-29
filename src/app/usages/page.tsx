import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { UsagesClient } from "./usages-client";

export default async function Page() {
  const profile = await requireProfile(["TEKNISI"]);
  return (
    <AppShell profile={profile} title="Penggunaan Material">
      <UsagesClient />
    </AppShell>
  );
}
