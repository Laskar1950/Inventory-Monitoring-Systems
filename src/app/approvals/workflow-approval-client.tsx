"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCcw, Search, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PaginationBar } from "@/components/pagination-bar";
import type { RequestDetail } from "@/types/database";

type Mode = "LEADER" | "KOORDINATOR" | "SUPERVISOR";
type Meta = { page: number; limit: number; total: number; totalPages: number };

const config = {
  LEADER: {
    title: "Approval Request Leader",
    desc: "Leader melakukan review awal request teknisi sebelum diproses Admin Gudang.",
    actionStatus: "PENDING",
    approveLabel: "Approve Leader",
    rejectLabel: "Reject",
    approvePath: "leader-approve",
    rejectPath: "leader-reject",
    notePlaceholder: "Catatan leader",
    success: "Request berhasil disetujui Leader.",
  },
  KOORDINATOR: {
    title: "Tanda Tangan Surat Jalan",
    desc: "Koordinator menandatangani surat jalan yang sudah diproses Admin Gudang.",
    actionStatus: "WAITING_SIGNATURE",
    approveLabel: "Tanda Tangani",
    approvePath: "koordinator-sign",
    notePlaceholder: "Catatan opsional",
    success: "Surat jalan berhasil ditandatangani Koordinator.",
  },
  SUPERVISOR: {
    title: "Approval Final Surat Jalan",
    desc: "Supervisor melakukan approval final. Setelah final, material keluar dari gudang dan masuk ke tas teknisi.",
    actionStatus: "KOORDINATOR_SIGNED",
    approveLabel: "Approve Final",
    approvePath: "supervisor-approve",
    notePlaceholder: "Catatan opsional",
    success: "Surat jalan berhasil di-approve final.",
  },
} satisfies Record<Mode, any>;

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusText(status: string) { return status === "PENDING" ? "Menunggu Leader" : status === "LEADER_APPROVED" ? "Menunggu Admin" : status === "WAITING_SIGNATURE" ? "Menunggu Koordinator" : status === "KOORDINATOR_SIGNED" ? "Menunggu Supervisor" : status; }
function statusClass(status: string) { if (status === "APPROVED") return "badge badge-success"; if (status === "REJECTED") return "badge badge-danger"; return "badge badge-warning"; }

