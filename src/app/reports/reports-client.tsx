"use client";

import { useEffect, useMemo, useState } from "react";

type UsageSummary = {
  id: string;
  usage_code: string;
  teknisi_id: string;
  teknisi_nama: string;
  no_tiket: string;
  nama_pelanggan: string | null;
  id_pelanggan: string | null;
  alamat: string | null;
  root_cause: string | null;
  foto_url: string;
  created_at: string;
  item_count: number;
  total_qty: number;
  materials_used: string | null;
};

type Technician = { teknisi_id: string; nama: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ReportsClient() {
  const [data, setData] = useState<UsageSummary[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teknisiId, setTeknisiId] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function buildParams() {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (teknisiId !== "ALL") params.set("teknisi_id", teknisiId);
    return params;
  }

  async function loadTechnicians() {
    try {
      const res = await fetch("/api/monitoring/technicians");
      if (!res.ok) return;
      const json = await res.json();
      setTechnicians(json.data || []);
    } catch {
      setTechnicians([]);
    }
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (startDate && endDate && startDate > endDate) throw new Error("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
      const res = await fetch(`/api/reports/preview?${buildParams().toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat preview laporan.");
      setData(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat preview laporan.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (data.length === 0) {
      setError("Preview laporan kosong, export dibatalkan.");
      return;
    }
    window.location.href = `/api/reports/export?${buildParams().toString()}`;
  }

  useEffect(() => {
    void loadTechnicians();
    void loadData();
  }, []);

  const totalQty = useMemo(() => data.reduce((sum, row) => sum + Number(row.total_qty || 0), 0), [data]);
  const uniqueTechnicians = useMemo(() => new Set(data.map((r) => r.teknisi_id)).size, [data]);

  return (
    <section className="card supervisor-report-preview-full">
      <div className="section-header">
        <div className="section-title">
          <h3>Laporan dan Export Pemakaian Material</h3>
          <p>Preview laporan harus memiliki data sebelum export. Filter divalidasi di frontend dan backend.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={() => void loadData()} disabled={loading}>Refresh</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="report-filter-panel" style={{ marginBottom: 14 }}>
        <div className="report-filter-grid supervisor-report-filter-grid">
          <div><label className="form-label">Keyword</label><input className="form-control" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tiket, teknisi, pelanggan, material..." /></div>
          <div><label className="form-label">Tanggal Mulai</label><input className="form-control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><label className="form-label">Tanggal Akhir</label><input className="form-control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div><label className="form-label">Teknisi</label><select className="form-control" value={teknisiId} onChange={(e) => setTeknisiId(e.target.value)}><option value="ALL">Semua Teknisi</option>{technicians.map((t) => <option key={t.teknisi_id} value={t.teknisi_id}>{t.nama}</option>)}</select></div>
          <div className="report-action-row"><button className="btn-primary" type="button" onClick={() => void loadData()} disabled={loading}>Preview</button><button className="btn-secondary" type="button" onClick={exportCsv} disabled={loading || data.length === 0}>Export CSV</button></div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <div className="stat-card"><div><div className="stat-label">Total Laporan</div><div className="stat-value">{data.length}</div></div></div>
        <div className="stat-card"><div><div className="stat-label">Total Qty</div><div className="stat-value">{totalQty}</div></div></div>
        <div className="stat-card"><div><div className="stat-label">Teknisi Terlibat</div><div className="stat-value">{uniqueTechnicians}</div></div></div>
        <div className="stat-card"><div><div className="stat-label">Status Export</div><div className="stat-value" style={{ fontSize: "1.1rem" }}>{data.length > 0 ? "Siap" : "Kosong"}</div></div></div>
      </div>

      <div className="table-wrap">
        <table className="table supervisor-report-table">
          <thead><tr><th>Kode</th><th>Tanggal</th><th>Teknisi</th><th>Tiket</th><th>Pelanggan</th><th>Qty</th><th>Material</th><th>Root Cause</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}>Memuat data...</td></tr> : data.length === 0 ? <tr><td colSpan={8}>Preview laporan kosong.</td></tr> : data.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.usage_code}</strong></td><td>{formatDate(row.created_at)}</td><td>{row.teknisi_nama}</td><td>{row.no_tiket}</td><td>{row.nama_pelanggan || "-"}</td><td>{row.total_qty}</td><td>{row.materials_used || `${row.item_count} item`}</td><td>{row.root_cause || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
