"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Eye, FileText, RefreshCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaginationBar } from "@/components/pagination-bar";
import { ViewportModal } from "@/components/viewport-modal";
import type { RequestDetail } from "@/types/database";

type Mode = "LEADER" | "KOORDINATOR" | "SUPERVISOR";
type Meta = { page: number; limit: number; total: number; totalPages: number };
type PendingAction = { row: RequestDetail; action: "approve" } | null;
type WorkflowConfig = { title: string; desc: string; actionStatus: string; approveLabel: string; approvePath: string; notePlaceholder: string; success: string };
type SerialMove = { id: string; serial_number: string; material_id: string; material_code: string; material_nama: string; movement_type: string; from_location_type: string | null; to_location_type: string | null; to_teknisi_nama: string | null; note: string | null; created_at: string };
type SelectedSerial = { id: string; serial_number_id: string; serial_number: string; request_item_id: string; material_id: string; serial_status?: string; location_type?: string; kondisi?: string | null };
type RequestItemWithSerials = RequestDetail["items"][number] & { serials?: SerialMove[]; selected_serials?: SelectedSerial[] };
type RequestDetailWithSerials = Omit<RequestDetail, "items"> & { movements?: SerialMove[]; selected_serials?: SelectedSerial[]; items: RequestItemWithSerials[] };

const config: Record<Mode, WorkflowConfig> = {
  LEADER: { title: "Approval Request Leader", desc: "Leader melakukan review awal request teknisi sebelum masuk ke Koordinator Mitra.", actionStatus: "PENDING", approveLabel: "Approve", approvePath: "leader-approve", notePlaceholder: "Catatan leader", success: "Request berhasil disetujui Leader." },
  KOORDINATOR: { title: "Approval Koordinator Mitra", desc: "Koordinator Mitra menyetujui request dari teknisi mitra setelah Leader approve.", actionStatus: "LEADER_APPROVED", approveLabel: "Approve", approvePath: "koordinator-sign", notePlaceholder: "Catatan koordinator", success: "Request berhasil di-approve Koordinator." },
  SUPERVISOR: { title: "Approval Supervisor", desc: "Supervisor menyetujui request setelah Koordinator Mitra. Setelah ini request masuk ke Admin Gudang untuk proses Surat Jalan.", actionStatus: "KOORDINATOR_SIGNED", approveLabel: "Approve", approvePath: "supervisor-approve", notePlaceholder: "Catatan supervisor", success: "Request berhasil di-approve Supervisor." },
};

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusText(status: string) { return status === "PENDING" ? "Menunggu Leader" : status === "LEADER_APPROVED" ? "Menunggu Koordinator" : status === "KOORDINATOR_SIGNED" ? "Menunggu Supervisor" : status === "WAITING_SIGNATURE" ? "Menunggu Admin Gudang" : status === "APPROVED" ? "Siap Diterima Teknisi" : status === "COMPLETED" ? "Selesai" : status; }
function statusClass(status: string) { if (["APPROVED", "COMPLETED"].includes(status)) return "badge badge-success"; if (status === "REJECTED") return "badge badge-danger"; return "badge badge-warning"; }
function itemNames(items: RequestDetail["items"]) { return items.map((i) => i.material_nama).join(", "); }
function selectedSerials(item: RequestItemWithSerials) { return item.serials && item.serials.length > 0 ? item.serials.map((s) => ({ id: s.id, serial_number: s.serial_number })) : (item.selected_serials || []).map((s) => ({ id: s.id, serial_number: s.serial_number })); }

