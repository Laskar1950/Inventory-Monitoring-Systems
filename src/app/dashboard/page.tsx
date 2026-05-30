import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlertTriangle, Boxes, ClipboardCheck, ClipboardList, Package, RotateCcw, ShieldCheck, TrendingUp } from "lucide-react";
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
    return { materials: materials.count ?? 0, requests: requests.count ?? 0, bags: bags.count ?? 0, usages: usages.count ?? 0 };
  } catch { return { materials: 0, requests: 0, bags: 0, usages: 0 }; }
}

async function getAdminDashboardData() {
  const supabase = createAdminClient();
  const [pendingReq, pendingReturn, pendingSO, lowStock, activeTech, recentUsage, recentRequests] = await Promise.all([
    supabase.from("material_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("material_returns").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("stock_opnames").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("materials_with_stock").select("id,material_code,nama,gudang_qty,min_stock").lte("gudang_qty", 5).limit(6),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "TEKNISI").eq("is_active", true),
    supabase.from("material_usage_summary").select("id,no_tiket,teknisi_nama,total_qty,materials_used,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("material_request_summary").select("id,request_code,teknisi_nama,status,total_qty,created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  return {
    pendingReq: pendingReq.count ?? 0,
    pendingReturn: pendingReturn.count ?? 0,
    pendingSO: pendingSO.count ?? 0,
    activeTech: activeTech.count ?? 0,
    lowStock: lowStock.data ?? [],
    recentUsage: recentUsage.data ?? [],
    recentRequests: recentRequests.data ?? [],
  };
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const stats = await getStats(profile.role, profile.id);
  const title = profile.role === "ADMIN" ? "Dashboard Admin Gudang" : profile.role === "SUPERVISOR" ? "Dashboard Supervisor" : "Dashboard Teknisi";

  if (profile.role === "SUPERVISOR") return <AppShell profile={profile} title={title}><SupervisorDashboardClient /></AppShell>;

  if (profile.role === "ADMIN") {
    const admin = await getAdminDashboardData();
    return <AppShell profile={profile} title={title}>
      <div className="admin-dashboard-hero"><div><span>Monitoring Operasional Gudang</span><h3>Ringkasan aktivitas hari ini</h3><p>Pantau request pending, return, stok opname, stok rendah, dan aktivitas penggunaan material teknisi.</p></div><Link className="btn-primary" href="/approvals/requests">Review Request</Link></div>
      <div className="grid grid-4"><Stat label="Total Material" value={stats.materials} icon={<Package size={22} />} /><Stat label="Request Pending" value={admin.pendingReq} icon={<ClipboardList size={22} />} /><Stat label="Return Pending" value={admin.pendingReturn} icon={<RotateCcw size={22} />} /><Stat label="Stok Opname Pending" value={admin.pendingSO} icon={<ClipboardCheck size={22} />} /></div>
      <div className="admin-dashboard-grid"><section className="card"><div className="section-title"><h3>Prioritas Admin</h3><p>Item yang perlu segera dicek.</p></div><div className="admin-priority-list"><Priority href="/approvals/requests" label="Permintaan menunggu approval" value={admin.pendingReq} /><Priority href="/approvals/returns" label="Pengembalian menunggu approval" value={admin.pendingReturn} /><Priority href="/approvals/stock-opnames" label="Stok opname menunggu review" value={admin.pendingSO} /><Priority href="/monitoring/technicians" label="Teknisi aktif" value={admin.activeTech} /></div></section><section className="card"><div className="section-title"><h3>Grafik Aktivitas</h3><p>Perbandingan beban kerja admin saat ini.</p></div><div className="mini-bar-chart"><Bar label="Request" value={admin.pendingReq} max={Math.max(admin.pendingReq, admin.pendingReturn, admin.pendingSO, stats.usages, 1)} /><Bar label="Return" value={admin.pendingReturn} max={Math.max(admin.pendingReq, admin.pendingReturn, admin.pendingSO, stats.usages, 1)} /><Bar label="SO" value={admin.pendingSO} max={Math.max(admin.pendingReq, admin.pendingReturn, admin.pendingSO, stats.usages, 1)} /><Bar label="Usage" value={stats.usages} max={Math.max(admin.pendingReq, admin.pendingReturn, admin.pendingSO, stats.usages, 1)} /></div></section></div>
      <div className="admin-dashboard-grid"><section className="card"><div className="section-title"><h3>Stok Perlu Perhatian</h3><p>Material dengan stok gudang rendah.</p></div>{admin.lowStock.length === 0 ? <div className="empty-state">Belum ada material stok rendah.</div> : <div className="compact-list">{admin.lowStock.map((m: any) => <Link href="/materials" className="compact-list-item" key={m.id}><div><strong>{m.nama}</strong><span>{m.material_code}</span></div><b>{m.gudang_qty}</b></Link>)}</div>}</section><section className="card"><div className="section-title"><h3>Request Terbaru</h3><p>Aktivitas permintaan material terkini.</p></div>{admin.recentRequests.length === 0 ? <div className="empty-state">Belum ada request.</div> : <div className="compact-list">{admin.recentRequests.map((r: any) => <Link href="/approvals/requests" className="compact-list-item" key={r.id}><div><strong>{r.request_code}</strong><span>{r.teknisi_nama} • {r.status}</span></div><b>{r.total_qty}</b></Link>)}</div>}</section></div>
      <section className="card"><div className="section-title"><h3>Penggunaan Material Terbaru</h3><p>Laporan penggunaan terakhir dari teknisi.</p></div>{admin.recentUsage.length === 0 ? <div className="empty-state">Belum ada penggunaan material.</div> : <div className="compact-list horizontal">{admin.recentUsage.map((u: any) => <Link href="/laporan-penggunaan" className="compact-list-item" key={u.id}><div><strong>{u.no_tiket}</strong><span>{u.teknisi_nama} • {u.materials_used || "Material"}</span></div><b>{u.total_qty}</b></Link>)}</div>}</section>
    </AppShell>;
  }

  return <AppShell profile={profile} title={title}><div className="grid grid-4"><Stat label="Total Material" value={stats.materials} icon={<Package size={22} />} /><Stat label="Request Saya" value={stats.requests} icon={<ClipboardList size={22} />} /><Stat label="Item di Tas" value={stats.bags} icon={<Boxes size={22} />} /><Stat label="Laporan Penggunaan" value={stats.usages} icon={<ShieldCheck size={22} />} /></div><section className="card" style={{ marginTop: 16 }}><div className="section-title"><h3>Aktivitas Teknisi</h3><p>Gunakan menu Permintaan Material, Tas Saya, Penggunaan, Pengembalian, dan Stok Opname untuk menjalankan proses operasional.</p></div></section></AppShell>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="stat-card"><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div><div className="icon-box">{icon}</div></div>; }
function Priority({ href, label, value }: { href: string; label: string; value: number }) { return <Link href={href} className="priority-card"><AlertTriangle size={17} /><span>{label}</span><strong>{value}</strong></Link>; }
function Bar({ label, value, max }: { label: string; value: number; max: number }) { const height = Math.max(10, Math.round((value / max) * 120)); return <div className="bar-item"><div className="bar-track"><div className="bar-fill" style={{ height }}><span>{value}</span></div></div><small>{label}</small></div>; }
