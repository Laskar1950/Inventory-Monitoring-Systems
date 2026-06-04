import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlertTriangle, Boxes, ClipboardList, Package, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import { SupervisorDashboardClient } from "./supervisor-dashboard-client";
import { KpiCard, ChartCard, StatusBadge, ChartLegend } from "@/components/dashboard";
import { BarChart, DonutChart } from "@/components/charts";

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
    supabase.from("materials_with_stock").select("id,material_code,nama,kondisi_default,gudang_qty,min_stock").lte("gudang_qty", 5).limit(8),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "TEKNISI").eq("is_active", true),
    supabase.from("material_request_summary").select("id,request_code,teknisi_nama,status,total_qty,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("technician_stock_summary").select("*").order("overall_status", { ascending: false }).limit(10),
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

function statusText(value: string) { return value === "KRITIS" ? "Kritis" : value === "PERLU_PERHATIAN" ? "Perhatian" : "Aman"; }
function stockLabel(value: string) { return value === "LOW_STOCK" ? "Low" : value === "KOSONG" ? "Kosong" : value === "OVER_STOCK" ? "Over" : "Aman"; }

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const stats = await getStats(profile.role, profile.id);
  const title = profile.role === "ADMIN" ? "Dashboard Admin" : profile.role === "SUPERVISOR" ? "Dashboard Supervisor" : "Dashboard Teknisi";

  if (profile.role === "SUPERVISOR") return <AppShell profile={profile} title={title}><SupervisorDashboardClient /></AppShell>;

  if (profile.role === "ADMIN") {
    const admin = await getAdminDashboardData();
    const criticalTech = admin.techSummary.filter((t) => t.overall_status === "KRITIS").length;
    const amanTech = admin.techSummary.filter((t) => t.overall_status === "AMAN").length;
    const attentionTech = admin.techSummary.filter((t) => t.overall_status !== "AMAN").length;

    // Data for stok gudang donut — derive from lowStock vs total
    const lowCount = admin.lowStock.length;
    const totalMat = stats.materials;
    const kritisCount = admin.techAlerts.length > 0 ? Math.min(admin.techAlerts.length, lowCount) : 0;
    const rendahCount = Math.max(0, lowCount - kritisCount);
    const amanCount = Math.max(0, totalMat - lowCount);

    // Data for tech stock grouped bar
    const techLabels = admin.techSummary.map((t) => t.teknisi_nama.split(" ")[0]);
    const techAktual = admin.techSummary.map((t) => t.total_qty);
    const techMin = admin.techSummary.map(() => 15); // min threshold

    // Top material requests (from recentRequests — aggregate by teknisi for demo)
    const topMaterialNames = admin.lowStock.slice(0, 6).map((m: any) => (m.nama as string).slice(0, 18));
    const topMaterialQty = admin.lowStock.slice(0, 6).map((m: any) => m.gudang_qty as number);

    return (
      <AppShell profile={profile} title={title}>
        {/* === KPI GRID === */}
        <div className="dash-kpi-grid">
          <KpiCard label="Material Aktif" value={stats.materials} tone="blue" icon={<Package size={17} />} href="/materials" delta={`${stats.materials} item`} deltaDir="up" deltaLabel="total terdaftar" />
          <KpiCard label="Low Stock Gudang" value={lowCount} tone="red" icon={<AlertTriangle size={17} />} href="/materials" delta={`${lowCount > 0 ? "+" : ""}${lowCount}`} deltaDir={lowCount > 0 ? "down" : "up"} deltaLabel="perlu restok segera" />
          <KpiCard label="Request Pending" value={admin.pendingReq} tone="amber" icon={<ClipboardList size={17} />} href="/approvals/requests" delta={`${admin.pendingReq} menunggu`} deltaDir={admin.pendingReq > 0 ? "warn" : "up"} deltaLabel="approval" />
          <KpiCard label="SO Pending / Revisi" value={admin.pendingSO + admin.revisionSO} tone={admin.pendingSO + admin.revisionSO > 0 ? "red" : "blue"} icon={<ShieldCheck size={17} />} href="/approvals/stock-opnames" delta={`${admin.pendingSO} pending, ${admin.revisionSO} revisi`} deltaDir={admin.pendingSO > 0 ? "down" : "up"} />
          <KpiCard label="Teknisi Perhatian" value={attentionTech} tone={criticalTech > 0 ? "red" : "amber"} icon={<UsersRound size={17} />} href="/monitoring/technicians" delta={`${criticalTech} kritis, ${attentionTech - criticalTech} low`} deltaDir={criticalTech > 0 ? "down" : "warn"} />
        </div>

        {/* === ROW 1: Stok Gudang Donut + Prioritas === */}
        <div className="dash-row dash-row-2-1">
          <ChartCard
            title="Distribusi Status Stok Gudang"
            subtitle="Kondisi stok material di gudang saat ini"
            footer={
              <ChartLegend items={[
                { color: "#22c55e", label: `Aman (${amanCount})` },
                { color: "#f59e0b", label: `Rendah (${rendahCount})` },
                { color: "#ef4444", label: `Kritis (${kritisCount})` },
              ]} />
            }
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <DonutChart
                segments={[
                  { label: "Aman", value: amanCount, color: "#22c55e" },
                  { label: "Rendah", value: rendahCount, color: "#f59e0b" },
                  { label: "Kritis", value: kritisCount, color: "#ef4444" },
                ]}
                size={170}
                thickness={38}
                centerValue={totalMat}
                centerLabel="Total Item"
              />
            </div>
          </ChartCard>

          <ChartCard title="Prioritas Hari Ini" subtitle="Pekerjaan yang perlu diproses admin gudang">
            <div className="dash-priority-list">
              <DashPriority href="/approvals/requests" label="Permintaan material pending" value={admin.pendingReq} color="amber" />
              <DashPriority href="/approvals/returns" label="Pengembalian pending" value={admin.pendingReturn} color="blue" />
              <DashPriority href="/approvals/stock-opnames" label="Stok opname pending" value={admin.pendingSO} color="red" />
              <DashPriority href="/approvals/stock-opnames" label="SO menunggu revisi teknisi" value={admin.revisionSO} color="red" />
            </div>
          </ChartCard>
        </div>

        {/* === ROW 2: Stok per Teknisi Bar === */}
        {admin.techSummary.length > 0 && (
          <ChartCard
            title="Stok Material per Teknisi"
            subtitle="Perbandingan total qty stok aktual tiap teknisi"
            footer={
              <ChartLegend items={[
                { color: "#3b82f6", label: "Stok Aktual (qty)" },
                { color: "rgba(239,68,68,0.4)", label: "Batas Minimal" },
              ]} />
            }
          >
            <div style={{ height: 220 }}>
              <BarChart
                labels={techLabels}
                datasets={[
                  { label: "Stok Aktual", data: techAktual, color: "#3b82f6" },
                  { label: "Batas Minimal", data: techMin, color: "rgba(239,68,68,0.4)" },
                ]}
                height={220}
                showLegend={false}
              />
            </div>
          </ChartCard>
        )}

        {/* === ROW 3: Low Stock + Alert Teknisi === */}
        <div className="dash-row dash-row-1-1">
          <ChartCard title="Material Gudang Stok Rendah" subtitle="Material yang perlu segera direstok">
            {admin.lowStock.length === 0 ? (
              <p className="dash-empty">Semua stok aman.</p>
            ) : (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr><th>Material</th><th>Kode</th><th>Kondisi</th><th>Qty</th><th>Min</th></tr>
                  </thead>
                  <tbody>
                    {admin.lowStock.map((m: any) => (
                      <tr key={m.id}>
                        <td><strong>{m.nama}</strong></td>
                        <td className="dash-td-muted">{m.material_code}</td>
                        <td>{m.kondisi_default}</td>
                        <td><span style={{ color: "var(--color-error)", fontWeight: 700 }}>{m.gudang_qty}</span></td>
                        <td className="dash-td-muted">{m.min_stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Teknisi Perlu Perhatian" subtitle="Stok teknisi di bawah batas minimal">
            {admin.techAlerts.length === 0 ? (
              <p className="dash-empty">Semua stok teknisi aman.</p>
            ) : (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr><th>Teknisi</th><th>Material</th><th>Kondisi</th><th>Qty</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {admin.techAlerts.map((a, i) => (
                      <tr key={`${a.teknisi_id}-${a.material_code}-${i}`}>
                        <td><strong>{a.teknisi_nama.split(" ")[0]}</strong></td>
                        <td className="dash-td-muted">{a.material_nama}</td>
                        <td className="dash-td-muted">{a.kondisi}</td>
                        <td>{a.current_qty}</td>
                        <td><StatusBadge status={a.stock_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>

        {/* === ROW 4: Request Terbaru + Serial Movement === */}
        <div className="dash-row dash-row-1-1">
          <ChartCard title="Request Material Terbaru" subtitle="Permintaan terbaru dari teknisi">
            {admin.recentRequests.length === 0 ? (
              <p className="dash-empty">Belum ada request.</p>
            ) : (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr><th>Kode</th><th>Teknisi</th><th>Status</th><th>Qty</th><th>Tanggal</th></tr>
                  </thead>
                  <tbody>
                    {admin.recentRequests.map((r: any) => (
                      <tr key={r.id}>
                        <td><Link href="/approvals/requests" className="dash-link">{r.request_code}</Link></td>
                        <td>{r.teknisi_nama}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>{r.total_qty}</td>
                        <td className="dash-td-muted">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Serial Number Movement" subtitle="Pergerakan serial number terbaru">
            {admin.serialMoves.length === 0 ? (
              <p className="dash-empty">Belum ada riwayat serial.</p>
            ) : (
              <div className="dash-serial-list">
                {admin.serialMoves.map((m: any) => (
                  <div key={m.id} className="dash-serial-item">
                    <div className="dash-serial-sn">{m.serial_number}</div>
                    <div className="dash-serial-meta">
                      <span>{m.material_nama}</span>
                      <span className="dash-serial-move">{m.from_location_type || "–"} → {m.to_location_type || "–"}{m.to_teknisi_nama ? ` • ${m.to_teknisi_nama}` : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </AppShell>
    );
  }

  // TEKNISI view
  return (
    <AppShell profile={profile} title={title}>
      <div className="dash-kpi-grid dash-kpi-grid-4">
        <KpiCard label="Total Material" value={stats.materials} tone="blue" icon={<Package size={17} />} />
        <KpiCard label="Request Saya" value={stats.requests} tone="amber" icon={<ClipboardList size={17} />} />
        <KpiCard label="Item di Tas" value={stats.bags} tone="green" icon={<Boxes size={17} />} />
        <KpiCard label="Laporan Penggunaan" value={stats.usages} tone="teal" icon={<ShieldCheck size={17} />} />
      </div>
      <section className="dash-chart-card" style={{ marginTop: 16 }}>
        <div className="dash-chart-card-header"><div><h3 className="dash-chart-title">Aktivitas Teknisi</h3><p className="dash-chart-subtitle">Gunakan menu navigasi untuk menjalankan proses operasional.</p></div></div>
      </section>
    </AppShell>
  );
}

function DashPriority({ href, label, value, color }: { href: string; label: string; value: number; color: string }) {
  return (
    <Link href={href} className={`dash-priority-item dash-priority-${color}`}>
      <AlertTriangle size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}
