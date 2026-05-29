import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { StockOpnamesClient } from "./stock-opnames-client";

export default async function Page() {
  const profile = await requireProfile(["TEKNISI"]);
  return <AppShell profile={profile} title="Stok Opname"><StockOpnamesClient /></AppShell>;
}
