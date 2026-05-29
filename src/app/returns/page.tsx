import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { ReturnsClient } from "./returns-client";

export default async function Page() {
  const profile = await requireProfile(["TEKNISI"]);
  return (
    <AppShell profile={profile} title="Pengembalian Material">
      <ReturnsClient />
    </AppShell>
  );
}
