import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlertTriangle, Boxes, ClipboardList, Package, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import { SupervisorDashboardClient } from "./supervisor-dashboard-client";

type TechSummary = { teknisi_id: string; teknisi_nama: string; material_count: number; total_qty: number; aman_count: number; low_count: number; kosong_count: number; over_count: number; overall_status: string };
type TechAlert = { teknisi_id: string; teknisi_nama: string; material_code: string; material_nama: string; kondisi: string; current_qty: number; min_qty: number; max_qty: number; stock_status: string };

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
  const [pendingReq, pendingReturn, pendingSO, revisionSO, lowStock, activeTech, recentRequests, techSummary, techAlerts, serialMoves] = await Promise.all([
    supabase.from("material_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("material_returns").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("stock_opnames").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("stock_opnames").select("id", { count: "exact", head: true }).eq("status", "REVISION"),
    supabase.from("materials_with_stock").select("id,material_code,nama,kondisi_default,gudang_qty,min_stock").lte("gudang_qty", 5).limit(6),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "TEKNISI").eq("is_active", true),
    supabase.from("material_request_summary").select("id,request_code,teknisi_nama,status,total_qty,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("technician_stock_summary").select("*").order("overall_status", { ascending: false }).limit(8),
    supabase.from("technician_stock_alerts").select("*").limit(8),
    supabase.from("material_serial_movement_detail").select("id,serial_number,material_nama,movement_type,from_location_type,to_location_type,to_teknisi_nama,created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  return {
    pendingReq: pendingReq.count ?? 0,
    pendingReturn: pendingReturn.count ?? 0,
    pendingSO: pendingSO.count ?? 0,
    revisionSO: revisionSO.count ?? 0,
    activeTech: activeTech.count ?? 0,
    lowStock: lowStock.data ?? [],
    recentRequests: recentRequests.data ?? [],
    techSummary: (techSummary.data ?? []) as TechSummary[],
    techAlerts: (techAlerts.data ?? []) as TechAlert[],
    serialMoves: serialMoves.data ?? [],
  };
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const stats = await getStats(profile.role, profile.id);
  const title = profile.role === "ADMIN" ? "Dashboard Admin" : profile.role === "SUPERVISOR" ? "Dashboard Supervisor" : "Dashboard Teknisi";

  if (profile.role === "SUPERVISOR") return <AppShell profile={profile} title={title}><SupervisorDashboardClient /></AppShell>;

  if (profile.role === "ADMIN") {
    const admin = await getAdminDashboardData();
    const criticalTech = admin.techSummary.filter((t) => t.overall_status === "KRITIS").length;
    const attentionTech = admin.techSummary.filter((t) => t.overall_status !== "AMAN").length;
    const maxTech = Math.max(...admin.techSummary.map((t) => t.material_count), 1);
    return <AppShell profile={profile} title={title}>
      <div className="inventory-kpi-grid"><KpiCard label="Material Aktif" value={stats.materials} tone="blue" icon={<Package size={20}/>} href="/materials"/><KpiCard label="Low Stock Gudang" value={admin.lowStock.length} tone="amber" icon={<AlertTriangle size={20}/>} href="/materials"/><KpiCard label="Request Pending" value={admin.pendingReq} tone="amber" icon={<ClipboardList size={20}/>} href="/approvals/requests"/><KpiCard label="SO Pending/Revisi" value={admin.pendingSO + admin.revisionSO} tone="red" icon={<ShieldCheck size={20}/>} href="/approvals/stock-opnames"/><KpiCard label="Teknisi Perhatian" value={attentionTech} tone={criticalTech > 0 ? "red" : "blue"} icon={<UsersRound size={20}/>} href="/monitoring/technicians"/></div>
      <div className="admin-monitor-grid"><section className="card technician-stock-card"><div className="dash-card-head"><div><h3>Stok Material per Teknisi</h3><p>Status dihitung dari aturan min/max. Kabel precon dianggap aman jika stok teknisi = 5.</p></div><span className="chip">Live</span></div>{admin.techSummary.length === 0 ? <div className="empty-state">Belum ada stok aktif di tas teknisi.</div> : <div className="tech-stock-bars">{admin.techSummary.map((t) => <div className="tech-stock-row" key={t.teknisi_id}><div className="tech-stock-name"><strong>{t.teknisi_nama}</strong><span>{t.total_qty} qty • {t.material_count} material</span></div><div className="stacked-stock-bar" title={`${t.aman_count} aman, ${t.low_count} low, ${t.kosong_count} kosong, ${t.over_count} over`}><i className="ok" style={{ width: `${Math.max(4, (t.aman_count / maxTech) * 100)}%` }}/><i className="low" style={{ width: `${Math.max(t.low_count ? 4 : 0, (t.low_count / maxTech) * 100)}%` }}/><i className="empty" style={{ width: `${Math.max(t.kosong_count ? 4 : 0, (t.kosong_count / maxTech) * 100)}%` }}/><i className="over" style={{ width: `${Math.max(t.over_count ? 4 : 0, (t.over_count / maxTech) * 100)}%` }}/></div><span className={`stock-pill ${t.overall_status.toLowerCase()}`}>{statusText(t.overall_status)}</span></div>)}</div>}</section><section className="card"><div className="dash-card-head"><div><h3>Prioritas Hari Ini</h3><p>Pekerjaan yang perlu diproses admin gudang.</p></div></div><div className="admin-priority-list"><Priority href="/approvals/requests" label="Permintaan material menunggu approval" value={admin.pendingReq}/><Priority href="/approvals/returns" label="Pengembalian menunggu approval" value={admin.pendingReturn}/><Priority href="/approvals/stock-opnames" label="Stok opname pending review" value={admin.pendingSO}/><Priority href="/approvals/stock-opnames" label="Stok opname menunggu revisi teknisi" value={admin.revisionSO}/></div></section></div>
      <div className="admin-monitor-grid lower"><section className="card"><div className="dash-card-head"><div><h3>Teknisi Perlu Perhatian</h3><p>Material teknisi yang low/kosong/over stock.</p></div></div>{admin.techAlerts.length === 0 ? <div className="empty-state">Semua stok teknisi aman.</div> : <div className="compact-list">{admin.techAlerts.map((a, index) => <div className="compact-list-item" key={`${a.teknisi_id}-${a.material_code}-${index}`}><div><strong>{a.teknisi_nama}</strong><span>{a.material_nama} • {a.kondisi} • min {a.min_qty} / max {a.max_qty}</span></div><b className={`stock-text ${a.stock_status.toLowerCase()}`}>{a.current_qty} {stockLabel(a.stock_status)}</b></div>)}</div>}</section><section className="card"><div className="dash-card-head"><div><h3>Serial Number Movement</h3><p>Pergerakan serial number terbaru dari ledger.</p></div></div>{admin.serialMoves.length === 0 ? <div className="empty-state">Belum ada riwayat serial.</div> : <div className="serial-move-list">{admin.serialMoves.map((m: any) => <div className="serial-move-card" key={m.id}><strong>{m.serial_number}</strong><span>{m.material_nama}</span><small>{m.from_location_type || "-"} → {m.to_location_type || "-"}{m.to_teknisi_nama ? ` • ${m.to_teknisi_nama}` : ""}</small></div>)}</div>}</section><section className="card"><div className="dash-card-head"><div><h3>Material Gudang Low Stock</h3><p>Material gudang yang perlu ditindaklanjuti.</p></div></div>{admin.lowStock.length === 0 ? <div className="empty-state">Belum ada material stok rendah.</div> : <div className="compact-list">{admin.lowStock.map((m: any) => <Link href="/materials" className="compact-list-item" key={m.id}><div><strong>{m.nama}</strong><span>{m.material_code} • {m.kondisi_default}</span></div><b>{m.gudang_qty}</b></Link>)}</div>}</section></div>
      <section className="card" style={{ marginTop: 16 }}><div className="dash-card-head"><div><h3>Request Terbaru</h3><p>Permintaan material terbaru dari teknisi.</p></div></div>{admin.recentRequests.length === 0 ? <div className="empty-state">Belum ada request.</div> : <div className="compact-list horizontal">{admin.recentRequests.map((r: any) => <Link href="/approvals/requests" className="compact-list-item" key={r.id}><div><strong>{r.request_code}</strong><span>{r.teknisi_nama} • {r.status}</span></div><b>{r.total_qty}</b></Link>)}</div>}</section>
    </AppShell>;
  }

  return <AppShell profile={profile} title={title}><div className="grid grid-4"><Stat label="Total Material" value={stats.materials} icon={<Package size={22} />} /><Stat label="Request Saya" value={stats.requests} icon={<ClipboardList size={22} />} /><Stat label="Item di Tas" value={stats.bags} icon={<Boxes size={22} />} /><Stat label="Laporan Penggunaan" value={stats.usages} icon={<ShieldCheck size={22} />} /></div><section className="card" style={{ marginTop: 16 }}><div className="section-title"><h3>Aktivitas Teknisi</h3><p>Gunakan menu Permintaan Material, Tas Saya, Penggunaan, Pengembalian, dan Stok Opname untuk menjalankan proses operasional.</p></div></section></AppShell>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="stat-card"><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div><div className="icon-box">{icon}</div></div>; }
function KpiCard({ label, value, icon, tone, href }: { label: string; value: number; icon: React.ReactNode; tone: string; href: string }) { return <Link href={href} className={`inventory-kpi-card ${tone}`}><div><span>{label}</span><strong>{value}</strong></div><em>{icon}</em></Link>; }
function Priority({ href, label, value }: { href: string; label: string; value: number }) { return <Link href={href} className="priority-card"><AlertTriangle size={17} /><span>{label}</span><strong>{value}</strong></Link>; }
function statusText(value: string) { return value === "KRITIS" ? "Kritis" : value === "PERLU_PERHATIAN" ? "Perlu Perhatian" : "Aman"; }
function stockLabel(value: string) { return value === "LOW_STOCK" ? "Low" : value === "KOSONG" ? "Kosong" : value === "OVER_STOCK" ? "Over" : "Aman"; }
