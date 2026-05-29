"use client";

import { useEffect, useMemo, useState } from "react";

type StockOpnameSummary = { id: string; so_code: string; teknisi_nama: string; status: string; catatan_teknisi: string | null; created_at: string; item_count: number; total_system_qty: number; total_physical_qty: number; total_selisih: number; problem_count: number };
type StockOpnameItem = { id: string; stock_opname_id: string; material_code: string; material_nama: string; merk: string; satuan: string; wajib_sn: boolean; serial_number: string | null; qty_system: number; qty_physical: number; selisih: number; kondisi_fisik: string; foto_url: string; status_review: "PENDING" | "APPROVED" | "REVISION" | "REJECTED_FINAL"; catatan_admin: string | null };
type ReviewState = Record<string, { status_review: "APPROVED" | "REVISION" | "REJECTED_FINAL"; catatan_admin: string }>;

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusLabel(status: string) { return status === "PENDING" ? "Pending Review" : status === "APPROVED" ? "Approved" : status === "REVISION" ? "Revisi" : status === "REJECTED_FINAL" ? "Rejected Final" : status; }

export function ApprovalStockOpnamesClient() {
  const [summaries, setSummaries] = useState<StockOpnameSummary[]>([]);
  const [items, setItems] = useState<StockOpnameItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/stock-opnames");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal memuat stok opname.");
      setSummaries(json.data || []); setItems(json.items || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat stok opname."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(); }, []);
  const selectedSummary = useMemo(() => summaries.find((row) => row.id === selectedId) || null, [summaries, selectedId]);
  const selectedItems = useMemo(() => items.filter((item) => item.stock_opname_id === selectedId), [items, selectedId]);

  function openReview(summary: StockOpnameSummary) {
    const initial: ReviewState = {};
    for (const item of items.filter((item) => item.stock_opname_id === summary.id)) initial[item.id] = { status_review: item.status_review === "APPROVED" || item.status_review === "REVISION" || item.status_review === "REJECTED_FINAL" ? item.status_review : "APPROVED", catatan_admin: item.catatan_admin || "" };
    setSelectedId(summary.id); setReviews(initial); setMessage(null); setError(null);
  }
  function updateReview(itemId: string, patch: Partial<ReviewState[string]>) { setReviews((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } })); }

  async function submitReview() {
    if (!selectedSummary) return;
    setError(null); setMessage(null);
    const payload = selectedItems.map((item) => ({ item_id: item.id, status_review: reviews[item.id]?.status_review || "APPROVED", catatan_admin: reviews[item.id]?.catatan_admin || null }));
    for (const item of payload) if ((item.status_review === "REVISION" || item.status_review === "REJECTED_FINAL") && !item.catatan_admin?.trim()) { setError("Catatan admin wajib untuk item berstatus Revisi atau Rejected Final."); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/stock-opnames/${selectedSummary.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviews: payload }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal menyimpan review stok opname.");
      setMessage(json.message || "Review stok opname berhasil disimpan."); setSelectedId(null); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal menyimpan review stok opname."); }
    finally { setSubmitting(false); }
  }

  return <div className="page-grid">
    <section className="card">
      <div className="section-header"><div className="section-title"><h3>Setujui Stok Opname</h3><p>Review laporan stok opname teknisi per item, lalu tentukan status akhir.</p></div><button className="btn-secondary" type="button" onClick={() => void loadData()} disabled={loading || submitting}>Refresh</button></div>
      {message && <div className="alert-success">{message}</div>}{error && <div className="alert-error">{error}</div>}
      <div className="table-wrap"><table className="table"><thead><tr><th>Kode SO</th><th>Tanggal</th><th>Teknisi</th><th>Status</th><th>Item</th><th>Selisih</th><th>Problem</th><th>Aksi</th></tr></thead><tbody>{loading ? <tr><td colSpan={8}>Memuat data...</td></tr> : summaries.length === 0 ? <tr><td colSpan={8}>Belum ada stok opname.</td></tr> : summaries.map((row) => <tr key={row.id}><td><strong>{row.so_code}</strong></td><td>{formatDate(row.created_at)}</td><td>{row.teknisi_nama}</td><td><span className={`badge ${row.status === "APPROVED" ? "success" : row.status === "PENDING" ? "warning" : "danger"}`}>{statusLabel(row.status)}</span></td><td>{row.item_count}</td><td>{row.total_selisih}</td><td>{row.problem_count}</td><td><button className="btn-primary-small" type="button" onClick={() => openReview(row)}>{row.status === "PENDING" ? "Review" : "Detail"}</button></td></tr>)}</tbody></table></div>
    </section>
    {selectedSummary && <section className="card"><div className="section-header"><div className="section-title"><h3>Detail {selectedSummary.so_code}</h3><p>Teknisi: {selectedSummary.teknisi_nama}. Catatan: {selectedSummary.catatan_teknisi || "-"}</p></div><button className="btn-secondary" type="button" onClick={() => setSelectedId(null)} disabled={submitting}>Tutup</button></div><div className="table-wrap"><table className="table compact"><thead><tr><th>Material</th><th>Serial Number</th><th>Qty Sistem</th><th>Qty Fisik</th><th>Selisih</th><th>Kondisi</th><th>Foto</th><th>Status Review</th><th>Catatan Admin</th></tr></thead><tbody>{selectedItems.map((item) => <tr key={item.id}><td><strong>{item.material_code}</strong><br /><span className="muted-text">{item.material_nama}</span></td><td>{item.serial_number || "-"}</td><td>{item.qty_system}</td><td>{item.qty_physical}</td><td>{item.selisih}</td><td>{item.kondisi_fisik}</td><td><span className="muted-text">{item.foto_url}</span></td><td><select className="table-input" value={reviews[item.id]?.status_review || "APPROVED"} onChange={(e) => updateReview(item.id, { status_review: e.target.value as ReviewState[string]["status_review"] })} disabled={selectedSummary.status !== "PENDING" || submitting}><option value="APPROVED">Approved</option><option value="REVISION">Revisi</option><option value="REJECTED_FINAL">Rejected Final</option></select></td><td><input className="table-input" value={reviews[item.id]?.catatan_admin || ""} onChange={(e) => updateReview(item.id, { catatan_admin: e.target.value })} placeholder="Wajib untuk Revisi/Rejected" disabled={selectedSummary.status !== "PENDING" || submitting} /></td></tr>)}</tbody></table></div>{selectedSummary.status === "PENDING" && <button className="btn-primary" type="button" onClick={() => void submitReview()} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Review"}</button>}</section>}
  </div>;
}