export function WorkflowApprovalClient({ mode, initialRequests, initialMeta }: { mode: Mode; initialRequests: RequestDetail[]; initialMeta: Meta }) {
  const cfg = config[mode];
  const [requests, setRequests] = useState(initialRequests);
  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<RequestDetailWithSerials | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return requests;
    return requests.filter((r) => [r.request_code, r.teknisi_nama, r.status, r.surat_jalan_number, r.catatan_teknisi, r.basecamp, r.referensi_pekerjaan, ...r.items.map((i) => `${i.material_code} ${i.material_nama}`)].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [requests, query]);

  async function refresh(page = meta.page) {
    setLoading(true);
    try {
      const res = await fetch(`/api/requests?page=${page}&limit=${meta.limit}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data.");
      setRequests(json.data || []);
      setMeta(json.meta || meta);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memuat data."); }
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

  function askAction(row: RequestDetail) { setPendingAction({ row, action: "approve" }); }

  async function executeAction() {
    if (!pendingAction) return;
    const { row } = pendingAction;
    const note = notes[row.id] ?? "";
    setLoadingId(row.id);
    try {
      const body = mode === "LEADER" ? { catatan: note } : { signature_url: null, catatan: note };
      const res = await fetch(`/api/requests/${row.id}/${cfg.approvePath}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Aksi gagal diproses.");
      toast.success(json.message || cfg.success);
      setPendingAction(null);
      await refresh(meta.page);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Aksi gagal diproses."); }
    finally { setLoadingId(""); }
  }

  return <section className="card clean-card-header approval-page-card">
    <div className="section-header"><div className="section-title"><h3>{cfg.title}</h3><p>{cfg.desc}</p></div></div>
    <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari request, teknisi, material, basecamp, project..." /></div></div><button className="btn-ghost" onClick={() => void refresh(meta.page)} disabled={loading}><RefreshCcw size={15}/> Refresh</button></div>
    <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Surat Jalan</th><th>Tanggal</th><th>Teknisi</th><th>Basecamp</th><th>Referensi</th><th>Material</th><th>Total</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>{filtered.map((r) => { const actionable = r.status === cfg.actionStatus; return <tr key={r.id}><td><strong>{r.request_code}</strong></td><td>{r.surat_jalan_number || "-"}</td><td>{formatDate(r.created_at)}</td><td>{r.teknisi_nama}</td><td>{r.basecamp || "-"}</td><td>{r.referensi_pekerjaan || "-"}</td><td><div className="material-stack"><span>{itemNames(r.items)}</span></div></td><td><strong>{r.total_qty}</strong></td><td><span className={statusClass(r.status)}>{statusText(r.status)}</span></td><td>{actionable ? <input className="form-control admin-note-input" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder={cfg.notePlaceholder} disabled={loadingId === r.id} /> : <span className="plain-note">{r.catatan_admin || r.leader_catatan || "-"}</span>}</td><td><div className="request-action-buttons"><button className="btn-detail-blue" type="button" onClick={() => void openDetail(r)}><Eye size={14}/> Detail</button>{actionable && <button className="btn-approve-blue" onClick={() => askAction(r)} disabled={loadingId === r.id}><CheckCircle2 size={14}/> {cfg.approveLabel}</button>}</div></td></tr>; })}{filtered.length === 0 && <tr><td colSpan={11}><div className="empty-state">Belum ada data untuk diproses.</div></td></tr>}</tbody></table></div>
    <PaginationBar meta={meta} loading={loading} onPageChange={(page) => void refresh(page)} />
    {detail && <ViewportModal backdropClassName="modal-backdrop request-detail-backdrop"><div className="modal approval-detail-modal"><div className="modal-header compact"><div><h3 className="modal-title">Detail Permintaan Material</h3><div className="modal-subtitle">{detail.request_code} • {detail.surat_jalan_number || "Belum ada Surat Jalan"}</div></div><button className="btn-ghost" onClick={() => setDetail(null)}><X size={16}/></button></div><div className="modal-body material-detail-body">{detailLoading ? <div className="empty-state">Memuat detail request...</div> : <><div className="detail-summary-grid compact"><div><span>Status</span><strong>{statusText(detail.status)}</strong></div><div><span>Total Qty</span><strong>{detail.total_qty}</strong></div><div><span>Teknisi</span><strong>{detail.teknisi_nama}</strong></div></div>{mode === "SUPERVISOR" && detail.surat_jalan_number && <a className="btn-bast-purple" href={`/surat-jalan/${detail.id}`} target="_blank"><FileText size={16}/> View BAST / Surat Jalan</a>}<div className="request-detail-note-grid"><div className="request-detail-note-card"><strong>Basecamp</strong><p>{detail.basecamp || "-"}</p></div><div className="request-detail-note-card"><strong>Referensi Pekerjaan</strong><p>{detail.referensi_pekerjaan || "-"}</p></div><div className="request-detail-note-card"><strong>Catatan Teknisi</strong><p>{detail.catatan_teknisi || "-"}</p></div><div className="request-detail-note-card"><strong>Catatan Leader</strong><p>{detail.leader_catatan || "-"}</p></div><div className="request-detail-note-card"><strong>Catatan Admin</strong><p>{detail.catatan_admin || "-"}</p></div></div><div className="table-wrap compact-detail-table"><table><thead><tr><th>Material</th><th>Diminta</th><th>Disetujui</th><th>Status</th><th>Serial Number</th></tr></thead><tbody>{detail.items.map((i) => { const serials = selectedSerials(i); return <tr key={i.id}><td>{i.material_nama}</td><td>{i.qty_requested}</td><td>{i.qty_approved ?? "-"}</td><td>{i.status}</td><td>{serials.length > 0 ? <div className="serial-chip-list">{serials.map((s) => <span key={s.id}>{s.serial_number}</span>)}</div> : <span className="form-hint">-</span>}</td></tr>; })}</tbody></table></div>{detail.movements && detail.movements.length > 0 && <div className="serial-timeline-box"><div className="panel-title">Riwayat Serial pada Request Ini</div>{detail.movements.map((m) => <div className="serial-timeline-row" key={m.id}><strong>{m.serial_number}</strong><span>{m.from_location_type || "-"} → {m.to_location_type || "-"}</span><small>{formatDate(m.created_at)}</small></div>)}</div>}</>}</div></div></ViewportModal>}
    <ConfirmDialog open={!!pendingAction} title={`${cfg.approveLabel}?`} message={`Request ${pendingAction?.row.request_code} akan diproses ke tahap berikutnya.`} confirmLabel={cfg.approveLabel} variant="primary" loading={!!loadingId} onCancel={() => setPendingAction(null)} onConfirm={() => void executeAction()} />
  </section>;
}
