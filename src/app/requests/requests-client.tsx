"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TableSkeleton } from "@/components/table-skeleton";
import { PaginationBar } from "@/components/pagination-bar";
import type { Material, RequestDetail } from "@/types/database";

type CartItem = { material_id: string; qty: number };
type Meta = { page: number; limit: number; total: number; totalPages: number };
type RequesterProfile = { basecamp?: string | null; company_name?: string | null; phone_number?: string | null };

function statusClass(status: string) { if (["APPROVED", "COMPLETED"].includes(status)) return "badge badge-success"; if (status === "REJECTED") return "badge badge-danger"; return "badge badge-warning"; }
function statusText(status: string) { return status === "PENDING" ? "Menunggu Leader" : status === "LEADER_APPROVED" ? "Menunggu Admin" : status === "WAITING_SIGNATURE" ? "Menunggu Koordinator" : status === "KOORDINATOR_SIGNED" ? "Menunggu Supervisor" : status === "APPROVED" ? "Siap Diterima" : status === "COMPLETED" ? "Selesai" : status; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function RequestsClient({ initialMaterials, initialRequests, initialMeta, requesterProfile }: { initialMaterials: Material[]; initialRequests: RequestDetail[]; initialMeta?: Meta; requesterProfile?: RequesterProfile }) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [requests, setRequests] = useState(initialRequests);
  const [meta, setMeta] = useState<Meta>(initialMeta || { page: 1, limit: 20, total: initialRequests.length, totalPages: 1 });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [qty, setQty] = useState("1");
  const [catatan, setCatatan] = useState("");
  const [basecamp, setBasecamp] = useState(requesterProfile?.basecamp || "");
  const [referensiPekerjaan, setReferensiPekerjaan] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [receivingId, setReceivingId] = useState("");
  const [receiveTarget, setReceiveTarget] = useState<RequestDetail | null>(null);

  const activeMaterials = useMemo(() => materials.filter((m) => m.is_active && Number(m.gudang_qty ?? 0) > 0), [materials]);
  const selectedMaterial = activeMaterials.find((m) => m.id === selectedMaterialId);
  const filteredRequests = useMemo(() => {
    const q = query.toLowerCase().trim(); if (!q) return requests;
    return requests.filter((r) => [r.request_code, r.status, r.catatan_teknisi ?? "", r.surat_jalan_number ?? "", r.basecamp ?? "", r.referensi_pekerjaan ?? "", ...r.items.map((i) => `${i.material_code} ${i.material_nama}`)].some((v) => v.toLowerCase().includes(q)));
  }, [query, requests]);

  function resetForm() {
    setCart([]);
    setCatatan("");
    setSelectedMaterialId("");
    setReferensiPekerjaan("");
    setBasecamp(requesterProfile?.basecamp || "");
  }

  async function refresh(page = meta.page) {
    setLoading(true);
    try {
      const [reqRes, matRes] = await Promise.all([fetch(`/api/requests?page=${page}&limit=${meta.limit}`, { cache: "no-store" }), fetch("/api/materials?limit=100", { cache: "no-store" })]);
      const reqJson = await reqRes.json(); const matJson = await matRes.json();
      if (!reqRes.ok) throw new Error(reqJson.error || "Gagal memuat request material.");
      if (reqRes.ok) { setRequests(reqJson.data || []); setMeta(reqJson.meta || meta); }
      if (matRes.ok) setMaterials(matJson.data || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  }

  function addToCart() {
    if (!selectedMaterial) return toast.error("Material wajib dipilih.");
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Qty wajib lebih dari 0.");
    const existingQty = cart.find((item) => item.material_id === selectedMaterial.id)?.qty ?? 0;
    if (existingQty + n > Number(selectedMaterial.gudang_qty ?? 0)) return toast.error("Qty tidak boleh melebihi stok gudang.");
    setCart((prev) => { const found = prev.find((item) => item.material_id === selectedMaterial.id); if (found) return prev.map((item) => item.material_id === selectedMaterial.id ? { ...item, qty: item.qty + n } : item); return [...prev, { material_id: selectedMaterial.id, qty: n }]; });
    setQty("1");
  }

  async function submit() {
    if (cart.length === 0) return toast.error("Request minimal memiliki satu item.");
    if (!basecamp.trim()) return toast.error("Basecamp wajib diisi untuk Surat Jalan.");
    if (!referensiPekerjaan.trim()) return toast.error("Referensi pekerjaan / project wajib diisi untuk Surat Jalan.");
    setLoading(true);
    try {
      const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catatan_teknisi: catatan, basecamp, referensi_pekerjaan: referensiPekerjaan, items: cart }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim request material.");
      toast.success("Request berhasil dikirim.");
      setOpen(false); resetForm();
      await refresh(1);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mengirim request material."); }
    finally { setLoading(false); }
  }

  async function receiveMaterial() {
    if (!receiveTarget) return;
    setReceivingId(receiveTarget.id);
    try {
      const res = await fetch(`/api/requests/${receiveTarget.id}/receive`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menerima material.");
      toast.success(json.message || "Material berhasil diterima.");
      setReceiveTarget(null);
      await refresh(meta.page);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menerima material."); }
    finally { setReceivingId(""); }
  }

  return <>
    <section className="card">
      <div className="section-header"><div className="section-title"><h3>Permintaan Material</h3><p>Buat request material dari stok gudang. Request akan masuk ke Leader dengan status Pending.</p></div><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Tambah Permintaan</button></div>
      <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari request, status, material, basecamp, project..." /></div></div><button className="btn-ghost" onClick={() => void refresh(meta.page)} disabled={loading}><RefreshCcw size={15} /> Refresh</button></div>
      <div className="table-wrap"><table><thead><tr><th>Kode Request</th><th>Surat Jalan</th><th>Tanggal</th><th>Basecamp</th><th>Referensi</th><th>Item</th><th>Total Qty</th><th>Status</th><th>Catatan Admin</th><th>Aksi</th></tr></thead><tbody>{loading ? <TableSkeleton rows={6} columns={10} /> : filteredRequests.map((r) => <tr key={r.id}><td><strong>{r.request_code}</strong></td><td>{r.surat_jalan_number || "-"}</td><td>{formatDate(r.created_at)}</td><td>{r.basecamp || "-"}</td><td>{r.referensi_pekerjaan || "-"}</td><td>{r.items.map((i) => `${i.material_nama} (${i.qty_requested})`).join(", ")}</td><td><strong>{r.total_qty}</strong></td><td><span className={statusClass(r.status)}>{statusText(r.status)}</span></td><td>{r.catatan_admin ?? "-"}</td><td><div className="action-row">{r.surat_jalan_number && <a className="btn-secondary-small" href={`/surat-jalan/${r.id}`} target="_blank"><FileText size={14}/> Lihat SJ</a>}{r.status === "APPROVED" && <button className="btn-primary-small" type="button" onClick={() => setReceiveTarget(r)} disabled={receivingId === r.id}><CheckCircle2 size={14}/>{receivingId === r.id ? "Menerima..." : "Terima"}</button>}{r.status === "COMPLETED" && <a className="btn-primary-small" href={`/api/requests/${r.id}/surat-jalan-pdf/download`} target="_blank"><Download size={14}/> PDF</a>}</div></td></tr>)}{!loading && filteredRequests.length === 0 && <tr><td colSpan={10}><div className="empty-state">Belum ada request material.</div></td></tr>}</tbody></table></div>
      <PaginationBar meta={meta} loading={loading} onPageChange={(page) => void refresh(page)} />
    </section>
    {open && <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><h3 className="modal-title">Tambah Permintaan Material</h3><div className="modal-subtitle">Basecamp dan referensi pekerjaan akan tampil pada Surat Jalan.</div></div><button className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}><X size={16} /></button></div><div className="modal-body"><div className="panel"><div className="panel-title">Informasi Surat Jalan</div><div className="form-grid"><label><span className="field-label">Basecamp</span><input className="form-control" value={basecamp} onChange={(e) => setBasecamp(e.target.value)} placeholder="Contoh: KP PURWOKERTO" /></label><label><span className="field-label">Referensi Pekerjaan / Project</span><input className="form-control" value={referensiPekerjaan} onChange={(e) => setReferensiPekerjaan(e.target.value)} placeholder="Contoh: CA CLP BARAT / Maintenance FO" /></label></div><span className="form-hint">Nama perusahaan dan no HP diambil dari Profil Saya.</span></div><div className="panel"><div className="panel-title">Pilih Material</div><div className="form-grid"><label><span className="field-label">Material</span><select className="form-select" value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)}><option value="">Pilih material</option>{activeMaterials.map((m) => <option key={m.id} value={m.id}>{m.material_code} - {m.nama} | Stok: {m.gudang_qty}</option>)}</select></label><label><span className="field-label">Qty</span><input className="form-control" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></label></div>{selectedMaterial && <span className="form-hint">Stok tersedia: {selectedMaterial.gudang_qty} {selectedMaterial.satuan}. {selectedMaterial.wajib_sn ? "Material ini berserial." : "Material ini non-serial."}</span>}<button className="btn-dark" style={{ marginTop: 12 }} onClick={addToCart}>Tambah ke Daftar</button></div><div className="panel"><div className="panel-title">Daftar Request</div>{cart.length === 0 ? <div className="empty-state">Belum ada material ditambahkan.</div> : <div className="table-wrap"><table><thead><tr><th>Material</th><th>Qty</th><th>Aksi</th></tr></thead><tbody>{cart.map((item) => { const material = materials.find((m) => m.id === item.material_id); return <tr key={item.material_id}><td><strong>{material?.material_code}</strong> - {material?.nama}</td><td>{item.qty}</td><td><button className="btn-danger" onClick={() => setCart(cart.filter((x) => x.material_id !== item.material_id))}><Trash2 size={14} /></button></td></tr>; })}</tbody></table></div>}</div><label><span className="field-label">Catatan Teknisi</span><textarea className="form-control" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" /></label></div><div className="modal-footer"><button className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}>Batal</button><button className="btn-primary" onClick={submit} disabled={loading}>{loading ? "Mengirim..." : "Kirim Request"}</button></div></div></div>}
    <ConfirmDialog open={!!receiveTarget} title="Terima material?" message={`Tanda tangan digital Anda akan dicatat sebagai penerima material untuk ${receiveTarget?.surat_jalan_number || receiveTarget?.request_code}.`} confirmLabel="Ya, Terima" loading={!!receivingId} onCancel={() => setReceiveTarget(null)} onConfirm={() => void receiveMaterial()} />
  </>;
}
