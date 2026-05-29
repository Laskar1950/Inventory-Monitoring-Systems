import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Package, ClipboardList, UserRound, BarChart3, Boxes, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { getInitials } from "@/lib/normalize";

const menuByRole = {
  TEKNISI: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/requests", label: "Permintaan Material", icon: ClipboardList },
    { href: "/my-bag", label: "Tas Saya", icon: Boxes },
    { href: "/usages", label: "Penggunaan", icon: Package },
    { href: "/returns", label: "Pengembalian", icon: ClipboardList },
    { href: "/stock-opnames", label: "Stok Opname", icon: ShieldCheck },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Dashboard Admin", icon: LayoutDashboard },
    { href: "/materials", label: "Master Material", icon: Package },
    { href: "/approvals/requests", label: "Setujui Permintaan", icon: ClipboardList },
    { href: "/approvals/returns", label: "Setujui Pengembalian", icon: ClipboardList },
    { href: "/approvals/stock-opnames", label: "Setujui Stok Opname", icon: ShieldCheck },
    { href: "/reports", label: "Laporan", icon: BarChart3 },
  ],
  SUPERVISOR: [
    { href: "/dashboard", label: "Dashboard Supervisor", icon: LayoutDashboard },
    { href: "/monitoring/materials", label: "Monitoring Material", icon: Package },
    { href: "/monitoring/technicians", label: "Monitoring Teknisi", icon: UserRound },
    { href: "/supervisor/analysis", label: "Analisa Material", icon: BarChart3 },
    { href: "/reports", label: "Laporan Supervisor", icon: BarChart3 },
  ],
} as const;

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export function AppShell({ profile, title, children }: { profile: Profile; title: string; children: React.ReactNode }) {
  const menu = menuByRole[profile.role];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="sidebar-brand-main">PLN ICON</div>
            <div className="sidebar-brand-sub">Inventory Systems</div>
          </div>
        </div>
        <nav className="sidebar-menu">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="sidebar-link" href={item.href} key={item.href}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="sidebar-footer">
          <button className="btn-ghost full" type="submit"><LogOut size={16} /> Keluar</button>
        </form>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <h2>{title}</h2>
          <div className="topbar-profile">
            <span className="role-badge">{profile.role}</span>
            <span className="initials">{getInitials(profile.nama)}</span>
          </div>
        </header>
        <div className="content-wrapper">{children}</div>
      </main>
    </div>
  );
}
