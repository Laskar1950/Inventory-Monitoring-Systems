"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, X } from "lucide-react";
import { PaginationBar } from "@/components/pagination-bar";
import { TableSkeleton } from "@/components/table-skeleton";
import type { TechnicianBagItem } from "@/types/database";

type StockOpnameSummary = { id: string; so_code: string; teknisi_id: string; teknisi_nama: string; status: string; catatan_teknisi: string | null; reviewed_by_nama: string | null; reviewed_at: string | null; created_at: string; item_count: number; total_system_qty: number; total_physical_qty: number; total_selisih: number; problem_count: number };
type DraftItem = { bag_id: string; material_code: string; material_nama: string; serial_number: string | null; wajib_sn: boolean; qty_system: number; qty_physical: number; kondisi_fisik: string; foto: File | null };
type Meta = { page: number; limit: number; total: number; totalPages: number };

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusLabel(status: string) { return status === "PENDING" ? "Pending Review" : status === "APPROVED" ? "Approved" : status === "REVISION" ? "Revisi" : status === "REJECTED_FINAL" ? "Rejected Final" : status; }
function FilePreview({ file, alt }: { file: File | null; alt: string }) { const [src, setSrc] = useState(""); useEffect(() => { if (!file) { setSrc(""); return; } const url = URL.createObjectURL(file); setSrc(url); return () => URL.revokeObjectURL(url); }, [file]); if (!src) return <span className="muted-text">Belum ada foto</span>; return <img className="upload-preview mini" src={src} alt={alt} />; }

