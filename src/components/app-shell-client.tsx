"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, ChevronLeft, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Package, ShieldCheck, UserRound, X } from "lucide-react";
import type { Profile, UserRole } from "@/types/database";
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
    { href: "/laporan-penggunaan", label: "Penggunaan Material", icon: FileText },
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
} satisfies Record<UserRole, Array<{ href: string; label: string; icon: typeof LayoutDashboard }>>;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellClient({ profile, title, children }: { profile: Profile; title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menu = menuByRole[profile.role];

  useEffect(() => {
    const saved = localStorage.getItem("inventory-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("inventory-sidebar-collapsed", String(next));
      return next;
    });
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  const layoutClass = useMemo(() => ["app-layout", collapsed ? "sidebar-collapsed" : "", mobileOpen ? "sidebar-mobile-open" : ""].filter(Boolean).join(" "), [collapsed, mobileOpen]);

  return (
    <div className={layoutClass}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-main">PLN ICON</div>
            <div className="sidebar-brand-sub">Inventory Systems</div>
          </div>
          <button className="sidebar-collapse-btn desktop-only" type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
          <button className="sidebar-collapse-btn mobile-only" type="button" onClick={() => setMobileOpen(false)} aria-label="Tutup sidebar"><X size={16} /></button>
        </div>
        <nav className="sidebar-menu">
          {menu.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link className="sidebar-link" href={item.href} key={item.href} aria-current={active ? "page" : undefined} title={item.label} onClick={() => setMobileOpen(false)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="btn-ghost full" type="button" onClick={logout} disabled={loggingOut}><LogOut size={16} /> <span>Keluar</span></button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" type="button" aria-label="Tutup sidebar" onClick={() => setMobileOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="topbar-menu-btn" type="button" onClick={() => setMobileOpen(true)} aria-label="Buka sidebar"><Menu size={19} /></button>
            <h2>{title}</h2>
          </div>
          <div className="topbar-profile">
            <span className="role-badge">{profile.role}</span>
            <span className="initials">{getInitials(profile.nama)}</span>
          </div>
        </header>
        <div className="content-wrapper">{children}</div>
      </main>
      {loggingOut && <div className="action-overlay"><div className="loader-card"><div className="loader-ring" /><strong>Keluar dari aplikasi...</strong><span>Mohon tunggu sebentar.</span></div></div>}
    </div>
  );
}
