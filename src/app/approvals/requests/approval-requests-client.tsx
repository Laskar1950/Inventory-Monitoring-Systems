"use client";

import { useMemo, useState } from "react";
import { Eye, FileText, RefreshCcw, Search, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaginationBar } from "@/components/pagination-bar";
import { ViewportModal } from "@/components/viewport-modal";
import type { RequestDetail } from "@/types/database";

type Meta = { page: number; limit: number; total: number; totalPages: number };
type SerialMove = { id: string; serial_number: string; material_id: string; material_code: string; material_nama: string; movement_type: string; from_location_type: string | null; to_location_type: string | null; to_teknisi_nama: string | null; note: string | null; created_at: string };
type SelectedSerial = { id: string; serial_number_id: string; serial_number: string; request_item_id: string; material_id: string; serial_status?: string; location_type?: string; kondisi?: string | null };
type AvailableSerial = { id: string; serial_number: string; kondisi: string | null; status: string; location_type: string };
type RequestItemWithSerials = RequestDetail["items"][number] & { serials?: SerialMove[]; selected_serials?: SelectedSerial[] };
type RequestDetailWithSerials = Omit<RequestDetail, "items"> & { movements?: SerialMove[]; selected_serials?: SelectedSerial[]; items: RequestItemWithSerials[] };
type ApprovalDraftItem = { item_id: string; material_id: string; material_code: string; material_nama: string; wajib_sn: boolean; qty_requested: number; qty_approved: number; serial_ids: string[] };
type PendingAction = { action: "approve" | "reject"; row: RequestDetailWithSerials } | null;

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusClass(status: string) { if (["APPROVED", "KOORDINATOR_SIGNED", "WAITING_SIGNATURE", "COMPLETED"].includes(status)) return "badge badge-success"; if (status === "REJECTED") return "badge badge-danger"; return "badge badge-warning"; }
function statusText(status: string) { return status === "LEADER_APPROVED" ? "Leader Approved" : status === "WAITING_SIGNATURE" ? "Menunggu Koordinator" : status === "KOORDINATOR_SIGNED" ? "Menunggu Supervisor" : status === "APPROVED" ? "Menunggu Teknisi" : status === "COMPLETED" ? "Selesai" : status; }

