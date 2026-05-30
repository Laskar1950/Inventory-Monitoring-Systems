import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { ProfileClient } from "./profile-client";

export default async function Page() {
  const profile = await requireProfile();
  return (
    <AppShell profile={profile} title="Profil Saya">
      <ProfileClient profile={profile} />
    </AppShell>
  );
}
