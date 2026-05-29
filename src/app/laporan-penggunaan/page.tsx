import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { UsagesClient } from "../usages/usages-client";

export default async function Page() {
  const profile = await requireProfile(["ADMIN"]);
  return <AppShell profile={profile} title="Penggunaan Material"><UsagesClient readOnly /></AppShell>;
}
