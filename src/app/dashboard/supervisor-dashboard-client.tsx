"use client";

import { useEffect, useState } from "react";
import { ChartCard, StatusBadge, ChartLegend } from "@/components/dashboard";
import { LineChart, BarChart, DonutChart } from "@/components/charts";

type Summary = { total_material: number; low_stock: number; total_teknisi: number; active_teknisi: number; total_usage: number; total_return: number; total_stock_opname: number; total_request_pending: number };
type LowStock = { material_id: string; material_code: string; nama: string; stock_gudang: number; min_stock: number; stock_status: string };
type Technician = { teknisi_id: string; nama: string; bag_total_qty: number; total_activity: number; last_activity_at: string | null };
type Activity = { id: string; action: string; entity_type: string; description: string | null; created_at: string };
type TopMaterial = { material_id: string; material_code: string; nama: string; total_used: number };

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const CHART_COLORS = { blue: "#3b82f6", green: "#22c55e", amber: "#f59e0b", red: "#ef4444", teal: "#14b8a6", purple: "#a855f7" };

export function SupervisorDashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [topMaterials, setTopMaterials] = useState<TopMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/supervisor");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat dashboard supervisor.");
      setSummary(json.summary);
      setLowStock(json.low_stock || []);
      setTechnicians(json.technicians || []);
      setActivities(json.recent_activities || []);
      setTopMaterials(json.top_materials || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat dashboard supervisor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  if (loading && !summary) return <section className="dash-chart-card"><p className="dash-empty">Memuat dashboard supervisor...</p></section>;
  if (error) return <section className="dash-chart-card"><p style={{ color: "var(--color-error)", marginBottom: 12 }}>{error}</p><button className="btn-primary" onClick={() => void loadData()}>Coba Lagi</button></section>;

  const s = summary!;

  // Donut: status stok teknisi
  const amanTech = technicians.filter((t) => t.bag_total_qty >= 15).length;
  const lowTech = technicians.filter((t) => t.bag_total_qty > 0 && t.bag_total_qty < 15).length;
  const kritisTech = technicians.filter((t) => t.bag_total_qty === 0).length;

  // Line chart: aktivitas teknisi (total_activity per teknisi)
  const techChartLabels = technicians.slice(0, 7).map((t) => t.nama.split(" ")[0]);
  const techActivityData = technicians.slice(0, 7).map((t) => t.total_activity);
  const techBagData = technicians.slice(0, 7).map((t) => t.bag_total_qty);

  // Bar chart: top material
  const topMatLabels = topMaterials.slice(0, 5).map((m) => m.nama.slice(0, 16));
  const topMatData = topMaterials.slice(0, 5).map((m) => m.total_used);

  return (
    <div className="supervisor-dashboard-redesign">
      {/* === KPI 4 CARDS === */}
      <div className="dash-kpi-grid dash-kpi-grid-4">
        <div className="dash-kpi-card dash-kpi-blue">
          <div className="dash-kpi-header"><span className="dash-kpi-label">Total Material</span>
            <div className="dash-kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
          </div>
          <div className="dash-kpi-value">{s.total_material}</div>
          <div className="dash-kpi-delta dash-kpi-delta-up"><span>{s.low_stock} stok rendah</span></div>
        </div>
        <div className="dash-kpi-card dash-kpi-red">
          <div className="dash-kpi-header"><span className="dash-kpi-label">Stok Rendah</span>
            <div className="dash-kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
          </div>
          <div className="dash-kpi-value">{s.low_stock}</div>
          <div className="dash-kpi-delta dash-kpi-delta-down"><span>{((s.low_stock / Math.max(s.total_material, 1)) * 100).toFixed(1)}% dari total material</span></div>
        </div>
        <div className="dash-kpi-card dash-kpi-green">
          <div className="dash-kpi-header"><span className="dash-kpi-label">Teknisi Aktif</span>
            <div className="dash-kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
          </div>
          <div className="dash-kpi-value">{s.active_teknisi}</div>
          <div className="dash-kpi-delta dash-kpi-delta-up"><span>{s.total_teknisi} total terdaftar</span></div>
        </div>
        <div className="dash-kpi-card dash-kpi-amber">
          <div className="dash-kpi-header"><span className="dash-kpi-label">Total Penggunaan</span>
            <div className="dash-kpi-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg></div>
          </div>
          <div className="dash-kpi-value">{s.total_usage.toLocaleString("id-ID")}</div>
          <div className="dash-kpi-delta dash-kpi-delta-up"><span>{s.total_return} dikembalikan</span></div>
        </div>
      </div>

      {/* === ROW 1: Aktivitas Teknisi Chart + Donut Status === */}
      <div className="dash-row dash-row-2-1">
        {techChartLabels.length > 1 ? (
          <ChartCard
            title="Aktivitas & Stok Teknisi"
            subtitle="Perbandingan total aktivitas vs qty stok tiap teknisi"
            action={<button className="dash-btn-refresh" onClick={() => void loadData()} disabled={loading}>Refresh</button>}
            footer={
              <ChartLegend items={[
                { color: CHART_COLORS.blue, label: "Total Aktivitas" },
                { color: CHART_COLORS.green, label: "Qty Stok di Tas" },
              ]} />
            }
          >
            <div style={{ height: 210 }}>
              <LineChart
                labels={techChartLabels}
                datasets={[
                  { label: "Total Aktivitas", data: techActivityData, color: CHART_COLORS.blue, fill: true },
                  { label: "Qty Stok", data: techBagData, color: CHART_COLORS.green, dashed: true },
                ]}
                height={210}
              />
            </div>
          </ChartCard>
        ) : (
          <ChartCard title="Aktivitas Teknisi" subtitle="Data belum cukup untuk ditampilkan sebagai chart">
            <p className="dash-empty">Minimal 2 teknisi dibutuhkan untuk chart.</p>
          </ChartCard>
        )}

        <ChartCard
          title="Status Stok Teknisi"
          subtitle="Distribusi kondisi stok per teknisi"
          footer={
            <ChartLegend items={[
              { color: CHART_COLORS.green, label: `Aman (${amanTech})` },
              { color: CHART_COLORS.amber, label: `Perhatian (${lowTech})` },
              { color: CHART_COLORS.red, label: `Kritis (${kritisTech})` },
            ]} />
          }
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <DonutChart
              segments={[
                { label: "Aman", value: amanTech, color: CHART_COLORS.green },
                { label: "Perhatian", value: lowTech, color: CHART_COLORS.amber },
                { label: "Kritis", value: kritisTech, color: CHART_COLORS.red },
              ]}
              size={160}
              thickness={36}
              centerValue={s.active_teknisi}
              centerLabel="Teknisi"
            />
          </div>
        </ChartCard>
      </div>

      {/* === METRIC SUMMARY ROW === */}
      <div className="dash-metric-row">
        <div className="dash-metric-item"><div className="dash-metric-val">{s.total_usage.toLocaleString("id-ID")}</div><div className="dash-metric-label">Total Pemakaian</div></div>
        <div className="dash-metric-item"><div className="dash-metric-val">{s.total_return.toLocaleString("id-ID")}</div><div className="dash-metric-label">Total Pengembalian</div></div>
        <div className="dash-metric-item"><div className="dash-metric-val">{Math.max(0, s.total_usage - s.total_return).toLocaleString("id-ID")}</div><div className="dash-metric-label">Net Pemakaian</div></div>
        <div className="dash-metric-item">
          <div className="dash-metric-val" style={{ color: "var(--color-success)" }}>
            {s.total_usage > 0 ? ((s.total_return / s.total_usage) * 100).toFixed(1) : "0.0"}%
          </div>
          <div className="dash-metric-label">Efisiensi Return</div>
        </div>
        <div className="dash-metric-item"><div className="dash-metric-val">{s.total_request_pending}</div><div className="dash-metric-label">Request Pending</div></div>
        <div className="dash-metric-item"><div className="dash-metric-val">{s.total_stock_opname}</div><div className="dash-metric-label">Stok Opname</div></div>
      </div>

      {/* === ROW 2: Top Material Bar + Low Stock Table === */}
      <div className="dash-row dash-row-1-1">
        {topMatLabels.length > 0 ? (
          <ChartCard
            title="Top Material Paling Banyak Digunakan"
            subtitle="Prioritas pengadaan stok berikutnya"
          >
            <div style={{ height: 220 }}>
              <BarChart
                labels={topMatLabels}
                datasets={[{ label: "Total Digunakan", data: topMatData, color: CHART_COLORS.teal }]}
                height={220}
                horizontal={true}
              />
            </div>
          </ChartCard>
        ) : (
          <ChartCard title="Top Material" subtitle="Belum ada data pemakaian">
            <p className="dash-empty">Belum ada data pemakaian material.</p>
          </ChartCard>
        )}

        <ChartCard title="Material Stok Rendah" subtitle="Material yang membutuhkan pengadaan segera">
          {lowStock.length === 0 ? (
            <p className="dash-empty">Tidak ada material stok rendah.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead><tr><th>Material</th><th>Kode</th><th>Gudang</th><th>Min</th><th>Status</th></tr></thead>
                <tbody>
                  {lowStock.map((r) => (
                    <tr key={r.material_id}>
                      <td><strong>{r.nama}</strong></td>
                      <td className="dash-td-muted">{r.material_code}</td>
                      <td style={{ color: "var(--color-error)", fontWeight: 700 }}>{r.stock_gudang}</td>
                      <td className="dash-td-muted">{r.min_stock}</td>
                      <td><StatusBadge status={r.stock_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      {/* === ROW 3: Aktivitas Teknisi Table + Aktivitas Terbaru === */}
      <div className="dash-row dash-row-1-1">
        <ChartCard title="Ringkasan Aktivitas Teknisi" subtitle="Produktivitas dan stok per teknisi">
          {technicians.length === 0 ? (
            <p className="dash-empty">Belum ada data teknisi.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead><tr><th>#</th><th>Teknisi</th><th>Qty Tas</th><th>Aktivitas</th><th>Terakhir Aktif</th></tr></thead>
                <tbody>
                  {technicians.map((r, i) => (
                    <tr key={r.teknisi_id}>
                      <td className="dash-td-muted">{String(i + 1).padStart(2, "0")}</td>
                      <td><strong>{r.nama}</strong></td>
                      <td>
                        <div className="dash-progress-wrap">
                          <div className="dash-progress-bar">
                            <div className="dash-progress-fill" style={{ width: `${Math.min((r.bag_total_qty / 50) * 100, 100)}%`, background: r.bag_total_qty === 0 ? "var(--color-error)" : r.bag_total_qty < 15 ? "var(--color-warning)" : "var(--color-primary)" }} />
                          </div>
                          <span className="dash-progress-val">{r.bag_total_qty}</span>
                        </div>
                      </td>
                      <td>{r.total_activity}</td>
                      <td className="dash-td-muted">{formatDate(r.last_activity_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Log Aktivitas Terbaru" subtitle="Aktivitas sistem terbaru">
          {activities.length === 0 ? (
            <p className="dash-empty">Belum ada log aktivitas.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead><tr><th>Waktu</th><th>Aksi</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {activities.map((r) => (
                    <tr key={r.id}>
                      <td className="dash-td-muted">{formatDate(r.created_at)}</td>
                      <td><strong>{r.action}</strong></td>
                      <td className="dash-td-muted">{r.description || r.entity_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
