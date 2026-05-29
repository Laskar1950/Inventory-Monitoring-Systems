import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { ApprovalStockOpnamesClient } from "./approval-stock-opnames-client";

export default async function Page() {
  const profile = await requireProfile(["ADMIN"]);
  return <AppShell profile={profile} title="Setujui Stok Opname"><ApprovalStockOpnamesClient /></AppShell>;
}