export function WorkflowApprovalClient({ mode, initialRequests, initialMeta }: { mode: Mode; initialRequests: RequestDetail[]; initialMeta: Meta }) {
  const cfg = config[mode];
  const [requests, setRequests] = useState(initialRequests);
  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<RequestDetail | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return requests;
    return requests.filter((r) => [r.request_code, r.teknisi_nama, r.status, r.surat_jalan_number, r.catatan_teknisi, ...r.items.map((i) => `${i.material_code} ${i.material_nama}`)].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [requests, query]);

  async function refresh(page = meta.page) {
    setLoading(true);
    try {
      const res = await fetch(`/api/requests?page=${page}&limit=${meta.limit}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data.");
      setRequests((json.data || []).filter((row: RequestDetail) => row.status === cfg.actionStatus || row.status !== "PENDING"));
      setMeta(json.meta || meta);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  }

  async function runAction(row: RequestDetail, action: "approve" | "reject") {
    const path = action === "reject" ? cfg.rejectPath : cfg.approvePath;
    if (!path) return;
    const note = notes[row.id] ?? "";
    if (action === "reject" && !note.trim()) return toast.error("Catatan wajib diisi saat menolak request.");
    const confirmText = action === "reject" ? `Tolak request ${row.request_code}?` : `${cfg.approveLabel} untuk ${row.request_code}?`;
    if (!window.confirm(confirmText)) return;
    setLoadingId(row.id);
    try {
      const body = mode === "LEADER" ? { catatan: note } : { signature_url: null, catatan: note };
      const res = await fetch(`/api/requests/${row.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Aksi gagal diproses.");
      toast.success(json.message || cfg.success);
      await refresh(meta.page);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Aksi gagal diproses."); }
    finally { setLoadingId(""); }
  }

  return <section className="card clean-card-header approval-page-card">
    <div className="section-header"><div className="section-title"><h3>{cfg.title}</h3><p>{cfg.desc}</p></div></div>
    <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari request, teknisi, surat jalan..." /></div></div><button className="btn-ghost" onClick={() => void refresh(meta.page)} disabled={loading}><RefreshCcw size={15}/> Refresh</button></div>
    <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Surat Jalan</th><th>Tanggal</th><th>Teknisi</th><th>Material</th><th>Total</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>{filtered.map((r) => { const actionable = r.status === cfg.actionStatus; return <tr key={r.id}><td><strong>{r.request_code}</strong></td><td>{r.surat_jalan_number || "-"}</td><td>{formatDate(r.created_at)}</td><td>{r.teknisi_nama}</td><td><div className="material-stack">{r.items.map((i) => <span key={i.id}>{i.material_nama} <b>({i.qty_requested})</b></span>)}</div></td><td><strong>{r.total_qty}</strong></td><td><span className={statusClass(r.status)}>{statusText(r.status)}</span></td><td>{actionable ? <input className="form-control admin-note-input" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder={cfg.notePlaceholder} disabled={loadingId === r.id} /> : <span className="plain-note">{r.catatan_admin || r.leader_catatan || "-"}</span>}</td><td>{actionable ? <div className="action-row"><button className="btn-primary-small" onClick={() => void runAction(r, "approve")} disabled={loadingId === r.id}><CheckCircle2 size={14}/> {cfg.approveLabel}</button>{mode === "LEADER" && <button className="btn-danger-small" onClick={() => void runAction(r, "reject")} disabled={loadingId === r.id}><XCircle size={14}/> {cfg.rejectLabel}</button>}</div> : <button className="btn-primary-small" type="button" onClick={() => setDetail(r)}><Eye size={14}/> Detail</button>}</td></tr>; })}{filtered.length === 0 && <tr><td colSpan={9}><div className="empty-state">Belum ada data untuk diproses.</div></td></tr>}</tbody></table></div>
    <PaginationBar meta={meta} loading={loading} onPageChange={(page) => void refresh(page)} />
    {detail && <div className="modal-backdrop request-detail-backdrop"><div className="modal approval-detail-modal"><div className="modal-header compact"><div><h3 className="modal-title">Detail Request</h3><div className="modal-subtitle">{detail.request_code} • {detail.surat_jalan_number || "Belum ada Surat Jalan"}</div></div><button className="btn-ghost" onClick={() => setDetail(null)}><X size={16}/></button></div><div className="modal-body material-detail-body"><div className="detail-summary-grid compact"><div><span>Status</span><strong>{statusText(detail.status)}</strong></div><div><span>Total Qty</span><strong>{detail.total_qty}</strong></div><div><span>Teknisi</span><strong>{detail.teknisi_nama}</strong></div></div><div className="approval-note-box"><strong>Basecamp</strong><p>{detail.basecamp || "-"}</p><strong>Referensi Pekerjaan</strong><p>{detail.referensi_pekerjaan || "-"}</p><strong>Catatan Teknisi</strong><p>{detail.catatan_teknisi || "-"}</p><strong>Catatan Leader</strong><p>{detail.leader_catatan || "-"}</p><strong>Catatan Admin</strong><p>{detail.catatan_admin || "-"}</p></div><div className="table-wrap compact-detail-table"><table><thead><tr><th>Material</th><th>Diminta</th><th>Disetujui</th><th>Status</th></tr></thead><tbody>{detail.items.map((i) => <tr key={i.id}><td>{i.material_nama}</td><td>{i.qty_requested}</td><td>{i.qty_approved ?? "-"}</td><td>{i.status}</td></tr>)}</tbody></table></div></div></div></div>}
  </section>;
}
