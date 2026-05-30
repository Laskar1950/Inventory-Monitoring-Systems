"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/table-skeleton";
import { PaginationBar } from "@/components/pagination-bar";
import type { TechnicianBagItem } from "@/types/database";

type ReturnSummary = { id: string; return_code: string; teknisi_nama: string; source_type: "BAG" | "MANUAL"; status: string; kondisi: string; qty_return: number; foto_url: string; keterangan: string | null; catatan_admin: string | null; created_at: string; materials_returned: string | null; serial_numbers?: string | null };
type ReturnItem = { bag_id?: string; material_code?: string; nama?: string; merk?: string; satuan?: string; wajib_sn?: boolean; serial_number?: string; qty: number; label: string };
type Meta = { page: number; limit: number; total: number; totalPages: number };

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusClass(status: string) { if (status === "APPROVED") return "badge badge-success"; if (status === "REJECTED") return "badge badge-danger"; return "badge badge-warning"; }
function storageUrl(bucket: string, path?: string | null) { if (!path) return ""; if (path.startsWith("http")) return path; const base = process.env.NEXT_PUBLIC_SUPABASE_URL; return base ? `${base}/storage/v1/object/public/${bucket}/${path}` : ""; }
function ReturnThumb({ path }: { path?: string | null }) { const src = storageUrl("return-evidence", path); if (!src) return <span className="thumb-empty"><ImageIcon size={16}/> Tidak ada</span>; return <a href={src} target="_blank" rel="noreferrer"><img className="table-thumb" src={src} alt="Foto material return" /></a>; }