export function StockOpnamesClient() {
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [summaries, setSummaries] = useState<StockOpnameSummary[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [catatanTeknisi, setCatatanTeknisi] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData(page = meta.page) {
    setLoading(true); setError(null);
    try {
      const [bagRes, soRes] = await Promise.all([fetch("/api/technician-bag?limit=100", { cache: "no-store" }), fetch(`/api/stock-opnames?page=${page}&limit=${meta.limit}`, { cache: "no-store" })]);
      const bagJson = await bagRes.json(); const soJson = await soRes.json();
      if (!bagRes.ok) throw new Error(bagJson.error || "Gagal memuat tas teknisi.");
      if (!soRes.ok) throw new Error(soJson.error || "Gagal memuat stok opname.");
      const activeBags = (bagJson.data || []).filter((item: TechnicianBagItem) => item.status === "ACTIVE" && item.qty > 0);
      setDraftItems(activeBags.map((item: TechnicianBagItem) => ({ bag_id: item.id, material_code: item.material_code, material_nama: item.material_nama, serial_number: item.serial_number, wajib_sn: item.wajib_sn, qty_system: item.qty, qty_physical: item.qty, kondisi_fisik: item.kondisi || "BAIK", foto: null })));
      setSummaries(soJson.data || []); setMeta(soJson.meta || meta);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(1); }, []);

  const totals = useMemo(() => draftItems.reduce((acc, item) => { acc.system += item.qty_system; acc.physical += Number(item.qty_physical) || 0; acc.diff += (Number(item.qty_physical) || 0) - item.qty_system; return acc; }, { system: 0, physical: 0, diff: 0 }), [draftItems]);
  function updateItem(bagId: string, patch: Partial<DraftItem>) { setDraftItems((prev) => prev.map((item) => item.bag_id === bagId ? { ...item, ...patch } : item)); }

  async function submitStockOpname(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null);
    if (draftItems.length === 0) return setError("Minimal harus ada satu item stok opname.");
    for (const item of draftItems) {
      if (!Number.isFinite(Number(item.qty_physical)) || Number(item.qty_physical) < 0) return setError("Qty fisik wajib angka dan tidak boleh negatif.");
      if (item.wajib_sn && ![0, 1].includes(Number(item.qty_physical))) return setError(`Qty fisik material berserial ${item.material_code} harus 0 atau 1.`);
      if (!item.kondisi_fisik) return setError("Kondisi fisik wajib dipilih untuk setiap item.");
      if (!item.foto) return setError(`Foto bukti wajib untuk material ${item.material_nama}.`);
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("catatan_teknisi", catatanTeknisi);
      formData.append("items", JSON.stringify(draftItems.map((item, index) => ({ bag_id: item.bag_id, qty_physical: Number(item.qty_physical), kondisi_fisik: item.kondisi_fisik, file_key: `foto_${index}` }))));
      draftItems.forEach((item, index) => { if (item.foto) formData.append(`foto_${index}`, item.foto); });
      const response = await fetch("/api/stock-opnames", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal mengirim stok opname.");
      setMessage(json.message || "Laporan stok opname berhasil dikirim."); setCatatanTeknisi(""); setFormOpen(false); await loadData(1);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal mengirim stok opname."); }
    finally { setSubmitting(false); }
  }

  return <div className="page-grid">
    <section className="card"><div className="section-header"><div className="section-title"><h3>Riwayat Stok Opname</h3><p>Status laporan akan berubah setelah Admin Gudang menyelesaikan review.</p></div><div className="action-row"><button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={16}/> Tambah Stok Opname</button><button className="btn-secondary" type="button" onClick={() => void loadData(meta.page)} disabled={loading || submitting}><RefreshCcw size={15}/> Refresh</button></div></div>{message && <div className="alert-success">{message}</div>}{error && <div className="alert-error">{error}</div>}<div className="table-wrap"><table className="table"><thead><tr><th>Kode</th><th>Tanggal</th><th>Status</th><th>Item</th><th>Qty Sistem</th><th>Qty Fisik</th><th>Selisih</th></tr></thead><tbody>{loading ? <TableSkeleton rows={6} columns={7} /> : summaries.length === 0 ? <tr><td colSpan={7}>Belum ada stok opname.</td></tr> : summaries.map((row) => <tr key={row.id}><td><strong>{row.so_code}</strong></td><td>{formatDate(row.created_at)}</td><td><span className={`badge ${row.status === "APPROVED" ? "success" : row.status === "PENDING" ? "warning" : "danger"}`}>{statusLabel(row.status)}</span></td><td>{row.item_count}</td><td>{row.total_system_qty}</td><td>{row.total_physical_qty}</td><td>{row.total_selisih}</td></tr>)}</tbody></table></div><PaginationBar meta={meta} loading={loading} onPageChange={(page) => void loadData(page)} /></section>
    {formOpen && <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><h3 className="modal-title">Tambah Stok Opname</h3><div className="modal-subtitle">Periksa qty fisik, kondisi, dan upload foto bukti untuk setiap material di Tas Saya.</div></div><button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}><X size={16}/> Tutup</button></div><form onSubmit={submitStockOpname} className="form-stack"><div className="modal-body"><div className="stat-grid three"><div className="stat-card mini"><span>Qty Sistem</span><strong>{totals.system}</strong></div><div className="stat-card mini"><span>Qty Fisik</span><strong>{totals.physical}</strong></div><div className="stat-card mini"><span>Selisih</span><strong>{totals.diff}</strong></div></div><label><span>Catatan Umum</span><textarea value={catatanTeknisi} onChange={(e) => setCatatanTeknisi(e.target.value)} rows={2} placeholder="Catatan tambahan jika ada" /></label><div className="table-wrap"><table className="table compact"><thead><tr><th>Material</th><th>Serial Number</th><th>Qty Sistem</th><th>Qty Fisik</th><th>Kondisi Fisik</th><th>Foto Bukti</th><th>Preview</th><th>Selisih</th></tr></thead><tbody>{loading ? <TableSkeleton rows={4} columns={8} /> : draftItems.length === 0 ? <tr><td colSpan={8}>Tas teknisi kosong. Tidak ada item untuk stok opname.</td></tr> : draftItems.map((item, index) => <tr key={item.bag_id}><td><strong>{item.material_nama}</strong><br /><span className="muted-text">{item.material_code}</span></td><td>{item.serial_number || "-"}</td><td>{item.qty_system}</td><td><input type="number" min={0} max={item.wajib_sn ? 1 : undefined} value={item.qty_physical} onChange={(e) => updateItem(item.bag_id, { qty_physical: Number(e.target.value) })} className="table-input" /></td><td><select value={item.kondisi_fisik} onChange={(e) => updateItem(item.bag_id, { kondisi_fisik: e.target.value })} className="table-input"><option value="BAIK">Baik</option><option value="RUSAK">Rusak</option><option value="HILANG">Hilang</option><option value="PERLU CEK">Perlu Cek</option></select></td><td><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => updateItem(item.bag_id, { foto: e.target.files?.[0] ?? null })} aria-label={`Foto bukti ${index + 1}`} /></td><td><FilePreview file={item.foto} alt={`Preview ${item.material_nama}`} /></td><td>{Number(item.qty_physical) - item.qty_system}</td></tr>)}</tbody></table></div></div><div className="modal-footer"><button className="btn-primary" type="submit" disabled={loading || submitting || draftItems.length === 0}>{submitting ? "Mengirim stok opname..." : "Kirim Laporan SO"}</button></div></form></div></div>}
  </div>;
}
