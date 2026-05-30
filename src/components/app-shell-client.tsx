"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bell, Boxes, ChevronLeft, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Package, ShieldCheck, UserRound, X } from "lucide-react";
import type { Profile, UserRole } from "@/types/database";
import { getInitials } from "@/lib/normalize";

type ExtProfile = Profile & { photo_url?: string | null };
type NotificationItem = { id: string; title: string; message: string; link_url: string | null; is_read: boolean; created_at: string };

const menuByRole = {
  TEKNISI: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },{ href: "/requests", label: "Permintaan Material", icon: ClipboardList },{ href: "/my-bag", label: "Tas Saya", icon: Boxes },{ href: "/usages", label: "Penggunaan", icon: Package },{ href: "/returns", label: "Pengembalian", icon: ClipboardList },{ href: "/stock-opnames", label: "Stok Opname", icon: ShieldCheck },{ href: "/profile", label: "Profil Saya", icon: UserRound }],
  ADMIN: [{ href: "/dashboard", label: "Dashboard Admin", icon: LayoutDashboard },{ href: "/materials", label: "Master Material", icon: Package },{ href: "/approvals/requests", label: "Setujui Permintaan", icon: ClipboardList },{ href: "/laporan-penggunaan", label: "Penggunaan Material", icon: FileText },{ href: "/approvals/returns", label: "Setujui Pengembalian", icon: ClipboardList },{ href: "/approvals/stock-opnames", label: "Setujui Stok Opname", icon: ShieldCheck },{ href: "/reports", label: "Laporan", icon: BarChart3 },{ href: "/profile", label: "Profil Saya", icon: UserRound }],
  SUPERVISOR: [{ href: "/dashboard", label: "Dashboard Supervisor", icon: LayoutDashboard },{ href: "/monitoring/materials", label: "Monitoring Material", icon: Package },{ href: "/monitoring/technicians", label: "Monitoring Teknisi", icon: UserRound },{ href: "/supervisor/analysis", label: "Analisa Material", icon: BarChart3 },{ href: "/reports", label: "Laporan Supervisor", icon: BarChart3 },{ href: "/profile", label: "Profil Saya", icon: UserRound }],
} satisfies Record<UserRole, Array<{ href: string; label: string; icon: typeof LayoutDashboard }>>;

function isActive(pathname: string, href: string) { if (href === "/dashboard") return pathname === "/dashboard"; return pathname === href || pathname.startsWith(`${href}/`); }
function photoUrl(path?: string | null) { if (!path) return ""; if (path.startsWith("http")) return path; const base = process.env.NEXT_PUBLIC_SUPABASE_URL; return base ? `${base}/storage/v1/object/public/profile-photos/${path}` : ""; }

export function AppShellClient({ profile, title, children }: { profile: ExtProfile; title: string; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [loggingOut, setLoggingOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false); const [notifLoaded, setNotifLoaded] = useState(false); const [notifLoading, setNotifLoading] = useState(false); const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const menu = menuByRole[profile.role]; const unread = notifications.filter((n) => !n.is_read).length; const avatar = photoUrl(profile.photo_url);
  useEffect(() => { const saved = localStorage.getItem("inventory-sidebar-collapsed"); if (saved === "true") setCollapsed(true); }, []);

  async function loadNotifications() { setNotifLoading(true); const res = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null); if (res?.ok) { const json = await res.json(); setNotifications(json.data || []); setNotifLoaded(true); } setNotifLoading(false); }
  async function openNotifications() { const next = !notifOpen; setNotifOpen(next); if (next && !notifLoaded) await loadNotifications(); }
  async function markNotifications(id?: string) { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) }).catch(() => null); await loadNotifications(); }
  function toggleCollapsed() { setCollapsed((current) => { const next = !current; localStorage.setItem("inventory-sidebar-collapsed", String(next)); return next; }); }
  async function logout() { setLoggingOut(true); await fetch("/api/logout", { method: "POST" }).catch(() => null); router.replace("/login"); router.refresh(); }
  const layoutClass = useMemo(() => ["app-layout", collapsed ? "sidebar-collapsed" : "", mobileOpen ? "sidebar-mobile-open" : ""].filter(Boolean).join(" "), [collapsed, mobileOpen]);

  return <div className={layoutClass}>
    <aside className="sidebar"><div className="sidebar-header"><div className="sidebar-brand-text"><div className="sidebar-brand-main">PLN ICON</div><div className="sidebar-brand-sub">Inventory Systems</div></div><button className="sidebar-collapse-btn desktop-only" type="button" onClick={toggleCollapsed}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button><button className="sidebar-collapse-btn mobile-only" type="button" onClick={() => setMobileOpen(false)}><X size={16} /></button></div><nav className="sidebar-menu">{menu.map((item) => { const Icon = item.icon; const active = isActive(pathname, item.href); return <Link className="sidebar-link" href={item.href} key={item.href} aria-current={active ? "page" : undefined} title={item.label} onClick={() => setMobileOpen(false)}><Icon size={18} /><span>{item.label}</span></Link>; })}</nav><div className="sidebar-footer"><button className="btn-ghost full" type="button" onClick={logout} disabled={loggingOut}><LogOut size={16} /> <span>Keluar</span></button></div></aside>
    {mobileOpen && <button className="sidebar-scrim" type="button" onClick={() => setMobileOpen(false)} />}
    <main className="main-content"><header className="topbar"><div className="topbar-left"><button className="topbar-menu-btn" type="button" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><h2>{title}</h2></div><div className="topbar-profile"><div className="notif-wrap"><button className="notif-button" type="button" onClick={() => void openNotifications()}><Bell size={17} />{unread > 0 && <span>{unread}</span>}</button>{notifOpen && <div className="notif-panel"><div className="notif-head"><strong>Notifikasi</strong><button type="button" onClick={() => void markNotifications()}>Tandai dibaca</button></div>{notifLoading ? <div className="notif-empty">Memuat notifikasi...</div> : notifications.length === 0 ? <div className="notif-empty">Belum ada notifikasi.</div> : notifications.map((n) => <Link key={n.id} href={n.link_url || "#"} className={`notif-item ${n.is_read ? "" : "unread"}`} onClick={() => { setNotifOpen(false); void markNotifications(n.id); }}><strong>{n.title}</strong><span>{n.message}</span></Link>)}</div>}</div><span className="role-badge">{profile.role}</span><Link href="/profile" className="profile-avatar-top">{avatar ? <img src={avatar} alt={profile.nama} /> : <span>{getInitials(profile.nama)}</span>}</Link></div></header><div className="content-wrapper">{children}</div></main>{loggingOut && <div className="action-overlay"><div className="loader-card"><div className="loader-ring" /><strong>Keluar dari aplikasi...</strong><span>Mohon tunggu sebentar.</span></div></div>}
  </div>;
}
