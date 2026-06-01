import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlertTriangle, Boxes, CalendarDays, ClipboardCheck, ClipboardList, Package, RotateCcw, ShieldCheck, Target, TrendingUp } from "lucide-react";
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
  return { pendingReq: pendingReq.count ?? 0, pendingReturn: pendingReturn.count ?? 0, pendingSO: pendingSO.count ?? 0, activeTech: activeTech.count ?? 0, lowStock: lowStock.data ?? [], recentUsage: recentUsage.data ?? [], recentRequests: recentRequests.data ?? [] };
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const stats = await getStats(profile.role, profile.id);
  const title = profile.role === "ADMIN" ? "Store Overview" : profile.role === "SUPERVISOR" ? "Supervisor Overview" : "Technician Overview";

  if (profile.role === "SUPERVISOR") return <AppShell profile={profile} title={title}><SupervisorDashboardClient /></AppShell>;

  if (profile.role === "ADMIN") {
    const admin = await getAdminDashboardData();
    const max = Math.max(admin.pendingReq, admin.pendingReturn, admin.pendingSO, stats.usages, 1);
    const goal = Math.min(100, Math.round(((stats.materials + stats.usages) / Math.max(1, stats.materials + stats.usages + admin.pendingReq + admin.pendingReturn + admin.pendingSO)) * 100));
    return <AppShell profile={profile} title={title}>
      <div className="overview-kicker">Here is how your inventory operation is performing today.</div>
      <div className="overview-top-grid"><MetricCard label="Total Material" value={stats.materials} icon={<Package size={21} />} trend="Aktif di gudang" bars={[35,55,42,70,48,86,58]} /><MetricCard label="Request Pending" value={admin.pendingReq} icon={<ClipboardList size={21} />} trend="Menunggu approval" bars={[20,32,26,44,36,54,72]} /><GoalCard percent={goal} /></div>
      <div className="overview-main-grid"><section className="card overview-chart-card"><div className="overview-card-head"><div><h3>Activity Analytics</h3><p>Perbandingan aktivitas operasional inventory.</p></div><span className="chip"><CalendarDays size={14}/> Hari ini</span></div><div className="line-chart-fake"><svg viewBox="0 0 720 240" preserveAspectRatio="none"><defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02"/></linearGradient></defs><path d="M0 150 C90 120 110 70 180 118 C260 175 270 72 355 90 C420 102 430 38 505 66 C585 92 596 160 720 78 L720 240 L0 240 Z" fill="url(#lineFill)"/><path d="M0 150 C90 120 110 70 180 118 C260 175 270 72 355 90 C420 102 430 38 505 66 C585 92 596 160 720 78" fill="none" stroke="#2A64F6" strokeWidth="5" strokeLinecap="round"/></svg></div></section><section className="card heatmap-card"><div className="overview-card-head"><div><h3>Admin Workload</h3><p>Area yang harus dipantau.</p></div><span className="chip">Live</span></div><div className="heatmap-list"><Heat label="Request" value={admin.pendingReq}/><Heat label="Return" value={admin.pendingReturn}/><Heat label="SO" value={admin.pendingSO}/><Heat label="Usage" value={stats.usages}/><Heat label="Teknisi" value={admin.activeTech}/></div></section></div>
      <div className="overview-bottom-grid"><section className="card"><div className="section-title"><h3>Budget Usage</h3><p>Prioritas pekerjaan admin.</p></div><div className="admin-priority-list"><Priority href="/approvals/requests" label="Permintaan menunggu approval" value={admin.pendingReq} /><Priority href="/approvals/returns" label="Pengembalian menunggu approval" value={admin.pendingReturn} /><Priority href="/approvals/stock-opnames" label="Stok opname menunggu review" value={admin.pendingSO} /></div></section><section className="card"><div className="section-title"><h3>Recent Request</h3><p>Permintaan material terbaru.</p></div>{admin.recentRequests.length === 0 ? <div className="empty-state">Belum ada request.</div> : <div className="compact-list">{admin.recentRequests.map((r: any) => <Link href="/approvals/requests" className="compact-list-item" key={r.id}><div><strong>{r.request_code}</strong><span>{r.teknisi_nama} • {r.status}</span></div><b>{r.total_qty}</b></Link>)}</div>}</section><section className="card"><div className="section-title"><h3>Low Stock Alert</h3><p>Material dengan stok gudang rendah.</p></div>{admin.lowStock.length === 0 ? <div className="empty-state">Belum ada material stok rendah.</div> : <div className="compact-list">{admin.lowStock.map((m: any) => <Link href="/materials" className="compact-list-item" key={m.id}><div><strong>{m.nama}</strong><span>{m.material_code}</span></div><b>{m.gudang_qty}</b></Link>)}</div>}<Link href="/materials" className="btn-primary full" style={{ marginTop: 12 }}>Restock Now</Link></section></div>
    </AppShell>;
  }

  return <AppShell profile={profile} title={title}><div className="grid grid-4"><Stat label="Total Material" value={stats.materials} icon={<Package size={22} />} /><Stat label="Request Saya" value={stats.requests} icon={<ClipboardList size={22} />} /><Stat label="Item di Tas" value={stats.bags} icon={<Boxes size={22} />} /><Stat label="Laporan Penggunaan" value={stats.usages} icon={<ShieldCheck size={22} />} /></div><section className="card" style={{ marginTop: 16 }}><div className="section-title"><h3>Aktivitas Teknisi</h3><p>Gunakan menu Permintaan Material, Tas Saya, Penggunaan, Pengembalian, dan Stok Opname untuk menjalankan proses operasional.</p></div></section></AppShell>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="stat-card"><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div><div className="icon-box">{icon}</div></div>; }
function MetricCard({ label, value, icon, trend, bars }: { label: string; value: number; icon: React.ReactNode; trend: string; bars: number[] }) { return <section className="card metric-card"><div className="metric-left"><div className="icon-box">{icon}</div><span>{label}</span><strong>{value.toLocaleString("id-ID")}</strong><small><TrendingUp size={13}/> {trend}</small></div><div className="metric-bars">{bars.map((h, i) => <i key={i} style={{ height: h }} />)}</div></section>; }
function GoalCard({ percent }: { percent: number }) { return <section className="card goal-card"><div><div className="icon-box"><Target size={21}/></div><h3>Monthly Goals</h3><div className="goal-stats"><span>Target<br/><b>100%</b></span><span>Achieved<br/><b>{percent}%</b></span></div></div><div className="goal-ring" style={{ ["--p" as any]: `${percent}%` }}><strong>{percent}%</strong></div></section>; }
function Priority({ href, label, value }: { href: string; label: string; value: number }) { return <Link href={href} className="priority-card"><AlertTriangle size={17} /><span>{label}</span><strong>{value}</strong></Link>; }
function Heat({ label, value }: { label: string; value: number }) { const cells = Array.from({ length: 7 }, (_, i) => i < Math.min(7, Math.max(1, value))); return <div className="heat-row"><span>{label}</span><div>{cells.map((active, i) => <i key={i} className={active ? "active" : ""} />)}</div></div>; }
function Bar({ label, value, max }: { label: string; value: number; max: number }) { const height = Math.max(10, Math.round((value / max) * 120)); return <div className="bar-item"><div className="bar-track"><div className="bar-fill" style={{ height }}><span>{value}</span></div></div><small>{label}</small></div>; }