export function ReturnsClient() {
  const [returns, setReturns] = useState<ReturnSummary[]>([]);
  const [bagItems, setBagItems] = useState<TechnicianBagItem[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [sourceType, setSourceType] = useState<"BAG" | "MANUAL">("BAG");
  const [selectedBagId, setSelectedBagId] = useState("");
  const [qty, setQty] = useState(1);
  const [kondisi, setKondisi] = useState("BAIK");
  const [keterangan, setKeterangan] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualNama, setManualNama] = useState("");
  const [manualMerk, setManualMerk] = useState("");
  const [manualSatuan, setManualSatuan] = useState("PCS");
  const [manualWajibSn, setManualWajibSn] = useState(false);
  const [manualSn, setManualSn] = useState("");
  const [manualQty, setManualQty] = useState(1);

  async function loadData(page = meta.page) {
    setLoading(true);
    try {
      const [bagRes, returnRes] = await Promise.all([fetch("/api/technician-bag?limit=100", { cache: "no-store" }), fetch(`/api/returns?page=${page}&limit=${meta.limit}`, { cache: "no-store" })]);
      const bagJson = await bagRes.json(); const returnJson = await returnRes.json();
      if (!bagRes.ok) throw new Error(bagJson.error || "Gagal memuat tas teknisi.");
      if (!returnRes.ok) throw new Error(returnJson.error || "Gagal memuat pengembalian.");
      setBagItems((bagJson.data || []).filter((item: TechnicianBagItem) => item.status === "ACTIVE" && item.qty > 0));
      setReturns(returnJson.data || []); setMeta(returnJson.meta || meta);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(1); }, []);

  const selectedBag = useMemo(() => bagItems.find((item) => item.id === selectedBagId), [bagItems, selectedBagId]);
  const filteredReturns = useMemo(() => { const q = query.toLowerCase().trim(); if (!q) return returns; return returns.filter((row) => [row.status, row.source_type, row.kondisi, row.materials_returned ?? "", row.serial_numbers ?? "", row.catatan_admin ?? ""].some((value) => value.toLowerCase().includes(q))); }, [query, returns]);

  function addBagItem() {
    if (!selectedBag) return toast.error("Material dari tas wajib dipilih.");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Qty return wajib lebih dari 0.");
    if (selectedBag.wajib_sn && qty !== 1) return toast.error("Material berserial hanya boleh qty 1 per pengajuan.");
    const existingQty = items.find((item) => item.bag_id === selectedBag.id)?.qty ?? 0;
    if (existingQty + qty > selectedBag.qty) return toast.error("Qty return tidak boleh melebihi stok tas.");
    const label = `${selectedBag.material_code} - ${selectedBag.material_nama}${selectedBag.serial_number ? ` | SN: ${selectedBag.serial_number}` : ""}`;
    setItems((prev) => { const found = prev.find((item) => item.bag_id === selectedBag.id); if (found) return prev.map((item) => item.bag_id === selectedBag.id ? { ...item, qty: item.qty + qty } : item); return [...prev, { bag_id: selectedBag.id, qty, label, serial_number: selectedBag.serial_number ?? undefined }]; });
    setSelectedBagId(""); setQty(1);
  }
  function addManualItem() { const code = manualCode.trim().toUpperCase(); if (!code || !manualNama.trim() || !manualMerk.trim() || !manualSatuan.trim()) return toast.error("Material ID, nama, merk, dan satuan wajib diisi."); if (!Number.isFinite(manualQty) || manualQty <= 0) return toast.error("Qty return wajib lebih dari 0."); if (manualWajibSn && (!manualSn.trim() || manualQty !== 1)) return toast.error("Material berserial wajib memiliki SN dan qty harus 1."); setItems((prev) => [...prev, { material_code: code, nama: manualNama.trim(), merk: manualMerk.trim(), satuan: manualSatuan.trim().toUpperCase(), wajib_sn: manualWajibSn, serial_number: manualSn.trim().toUpperCase() || undefined, qty: manualQty, label: `${code} - ${manualNama.trim()}${manualSn.trim() ? ` | SN: ${manualSn.trim().toUpperCase()}` : ""}` }]); setManualCode(""); setManualNama(""); setManualMerk(""); setManualSatuan("PCS"); setManualWajibSn(false); setManualSn(""); setManualQty(1); }
  function resetForm() { setItems([]); setSelectedBagId(""); setQty(1); setKeterangan(""); setFoto(null); setKondisi("BAIK"); const input = document.getElementById("return-photo") as HTMLInputElement | null; if (input) input.value = ""; }
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (items.length === 0) return toast.error("Minimal satu material pengembalian harus ditambahkan."); if (!foto) return toast.error("Foto material wajib diupload."); setSubmitting(true); try { const formData = new FormData(); formData.append("source_type", sourceType); formData.append("kondisi", kondisi); formData.append("keterangan", keterangan); formData.append("items", JSON.stringify(items.map(({ label, ...item }) => item))); formData.append("foto", foto); const res = await fetch("/api/returns", { method: "POST", body: formData }); const json = await res.json(); if (!res.ok) throw new Error(json.error || "Gagal mengirim pengembalian material."); toast.success(json.message || "Pengembalian berhasil dikirim."); resetForm(); setFormOpen(false); await loadData(1); } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mengirim pengembalian material."); } finally { setSubmitting(false); } }

  return <div className="page-grid">
    <section className="card"><div className="section-header"><div className="section-title"><h3>Riwayat Pengembalian Material</h3><p>Klik tambah pengembalian untuk return dari Tas Saya atau return manual.</p></div><div className="action-row"><button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={16}/> Tambah Pengembalian</button><button className="btn-ghost" onClick={() => void loadData(meta.page)} disabled={loading || submitting}><RefreshCcw size={15}/> Refresh</button></div></div>
      <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }}/><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari status, material, serial number..."/></div></div></div>
      <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Sumber</th><th>Material</th><th>Serial Number</th><th>Qty</th><th>Kondisi</th><th>Foto</th><th>Status</th><th>Catatan Admin</th></tr></thead><tbody>{loading ? <TableSkeleton rows={6} columns={9} /> : filteredReturns.map((row) => <tr key={row.id}><td>{formatDate(row.created_at)}</td><td>{row.source_type}</td><td>{row.materials_returned || "-"}</td><td>{row.serial_numbers || "-"}</td><td><strong>{row.qty_return}</strong></td><td>{row.kondisi}</td><td><ReturnThumb path={row.foto_url} /></td><td><span className={statusClass(row.status)}>{row.status}</span></td><td>{row.catatan_admin || "-"}</td></tr>)}{!loading && filteredReturns.length === 0 && <tr><td colSpan={9}><div className="empty-state">Belum ada pengembalian material.</div></td></tr>}</tbody></table></div>
      <PaginationBar meta={meta} loading={loading} onPageChange={(page) => void loadData(page)} />
    </section>
    {formOpen && <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><h3 className="modal-title">Tambah Pengembalian Material</h3><div className="modal-subtitle">Kirim return dari Tas Saya atau return manual. Stok gudang baru berubah setelah Admin approve.</div></div><button type="button" className="btn-ghost" onClick={() => { resetForm(); setFormOpen(false); }}><X size={16}/> Tutup</button></div><form onSubmit={submit} className="form-stack"><div className="modal-body"><div className="form-grid three"><label><span>Sumber Material *</span><select value={sourceType} onChange={(e) => { setSourceType(e.target.value as "BAG" | "MANUAL"); setItems([]); }}><option value="BAG">Dari Tas Saya</option><option value="MANUAL">Manual</option></select></label><label><span>Kondisi *</span><select value={kondisi} onChange={(e) => setKondisi(e.target.value)}><option>BAIK</option><option>RUSAK</option><option>BEKAS</option><option>HILANG</option></select></label><label><span>Foto Material *</span><input id="return-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} /></label></div>{sourceType === "BAG" ? <div className="panel"><div className="panel-title">Material dari Tas</div><div className="form-grid usage-add-grid"><label><span>Material</span><select value={selectedBagId} onChange={(e) => setSelectedBagId(e.target.value)}><option value="">Pilih material</option>{bagItems.map((item) => <option key={item.id} value={item.id}>{item.material_code} - {item.material_nama} {item.serial_number ? `| SN: ${item.serial_number}` : ""} | Stok: {item.qty}</option>)}</select></label><label><span>Qty</span><input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))}/></label><button type="button" className="btn-dark align-end" onClick={addBagItem}>Tambah</button></div>{selectedBag && <span className="form-hint">Stok tas tersedia: {selectedBag.qty} {selectedBag.satuan}. {selectedBag.wajib_sn ? "Material berserial hanya qty 1." : "Material non-serial."}</span>}</div> : <div className="panel"><div className="panel-title">Return Manual</div><div className="form-grid three"><label><span>Material ID *</span><input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Contoh: MAT-001"/></label><label><span>Nama Material *</span><input value={manualNama} onChange={(e) => setManualNama(e.target.value)} placeholder="Nama material"/></label><label><span>Merk *</span><input value={manualMerk} onChange={(e) => setManualMerk(e.target.value)} placeholder="Merk"/></label><label><span>Satuan *</span><input value={manualSatuan} onChange={(e) => setManualSatuan(e.target.value)} placeholder="PCS"/></label><label><span>Qty *</span><input type="number" min={1} value={manualQty} onChange={(e) => setManualQty(Number(e.target.value))}/></label><label><span>Serial Number</span><input value={manualSn} onChange={(e) => setManualSn(e.target.value)} placeholder="Wajib jika SN" disabled={!manualWajibSn}/></label></div><label className="check-row"><input type="checkbox" checked={manualWajibSn} onChange={(e) => setManualWajibSn(e.target.checked)}/> Material wajib serial number</label><button type="button" className="btn-dark" onClick={addManualItem}>Tambah Manual</button></div>}{items.length > 0 && <div className="mini-table-wrap"><table className="table compact"><thead><tr><th>Material</th><th>Serial Number</th><th>Qty</th><th>Aksi</th></tr></thead><tbody>{items.map((item, idx) => <tr key={`${item.label}-${idx}`}><td>{item.label}</td><td>{item.serial_number || "-"}</td><td>{item.qty}</td><td><button type="button" className="btn-danger-small" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={14}/> Hapus</button></td></tr>)}</tbody></table></div>}<label><span>Keterangan</span><textarea rows={3} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Opsional"/></label></div><div className="modal-footer"><button className="btn-primary" disabled={submitting}>{submitting ? "Mengirim pengembalian..." : "Kirim Pengembalian"}</button></div></form></div></div>}
  </div>;
}
