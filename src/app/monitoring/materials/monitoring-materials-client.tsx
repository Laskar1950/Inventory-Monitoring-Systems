"use client";

import { useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/pagination-bar";
import { TableSkeleton } from "@/components/table-skeleton";

type Row = { material_id: string; material_code: string; nama: string; merk: string; satuan: string; wajib_sn: boolean; min_stock: number; stock_gudang: number; stock_teknisi: number; total_stock: number; serial_available: number; serial_in_bag: number; serial_used: number; stock_status: "AMAN" | "RENDAH" | "KRITIS" };
type Meta = { page: number; limit: number; total: number; totalPages: number };

export function MonitoringMaterialsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData(page = meta.page) {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (status !== "ALL") params.set("status", status);
    params.set("page", String(page)); params.set("limit", String(meta.limit));
    try {
      const res = await fetch(`/api/monitoring/materials?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat monitoring material.");
      setRows(json.data || []); setMeta(json.meta || meta);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat monitoring material."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(1); }, []);

  const summary = useMemo(() => ({ total: meta.total, low: rows.filter((r) => r.stock_status === "RENDAH").length, critical: rows.filter((r) => r.stock_status === "KRITIS").length, technicianStock: rows.reduce((sum, r) => sum + Number(r.stock_teknisi || 0), 0) }), [rows, meta.total]);

  return <div className="supervisor-page">
    <div className="grid grid-4" style={{ marginBottom: 14 }}><Stat label="Total Material" value={summary.total} /><Stat label="Stok Rendah" value={summary.low} /><Stat label="Stok Kritis" value={summary.critical} /><Stat label="Stok di Teknisi" value={summary.technicianStock} /></div>
    <section className="card supervisor-table-shell"><div className="section-header"><div className="section-title"><h3>Monitoring Material</h3><p>Memantau stok gudang, stok teknisi, serial number, dan status minimum stok.</p></div><button className="btn-secondary" onClick={() => void loadData(meta.page)} disabled={loading}>Refresh</button></div>
      {error && <div className="alert-error">{error}</div>}
      <div className="table-toolbar"><input className="search-input form-control" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Cari kode, nama, merk..." /><select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}><option value="ALL">Semua Status</option><option value="AMAN">Aman</option><option value="RENDAH">Rendah</option><option value="KRITIS">Kritis</option></select><button className="btn-primary" onClick={() => void loadData(1)} disabled={loading}>Terapkan</button></div>
      <div className="table-wrap"><table className="table supervisor-table"><thead><tr><th>Kode</th><th>Material</th><th>Merk</th><th>Gudang</th><th>Teknisi</th><th>Total</th><th>SN</th><th>Status</th></tr></thead><tbody>{loading ? <TableSkeleton rows={6} columns={8} /> : rows.length === 0 ? <tr><td colSpan={8}>Data material belum tersedia.</td></tr> : rows.map((r) => <tr key={r.material_id}><td><strong>{r.material_code}</strong></td><td>{r.nama}</td><td>{r.merk}</td><td>{r.stock_gudang}</td><td>{r.stock_teknisi}</td><td>{r.total_stock}</td><td>{r.wajib_sn ? `${r.serial_available} tersedia / ${r.serial_in_bag} di tas / ${r.serial_used} terpakai` : "Non-SN"}</td><td><span className={`badge ${r.stock_status === "AMAN" ? "badge-success" : r.stock_status === "RENDAH" ? "badge-warning" : "badge-danger"}`}>{r.stock_status}</span></td></tr>)}</tbody></table></div>
      <PaginationBar meta={meta} loading={loading} onPageChange={(page) => void loadData(page)} />
    </section>
  </div>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="stat-card"><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div></div>; }
