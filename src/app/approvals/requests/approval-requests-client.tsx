"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCcw, Search, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PaginationBar } from "@/components/pagination-bar";
import type { RequestDetail } from "@/types/database";

type Meta = { page: number; limit: number; total: number; totalPages: number };
type SerialMove = { id: string; serial_number: string; material_id: string; material_code: string; material_nama: string; movement_type: string; from_location_type: string | null; to_location_type: string | null; to_teknisi_nama: string | null; note: string | null; created_at: string };
type RequestItemWithSerials = RequestDetail["items"][number] & { serials?: SerialMove[] };
type RequestDetailWithSerials = Omit<RequestDetail, "items"> & { movements?: SerialMove[]; items: RequestItemWithSerials[] };

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusClass(status: string) { if (status === "APPROVED") return "badge badge-success"; if (status === "REJECTED") return "badge badge-danger"; return "badge badge-warning"; }

export function ApprovalRequestsClient({ initialRequests, initialMeta }: { initialRequests: RequestDetail[]; initialMeta: Meta }) {
  const [requests, setRequests] = useState(initialRequests);
  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<RequestDetailWithSerials | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return requests;
    return requests.filter((r) => [r.request_code, r.teknisi_nama, r.status, r.catatan_teknisi, ...r.items.map((i) => `${i.material_code} ${i.material_nama}`)].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [requests, query]);

  async function refresh(page = meta.page) {
    setLoading(true);
    try {
      const res = await fetch(`/api/requests?page=${page}&limit=${meta.limit}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat request.");
      setRequests(json.data || []);
      setMeta(json.meta || meta);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memuat request."); }
    finally { setLoading(false); }
  }

  async function openDetail(row: RequestDetail) {
    setDetail(row as RequestDetailWithSerials);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/requests/${row.id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat detail request.");
      setDetail(json.data as RequestDetailWithSerials);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memuat detail request."); }
    finally { setDetailLoading(false); }
  }

  async function process(id: string, action: "approve" | "reject") {
    const confirmText = action === "approve" ? "Setujui request ini dan pindahkan stok ke tas teknisi?" : "Tolak request ini?";
    if (!window.confirm(confirmText)) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/requests/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catatan_admin: notes[id] ?? "" }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approval gagal diproses.");
      toast.success(action === "approve" ? "Request berhasil disetujui." : "Request berhasil ditolak.");
      await refresh(meta.page);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Approval gagal diproses."); }
    finally { setLoadingId(""); }
  }

  return <section className="card clean-card-header approval-page-card">
    <div className="section-header"><div className="section-title"><h3>Setujui Permintaan Material</h3><p>Approve akan mengurangi stok gudang dan memasukkan material ke tas teknisi secara atomic.</p></div></div>
    <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari request, teknisi, material..." /></div></div><button className="btn-ghost" onClick={() => void refresh(meta.page)} disabled={loading}><RefreshCcw size={15} /> Refresh</button></div>
    <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Tanggal</th><th>Teknisi</th><th>Material</th><th>Total</th><th>Status</th><th>Catatan Teknisi</th><th>Aksi</th></tr></thead><tbody>{filtered.map((r) => <tr key={r.id}><td><strong>{r.request_code}</strong></td><td>{formatDate(r.created_at)}</td><td>{r.teknisi_nama}</td><td><div className="material-stack">{r.items.map((i) => <span key={i.id}>{i.material_nama} <b>({i.qty_requested})</b></span>)}</div></td><td><strong>{r.total_qty}</strong></td><td><span className={statusClass(r.status)}>{r.status}</span></td><td><span className="plain-note">{r.catatan_teknisi || "-"}</span>{r.status === "PENDING" && <input className="form-control admin-note-input" value={notes[r.id] ?? r.catatan_admin ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Catatan admin saat approve/reject" disabled={loadingId === r.id} />}</td><td>{r.status === "PENDING" ? <div className="action-row"><button className="btn-primary-small" onClick={() => process(r.id, "approve")} disabled={loadingId === r.id}><CheckCircle2 size={14} /> Approve</button><button className="btn-danger-small" onClick={() => process(r.id, "reject")} disabled={loadingId === r.id}><XCircle size={14} /> Reject</button></div> : <button className="btn-primary-small" type="button" onClick={() => void openDetail(r)}><Eye size={14}/> Detail</button>}</td></tr>)}{filtered.length === 0 && <tr><td colSpan={8}><div className="empty-state">Belum ada request material.</div></td></tr>}</tbody></table></div>
    <PaginationBar meta={meta} loading={loading} onPageChange={(page) => void refresh(page)} />
    {detail && <div className="modal-backdrop request-detail-backdrop"><div className="modal approval-detail-modal"><div className="modal-header compact"><div><h3 className="modal-title">Detail Permintaan</h3><div className="modal-subtitle">{detail.request_code} • {detail.teknisi_nama}</div></div><button className="btn-ghost" onClick={() => setDetail(null)}><X size={16}/></button></div><div className="modal-body material-detail-body">{detailLoading ? <div className="empty-state">Memuat detail request...</div> : <><div className="detail-summary-grid compact"><div><span>Status</span><strong>{detail.status}</strong></div><div><span>Total Qty</span><strong>{detail.total_qty}</strong></div><div><span>Tanggal</span><strong>{formatDate(detail.created_at)}</strong></div></div><div className="approval-note-box"><strong>Catatan Teknisi</strong><p>{detail.catatan_teknisi || "-"}</p><strong>Catatan Admin</strong><p>{detail.catatan_admin || "-"}</p></div><div className="table-wrap compact-detail-table"><table><thead><tr><th>Material</th><th>Diminta</th><th>Disetujui</th><th>Status</th><th>Serial Number Diberikan</th></tr></thead><tbody>{detail.items.map((i: RequestItemWithSerials) => <tr key={i.id}><td>{i.material_nama}</td><td>{i.qty_requested}</td><td>{i.qty_approved ?? "-"}</td><td>{i.status}</td><td>{i.serials && i.serials.length > 0 ? <div className="serial-chip-list">{i.serials.map((s) => <span key={s.id}>{s.serial_number}</span>)}</div> : <span className="form-hint">-</span>}</td></tr>)}</tbody></table></div>{detail.movements && detail.movements.length > 0 && <div className="serial-timeline-box"><div className="panel-title">Riwayat Serial pada Request Ini</div>{detail.movements.map((m) => <div className="serial-timeline-row" key={m.id}><strong>{m.serial_number}</strong><span>{m.from_location_type || "-"} → {m.to_location_type || "-"}</span><small>{formatDate(m.created_at)}</small></div>)}</div>}</>}</div></div></div>}
  </section>;
}
