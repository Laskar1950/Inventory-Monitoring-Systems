"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  material_id: string;
  material_code: string;
  nama: string;
  merk: string;
  satuan: string;
  wajib_sn: boolean;
  min_stock: number;
  stock_gudang: number;
  stock_teknisi: number;
  total_stock: number;
  serial_available: number;
  serial_in_bag: number;
  serial_used: number;
  stock_status: "AMAN" | "RENDAH" | "KRITIS";
};

export function MonitoringMaterialsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (status !== "ALL") params.set("status", status);
    try {
      const res = await fetch(`/api/monitoring/materials?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat monitoring material.");
      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat monitoring material.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const summary = useMemo(() => ({
    total: rows.length,
    low: rows.filter((r) => r.stock_status === "RENDAH").length,
    critical: rows.filter((r) => r.stock_status === "KRITIS").length,
    technicianStock: rows.reduce((sum, r) => sum + Number(r.stock_teknisi || 0), 0),
  }), [rows]);

  return (
    <div className="supervisor-page">
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Stat label="Total Material" value={summary.total} />
        <Stat label="Stok Rendah" value={summary.low} />
        <Stat label="Stok Kritis" value={summary.critical} />
        <Stat label="Stok di Teknisi" value={summary.technicianStock} />
      </div>
      <section className="card supervisor-table-shell">
        <div className="section-header">
          <div className="section-title">
            <h3>Monitoring Material</h3>
            <p>Memantau stok gudang, stok teknisi, serial number, dan status minimum stok.</p>
          </div>
          <button className="btn-secondary" onClick={() => void loadData()} disabled={loading}>Refresh</button>
        </div>
        {error && <div className="alert-error">{error}</div>}
        <div className="table-toolbar">
          <input className="search-input form-control" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Cari kode, nama, merk..." />
          <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="ALL">Semua Status</option>
            <option value="AMAN">Aman</option>
            <option value="RENDAH">Rendah</option>
            <option value="KRITIS">Kritis</option>
          </select>
          <button className="btn-primary" onClick={() => void loadData()} disabled={loading}>Terapkan</button>
        </div>
        <div className="table-wrap">
          <table className="table supervisor-table">
            <thead><tr><th>Kode</th><th>Material</th><th>Merk</th><th>Gudang</th><th>Teknisi</th><th>Total</th><th>SN</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8}>Memuat data...</td></tr> : rows.length === 0 ? <tr><td colSpan={8}>Data material belum tersedia.</td></tr> : rows.map((r) => (
                <tr key={r.material_id}>
                  <td><strong>{r.material_code}</strong></td><td>{r.nama}</td><td>{r.merk}</td><td>{r.stock_gudang}</td><td>{r.stock_teknisi}</td><td>{r.total_stock}</td>
                  <td>{r.wajib_sn ? `${r.serial_available} tersedia / ${r.serial_in_bag} di tas / ${r.serial_used} terpakai` : "Non-SN"}</td>
                  <td><span className={`badge ${r.stock_status === "AMAN" ? "badge-success" : r.stock_status === "RENDAH" ? "badge-warning" : "badge-danger"}`}>{r.stock_status}</span></td>
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
