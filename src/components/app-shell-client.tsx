"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bell, Boxes, ChevronLeft, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Moon, Package, ShieldCheck, Sun, UserRound, X, Zap } from "lucide-react";
import type { Profile, UserRole } from "@/types/database";
import { getInitials } from "@/lib/normalize";

type ExtProfile = Profile & { photo_url?: string | null };
type NotificationItem = { id: string; title: string; message: string; link_url: string | null; is_read: boolean; created_at: string };
type ThemeMode = "light" | "dark";

const menuByRole = {
  TEKNISI: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },{ href: "/requests", label: "Permintaan Material", icon: ClipboardList },{ href: "/my-bag", label: "Tas Saya", icon: Boxes },{ href: "/usages", label: "Penggunaan", icon: Package },{ href: "/returns", label: "Pengembalian", icon: ClipboardList },{ href: "/stock-opnames", label: "Stok Opname", icon: ShieldCheck },{ href: "/profile", label: "Profil Saya", icon: UserRound }],
  ADMIN: [{ href: "/dashboard", label: "Dashboard Admin", icon: LayoutDashboard },{ href: "/materials", label: "Master Material", icon: Package },{ href: "/approvals/requests", label: "Setujui Permintaan", icon: ClipboardList },{ href: "/laporan-penggunaan", label: "Penggunaan Material", icon: FileText },{ href: "/approvals/returns", label: "Setujui Pengembalian", icon: ClipboardList },{ href: "/approvals/stock-opnames", label: "Setujui Stok Opname", icon: ShieldCheck },{ href: "/reports", label: "Laporan", icon: BarChart3 },{ href: "/profile", label: "Profil Saya", icon: UserRound }],
  SUPERVISOR: [{ href: "/dashboard", label: "Dashboard Supervisor", icon: LayoutDashboard },{ href: "/monitoring/materials", label: "Monitoring Material", icon: Package },{ href: "/monitoring/technicians", label: "Monitoring Teknisi", icon: UserRound },{ href: "/supervisor/analysis", label: "Analisa Material", icon: BarChart3 },{ href: "/reports", label: "Laporan Supervisor", icon: BarChart3 },{ href: "/profile", label: "Profil Saya", icon: UserRound }],
} satisfies Record<UserRole, Array<{ href: string; label: string; icon: typeof LayoutDashboard }>>;

function isActive(pathname: string, href: string) { if (href === "/dashboard") return pathname === "/dashboard"; return pathname === href || pathname.startsWith(`${href}/`); }

