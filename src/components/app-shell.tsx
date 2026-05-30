import { AppShellClient } from "./app-shell-client";
import type { Profile } from "@/types/database";

export function AppShell({ profile, title, children }: { profile: Profile; title: string; children: React.ReactNode }) {
  return <AppShellClient profile={profile} title={title}>{children}</AppShellClient>;
}
