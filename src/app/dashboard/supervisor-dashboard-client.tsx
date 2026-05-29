"use client";

import { useEffect, useState } from "react";

type Summary = { total_material: number; low_stock: number; total_teknisi: number; active_teknisi: number; total_usage: number; total_return: number; total_stock_opname: number; total_request_pending: number };
type LowStock = { material_id: string; material_code: string; nama: string; stock_gudang: number; min_stock: number; stock_status: string };
type Technician = { teknisi_id: string; nama: string; bag_total_qty: number; total_activity: number; last_activity_at: string | null };
type Activity = { id: string; action: string; entity_type: string; description: string | null; created_at: string };
type TopMaterial = { material_id: string; material_code: string; nama: string; total_used: number };

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

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

  if (loading && !summary) return <section className="card">Memuat dashboard supervisor...</section>;
  if (error) return <section className="card"><div className="alert-error">{error}</div><button className="btn-primary" onClick={() => void loadData()}>Coba Lagi</button></section>;

  return (
    <div className="supervisor-dashboard-view">
      <section className="supervisor-page-hero">
        <div className="supervisor-hero-kicker">Supervisor Analytics</div>
        <div className="supervisor-hero-row">
          <div className="supervisor-hero-copy">
            <h4>Dashboard Monitoring Inventory</h4>
            <p>Ringkasan stok, aktivitas teknisi, tren pemakaian, return, stok opname, dan alert stok rendah.</p>
          </div>
          <button className="btn-primary" onClick={() => void loadData()} disabled={loading}>Refresh</button>
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Stat label="Total Material" value={summary?.total_material || 0} />
        <Stat label="Stok Rendah" value={summary?.low_stock || 0} />
        <Stat label="Teknisi Aktif" value={summary?.active_teknisi || 0} />
        <Stat label="Request Pending" value={summary?.total_request_pending || 0} />
        <Stat label="Penggunaan" value={summary?.total_usage || 0} />
        <Stat label="Return" value={summary?.total_return || 0} />
        <Stat label="Stok Opname" value={summary?.total_stock_opname || 0} />
        <Stat label="Total Teknisi" value={summary?.total_teknisi || 0} />
      </div>

      <div className="grid grid-2">
        <TableCard title="Material Stok Rendah" headers={["Kode", "Material", "Gudang", "Min", "Status"]} empty="Tidak ada stok rendah.">
          {lowStock.map((r) => <tr key={r.material_id}><td>{r.material_code}</td><td>{r.nama}</td><td>{r.stock_gudang}</td><td>{r.min_stock}</td><td><span className="badge badge-warning">{r.stock_status}</span></td></tr>)}
        </TableCard>
        <TableCard title="Top Material Digunakan" headers={["Kode", "Material", "Total Used"]} empty="Belum ada pemakaian material.">
          {topMaterials.map((r) => <tr key={r.material_id}><td>{r.material_code}</td><td>{r.nama}</td><td>{r.total_used}</td></tr>)}
        </TableCard>
        <TableCard title="Aktivitas Teknisi" headers={["Teknisi", "Qty Tas", "Aktivitas", "Terakhir"]} empty="Belum ada aktivitas teknisi.">
          {technicians.map((r) => <tr key={r.teknisi_id}><td>{r.nama}</td><td>{r.bag_total_qty}</td><td>{r.total_activity}</td><td>{formatDate(r.last_activity_at)}</td></tr>)}
        </TableCard>
        <TableCard title="Aktivitas Terbaru" headers={["Waktu", "Aksi", "Deskripsi"]} empty="Belum ada log aktivitas.">
          {activities.map((r) => <tr key={r.id}><td>{formatDate(r.created_at)}</td><td>{r.action}</td><td>{r.description || r.entity_type}</td></tr>)}
        </TableCard>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat-card"><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div></div>;
}

function TableCard({ title, headers, empty, children }: { title: string; headers: string[]; empty: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) && rows.length === 0;
  return (
    <section className="card supervisor-table-card">
      <div className="section-title"><h3>{title}</h3></div>
      <div className="table-wrap">
        <table className="table supervisor-table">
          <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{isEmpty ? <tr><td colSpan={headers.length}>{empty}</td></tr> : children}</tbody>
        </table>
      </div>
    </section>
  );
}
