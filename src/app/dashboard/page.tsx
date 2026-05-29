import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Boxes, ClipboardList, Package, ShieldCheck } from "lucide-react";
import { SupervisorDashboardClient } from "./supervisor-dashboard-client";

async function getStats(role: string, profileId: string) {
  try {
    const supabase = createAdminClient();
    const [materials, requests, bags, usages] = await Promise.all([
      supabase.from("materials").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("material_requests").select("id", { count: "exact", head: true }).eq(role === "TEKNISI" ? "teknisi_id" : "status", role === "TEKNISI" ? profileId : "PENDING"),
      supabase.from("technician_bags").select("id", { count: "exact", head: true }).eq(role === "TEKNISI" ? "teknisi_id" : "status", role === "TEKNISI" ? profileId : "ACTIVE"),
      supabase.from("material_usages").select("id", { count: "exact", head: true }),
    ]);
    return {
      materials: materials.count ?? 0,
      requests: requests.count ?? 0,
      bags: bags.count ?? 0,
      usages: usages.count ?? 0,
    };
  } catch {
    return { materials: 0, requests: 0, bags: 0, usages: 0 };
  }
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const stats = await getStats(profile.role, profile.id);
  const title = profile.role === "ADMIN" ? "Dashboard Admin Gudang" : profile.role === "SUPERVISOR" ? "Dashboard Supervisor" : "Dashboard Teknisi";

  if (profile.role === "SUPERVISOR") {
    return (
      <AppShell profile={profile} title={title}>
        <SupervisorDashboardClient />
      </AppShell>
    );
  }

  return (
    <AppShell profile={profile} title={title}>
      <div className="grid grid-4">
        <Stat label="Total Material" value={stats.materials} icon={<Package size={22} />} />
        <Stat label={profile.role === "ADMIN" ? "Request Pending" : "Request Saya"} value={stats.requests} icon={<ClipboardList size={22} />} />
        <Stat label={profile.role === "TEKNISI" ? "Item di Tas" : "Stok Tas Teknisi"} value={stats.bags} icon={<Boxes size={22} />} />
        <Stat label="Laporan Penggunaan" value={stats.usages} icon={<ShieldCheck size={22} />} />
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-title">
          <h3>Progress Migrasi</h3>
          <p>Fondasi aplikasi, autentikasi, role layout, schema database, dan Master Material sudah disiapkan pada paket awal ini.</p>
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="icon-box">{icon}</div>
    </div>
  );
}