export function AppShellClient({ profile, title, children }: { profile: ExtProfile; title: string; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [loggingOut, setLoggingOut] = useState(false); const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [notifOpen, setNotifOpen] = useState(false); const [notifLoaded, setNotifLoaded] = useState(false); const [notifLoading, setNotifLoading] = useState(false); const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [avatar, setAvatar] = useState("");
  const menu = menuByRole[profile.role]; const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => { const saved = localStorage.getItem("inventory-sidebar-collapsed"); if (saved === "true") setCollapsed(true); const savedTheme = localStorage.getItem("inventory-theme"); if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme); }, []);
  useEffect(() => { let active = true; if (!profile.photo_url) { setAvatar(""); return; } if (profile.photo_url.startsWith("http")) { setAvatar(profile.photo_url); return; } fetch(`/api/storage-url?bucket=profile-photos&path=${encodeURIComponent(profile.photo_url)}`).then((r) => r.json()).then((j) => { if (active) setAvatar(j.signedUrl || ""); }).catch(() => { if (active) setAvatar(""); }); return () => { active = false; }; }, [profile.photo_url]);

  async function loadNotifications() { setNotifLoading(true); const res = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null); if (res?.ok) { const json = await res.json(); setNotifications(json.data || []); setNotifLoaded(true); } setNotifLoading(false); }
  async function openNotifications() { const next = !notifOpen; setNotifOpen(next); if (next && !notifLoaded) await loadNotifications(); }
  async function markNotifications(id?: string) { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) }).catch(() => null); await loadNotifications(); }
  function toggleCollapsed() { setCollapsed((current) => { const next = !current; localStorage.setItem("inventory-sidebar-collapsed", String(next)); return next; }); }
  function toggleTheme() { setTheme((current) => { const next = current === "dark" ? "light" : "dark"; localStorage.setItem("inventory-theme", next); return next; }); }
  async function logout() { setLoggingOut(true); await fetch("/api/logout", { method: "POST" }).catch(() => null); router.replace("/login"); router.refresh(); }
  const layoutClass = useMemo(() => ["app-layout", `theme-${theme}`, collapsed ? "sidebar-collapsed" : "", mobileOpen ? "sidebar-mobile-open" : ""].filter(Boolean).join(" "), [collapsed, mobileOpen, theme]);

  return <div className={layoutClass}>
    <aside className="sidebar">
      <div className="sidebar-header shell-profile-header">
        <Link href="/dashboard" className="shell-profile-mini app-brand-mini">
          <span className="shell-profile-logo brand-lightning"><Zap size={28} strokeWidth={3} fill="currentColor" /></span>
          <span className="shell-profile-copy"><strong>PLN ICONPLUS</strong><small>Inventory Systems</small></span>
        </Link>
        <button className="sidebar-collapse-btn mobile-only" type="button" onClick={() => setMobileOpen(false)}><X size={16} /></button>
      </div>
      <button className="sidebar-collapse-row desktop-only" type="button" onClick={toggleCollapsed}><span>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</span><b>Collapse</b></button>
      <div className="sidebar-section-label">MENU</div>
      <nav className="sidebar-menu">{menu.map((item) => { const Icon = item.icon; const active = isActive(pathname, item.href); return <Link className="sidebar-link" href={item.href} key={item.href} aria-current={active ? "page" : undefined} title={item.label} onClick={() => setMobileOpen(false)}><Icon size={18} /><span>{item.label}</span></Link>; })}</nav>
      <div className="sidebar-footer"><button className="btn-ghost full" type="button" onClick={() => setLogoutConfirm(true)} disabled={loggingOut}><LogOut size={16} /> <span>Keluar</span></button></div>
    </aside>
    {mobileOpen && <button className="sidebar-scrim" type="button" onClick={() => setMobileOpen(false)} />}
    <main className="main-content"><header className="topbar"><div className="topbar-left"><button className="topbar-menu-btn" type="button" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div><h2>{title}</h2><p className="topbar-subtitle">PLN ICONPLUS Inventory Systems</p></div></div><div className="topbar-profile"><div className="notif-wrap"><button className="notif-button" type="button" onClick={() => void openNotifications()}><Bell size={17} />{unread > 0 && <span>{unread}</span>}</button>{notifOpen && <div className="notif-panel"><div className="notif-head"><strong>Notifikasi</strong><button type="button" onClick={() => void markNotifications()}>Tandai dibaca</button></div>{notifLoading ? <div className="notif-empty">Memuat notifikasi...</div> : notifications.length === 0 ? <div className="notif-empty">Belum ada notifikasi.</div> : notifications.map((n) => <Link key={n.id} href={n.link_url || "#"} className={`notif-item ${n.is_read ? "" : "unread"}`} onClick={() => { setNotifOpen(false); void markNotifications(n.id); }}><strong>{n.title}</strong><span>{n.message}</span></Link>)}</div>}</div><button className="theme-toggle" type="button" onClick={toggleTheme} title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button><div className="topbar-user-card"><div><strong>{profile.nama}</strong><small>{profile.role}</small></div><Link href="/profile" className="profile-avatar-top">{avatar ? <img src={avatar} alt={profile.nama} onError={() => setAvatar("")} /> : <span>{getInitials(profile.nama)}</span>}</Link></div></div></header><div className="content-wrapper">{children}</div></main>
    {logoutConfirm && <div className="modal-backdrop"><div className="confirm-modal"><div className="confirm-icon"><LogOut size={24} /></div><h3>Keluar dari aplikasi?</h3><p>Sesi Anda akan ditutup dan Anda perlu login kembali untuk mengakses sistem.</p><div className="confirm-actions"><button className="btn-ghost" type="button" onClick={() => setLogoutConfirm(false)} disabled={loggingOut}>Batal</button><button className="btn-danger" type="button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? "Keluar..." : "Ya, Keluar"}</button></div></div></div>}
    {loggingOut && <div className="action-overlay"><div className="loader-card"><div className="loader-ring" /><strong>Keluar dari aplikasi...</strong><span>Mohon tunggu sebentar.</span></div></div>}
  </div>;
}