export function ApprovalRequestsClient({ initialRequests, initialMeta }: { initialRequests: RequestDetail[]; initialMeta: Meta }) {
  const [requests, setRequests] = useState(initialRequests);
  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<RequestDetailWithSerials | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approval, setApproval] = useState<RequestDetailWithSerials | null>(null);
  const [approvalItems, setApprovalItems] = useState<ApprovalDraftItem[]>([]);
  const [availableSerials, setAvailableSerials] = useState<Record<string, AvailableSerial[]>>({});
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

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

  async function loadDetail(row: RequestDetail) {
    const res = await fetch(`/api/requests/${row.id}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Gagal memuat detail request.");
    return json.data as RequestDetailWithSerials;
  }

  async function openDetail(row: RequestDetail) {
    setDetail(row as RequestDetailWithSerials);
    setDetailLoading(true);
    try { setDetail(await loadDetail(row)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memuat detail request."); }
    finally { setDetailLoading(false); }
  }

  async function openApproval(row: RequestDetail) {
    setApprovalLoading(true);
    try {
      const data = await loadDetail(row);
      setApproval(data);
      const draft = data.items.map((item) => ({
        item_id: item.id,
        material_id: item.material_id,
        material_code: item.material_code,
        material_nama: item.material_nama,
        wajib_sn: item.wajib_sn,
        qty_requested: item.qty_requested,
        qty_approved: item.qty_approved ?? item.qty_requested,
        serial_ids: item.selected_serials?.map((s) => s.serial_number_id) ?? [],
      }));
      setApprovalItems(draft);
      const serialEntries = await Promise.all(draft.filter((item) => item.wajib_sn).map(async (item) => {
        const res = await fetch(`/api/materials/${item.material_id}/available-serials`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Gagal memuat serial ${item.material_code}.`);
        const selected = data.items.find((i) => i.id === item.item_id)?.selected_serials ?? [];
        const merged = [...(json.data || []), ...selected.map((s) => ({ id: s.serial_number_id, serial_number: s.serial_number, kondisi: s.kondisi ?? null, status: s.serial_status || "AVAILABLE", location_type: s.location_type || "GUDANG" }))];
        return [item.material_id, Array.from(new Map(merged.map((s: AvailableSerial) => [s.id, s])).values())] as const;
      }));
      setAvailableSerials(Object.fromEntries(serialEntries));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal membuka approval."); }
    finally { setApprovalLoading(false); }
  }

  function updateDraft(itemId: string, patch: Partial<ApprovalDraftItem>) {
    setApprovalItems((current) => current.map((item) => item.item_id === itemId ? { ...item, ...patch } : item));
  }

  function toggleSerial(item: ApprovalDraftItem, serialId: string) {
    const selected = item.serial_ids.includes(serialId);
    if (!selected && item.serial_ids.length >= item.qty_approved) return toast.error("Jumlah serial sudah sama dengan qty approved.");
    updateDraft(item.item_id, { serial_ids: selected ? item.serial_ids.filter((id) => id !== serialId) : [...item.serial_ids, serialId] });
  }

  function askSubmit(action: "approve" | "reject", row?: RequestDetailWithSerials) {
    const target = row ?? approval;
    if (!target) return;
    if (action === "approve") {
      for (const item of approvalItems) {
        if (item.qty_approved > item.qty_requested) return toast.error(`Qty approved ${item.material_code} tidak boleh melebihi qty diminta.`);
        if (item.wajib_sn && item.serial_ids.length !== item.qty_approved) return toast.error(`Serial ${item.material_code} harus sama dengan qty approved.`);
      }
    }
    setPendingAction({ action, row: target });
  }

  async function executeSubmit() {
    if (!pendingAction) return;
    const { action, row } = pendingAction;
    setLoadingId(row.id);
    try {
      const payload = action === "approve"
        ? { catatan_admin: notes[row.id] ?? row.catatan_admin ?? "", items: approvalItems.map((item) => ({ item_id: item.item_id, qty_approved: item.qty_approved, serial_ids: item.serial_ids })) }
        : { catatan_admin: notes[row.id] ?? row.catatan_admin ?? "" };
      const res = await fetch(`/api/requests/${row.id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approval gagal diproses.");
      toast.success(action === "approve" ? (json.message || "Surat jalan berhasil dibuat.") : "Request berhasil ditolak.");
      setPendingAction(null); setApproval(null); setApprovalItems([]); setAvailableSerials({});
      await refresh(meta.page);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Approval gagal diproses."); }
    finally { setLoadingId(""); }
  }

  return <section className="card clean-card-header approval-page-card">
    <div className="section-header"><div className="section-title"><h3>Setujui Permintaan Material</h3><p>Admin memproses request yang sudah disetujui Leader menjadi surat jalan.</p></div></div>
    <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari request, teknisi, material..." /></div></div><button className="btn-ghost" onClick={() => void refresh(meta.page)} disabled={loading}><RefreshCcw size={15} /> Refresh</button></div>
    <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Tanggal</th><th>Teknisi</th><th>Material</th><th>Total</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>{filtered.map((r) => <tr key={r.id}><td><strong>{r.request_code}</strong></td><td>{formatDate(r.created_at)}</td><td>{r.teknisi_nama}</td><td><div className="material-stack">{r.items.map((i) => <span key={i.id}>{i.material_nama} <b>({i.qty_requested})</b></span>)}</div></td><td><strong>{r.total_qty}</strong></td><td><span className={statusClass(r.status)}>{statusText(r.status)}</span></td><td><span className="plain-note">Teknisi: {r.catatan_teknisi || "-"}</span>{r.status === "LEADER_APPROVED" && <input className="form-control admin-note-input" value={notes[r.id] ?? r.catatan_admin ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Catatan admin untuk surat jalan" disabled={loadingId === r.id} />}</td><td>{r.status === "LEADER_APPROVED" ? <div className="action-row"><button className="btn-primary-small" onClick={() => void openApproval(r)} disabled={approvalLoading || loadingId === r.id}><FileText size={14} /> Proses SJ</button><button className="btn-danger-small" onClick={() => askSubmit("reject", r as RequestDetailWithSerials)} disabled={loadingId === r.id}><XCircle size={14} /> Reject</button></div> : <button className="btn-primary-small" type="button" onClick={() => void openDetail(r)}><Eye size={14}/> Detail</button>}</td></tr>)}{filtered.length === 0 && <tr><td colSpan={8}><div className="empty-state">Belum ada request material.</div></td></tr>}</tbody></table></div>
    <PaginationBar meta={meta} loading={loading} onPageChange={(page) => void refresh(page)} />

    {approval && <ViewportModal backdropClassName="modal-backdrop request-detail-backdrop"><div className="modal approval-detail-modal"><div className="modal-header compact"><div><h3 className="modal-title">Proses Surat Jalan</h3><div className="modal-subtitle">{approval.request_code} • {approval.teknisi_nama}</div></div><button className="btn-ghost" onClick={() => setApproval(null)} disabled={!!loadingId}><X size={16}/></button></div><div className="modal-body material-detail-body"><div className="approval-note-box"><strong>Catatan Teknisi</strong><p>{approval.catatan_teknisi || "-"}</p><strong>Catatan Admin</strong><textarea className="form-control" rows={2} value={notes[approval.id] ?? approval.catatan_admin ?? ""} onChange={(e) => setNotes({ ...notes, [approval.id]: e.target.value })} placeholder="Catatan admin untuk surat jalan" /></div><div className="table-wrap compact-detail-table"><table><thead><tr><th>Material</th><th>Diminta</th><th>Qty Approved</th><th>Serial Number</th></tr></thead><tbody>{approvalItems.map((item) => <tr key={item.item_id}><td><strong>{item.material_code}</strong><br/>{item.material_nama}</td><td>{item.qty_requested}</td><td><input className="form-control" type="number" min={0} max={item.qty_requested} value={item.qty_approved} onChange={(e) => { const n = Math.max(0, Math.min(item.qty_requested, Number(e.target.value) || 0)); updateDraft(item.item_id, { qty_approved: n, serial_ids: item.serial_ids.slice(0, n) }); }} /></td><td>{item.wajib_sn ? <div className="serial-chip-list">{(availableSerials[item.material_id] || []).map((serial) => { const active = item.serial_ids.includes(serial.id); return <button key={serial.id} type="button" className={active ? "badge badge-success" : "badge badge-muted"} onClick={() => toggleSerial(item, serial.id)}>{serial.serial_number}</button>; })}{(availableSerials[item.material_id] || []).length === 0 && <span className="form-hint">Tidak ada serial tersedia.</span>}<span className="form-hint">Dipilih {item.serial_ids.length} dari {item.qty_approved}</span></div> : <span className="form-hint">Non Serial</span>}</td></tr>)}</tbody></table></div></div><div className="modal-footer"><button className="btn-ghost" onClick={() => setApproval(null)} disabled={!!loadingId}>Batal</button><button className="btn-primary" onClick={() => askSubmit("approve")} disabled={!!loadingId}>{loadingId ? "Memproses..." : "Proses Surat Jalan"}</button></div></div></ViewportModal>}

    {detail && <ViewportModal backdropClassName="modal-backdrop request-detail-backdrop"><div className="modal approval-detail-modal"><div className="modal-header compact"><div><h3 className="modal-title">Detail Permintaan</h3><div className="modal-subtitle">{detail.request_code} • {detail.teknisi_nama}</div></div><button className="btn-ghost" onClick={() => setDetail(null)}><X size={16}/></button></div><div className="modal-body material-detail-body">{detailLoading ? <div className="empty-state">Memuat detail request...</div> : <><div className="detail-summary-grid compact"><div><span>Status</span><strong>{statusText(detail.status)}</strong></div><div><span>Total Qty</span><strong>{detail.total_qty}</strong></div><div><span>Surat Jalan</span><strong>{detail.surat_jalan_number || "-"}</strong></div></div><div className="approval-note-box"><strong>Catatan Teknisi</strong><p>{detail.catatan_teknisi || "-"}</p><strong>Catatan Leader</strong><p>{detail.leader_catatan || "-"}</p><strong>Catatan Admin</strong><p>{detail.catatan_admin || "-"}</p></div><div className="table-wrap compact-detail-table"><table><thead><tr><th>Material</th><th>Diminta</th><th>Disetujui</th><th>Status</th><th>Serial Number Dipilih/Diberikan</th></tr></thead><tbody>{detail.items.map((i: RequestItemWithSerials) => { const selected = i.serials && i.serials.length > 0 ? i.serials.map((s) => ({ id: s.id, serial_number: s.serial_number })) : (i.selected_serials || []).map((s) => ({ id: s.id, serial_number: s.serial_number })); return <tr key={i.id}><td>{i.material_nama}</td><td>{i.qty_requested}</td><td>{i.qty_approved ?? "-"}</td><td>{i.status}</td><td>{selected.length > 0 ? <div className="serial-chip-list">{selected.map((s) => <span key={s.id}>{s.serial_number}</span>)}</div> : <span className="form-hint">-</span>}</td></tr>; })}</tbody></table></div>{detail.movements && detail.movements.length > 0 && <div className="serial-timeline-box"><div className="panel-title">Riwayat Serial pada Request Ini</div>{detail.movements.map((m) => <div className="serial-timeline-row" key={m.id}><strong>{m.serial_number}</strong><span>{m.from_location_type || "-"} → {m.to_location_type || "-"}</span><small>{formatDate(m.created_at)}</small></div>)}</div>}</>}</div></div></ViewportModal>}
    <ConfirmDialog open={!!pendingAction} title={pendingAction?.action === "reject" ? "Tolak request material?" : "Proses Surat Jalan?"} message={pendingAction?.action === "reject" ? `Request ${pendingAction.row.request_code} akan ditolak oleh Admin Gudang.` : `Request ${pendingAction?.row.request_code} akan diproses menjadi Surat Jalan dan masuk ke tahap tanda tangan Koordinator.`} confirmLabel={pendingAction?.action === "reject" ? "Ya, Tolak" : "Ya, Proses SJ"} variant={pendingAction?.action === "reject" ? "danger" : "primary"} loading={!!loadingId} onCancel={() => setPendingAction(null)} onConfirm={() => void executeSubmit()} />
  </section>;
}
