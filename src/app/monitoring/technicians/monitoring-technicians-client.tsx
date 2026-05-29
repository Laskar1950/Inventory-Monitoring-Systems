"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  teknisi_id: string;
  nama: string;
  email: string;
  bag_item_count: number;
  bag_total_qty: number;
  request_count: number;
  usage_count: number;
  return_count: number;
  stock_opname_count: number;
  total_activity: number;
  last_activity_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MonitoringTechniciansClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());
    try {
      const res = await fetch(`/api/monitoring/technicians?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat monitoring teknisi.");
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat monitoring teknisi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const summary = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.total_activity > 0).length,
    bagQty: rows.reduce((sum, r) => sum + Number(r.bag_total_qty || 0), 0),
    so: rows.reduce((sum, r) => sum + Number(r.stock_opname_count || 0), 0),
  }), [rows]);

  return (
    <div className="supervisor-page">
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Stat label="Total Teknisi" value={summary.total} />
        <Stat label="Teknisi Aktif" value={summary.active} />
        <Stat label="Qty di Tas" value={summary.bagQty} />
        <Stat label="Stok Opname" value={summary.so} />
      </div>
      <section className="card supervisor-table-shell">
        <div className="section-header">
          <div className="section-title">
            <h3>Monitoring Teknisi</h3>
            <p>Ringkasan material di tas dan aktivitas request, penggunaan, return, serta stok opname.</p>
          </div>
          <button className="btn-secondary" onClick={() => void loadData()} disabled={loading}>Refresh</button>
        </div>
        {error && <div className="alert-error">{error}</div>}
        <div className="table-toolbar">
          <input className="search-input form-control" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Cari nama atau email teknisi..." />
          <button className="btn-primary" onClick={() => void loadData()} disabled={loading}>Terapkan</button>
        </div>
        <div className="table-wrap">
          <table className="table supervisor-table">
            <thead><tr><th>Teknisi</th><th>Email</th><th>Item Tas</th><th>Qty Tas</th><th>Request</th><th>Usage</th><th>Return</th><th>SO</th><th>Aktivitas Terakhir</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9}>Memuat data...</td></tr> : rows.length === 0 ? <tr><td colSpan={9}>Data teknisi belum tersedia.</td></tr> : rows.map((r) => (
                <tr key={r.teknisi_id}>
                  <td><strong>{r.nama}</strong></td><td>{r.email}</td><td>{r.bag_item_count}</td><td>{r.bag_total_qty}</td><td>{r.request_count}</td><td>{r.usage_count}</td><td>{r.return_count}</td><td>{r.stock_opname_count}</td><td>{formatDate(r.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat-card"><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div></div>;
}
