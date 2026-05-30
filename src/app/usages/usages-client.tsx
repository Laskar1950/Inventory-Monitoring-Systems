"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Plus, RefreshCcw, X } from "lucide-react";
import type { TechnicianBagItem } from "@/types/database";

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
  material_names?: string | null;
  serial_numbers?: string | null;
};

type SelectedItem = { bag_id: string; label: string; serial_number: string | null; wajib_sn: boolean; available_qty: number; qty: number };

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function materialName(value?: string | null) { if (!value) return ""; return value.split(", ").map((part) => part.includes(" - ") ? part.split(" - ").slice(1).join(" - ") : part).join(", "); }

function EvidenceThumb({ path, alt }: { path?: string | null; alt: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setSrc("");
    if (!path) return;
    if (path.startsWith("http")) { setSrc(path); return; }
    fetch(`/api/storage-url?bucket=usage-evidence&path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((json) => { if (active) setSrc(json.signedUrl || ""); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [path]);

  if (!path || failed) return <span className="thumb-empty"><ImageIcon size={16} /> Tidak ada</span>;
  if (!src) return <span className="thumb-empty">Memuat foto...</span>;
  return <a href={src} target="_blank" rel="noreferrer"><img className="table-thumb" src={src} alt={alt} onError={() => setFailed(true)} /></a>;
}

export function UsagesClient({ readOnly = false }: { readOnly?: boolean }) {
  const [bagItems, setBagItems] = useState<TechnicianBagItem[]>([]);
  const [usages, setUsages] = useState<UsageSummary[]>([]);
  const [selectedBagId, setSelectedBagId] = useState("");
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [noTiket, setNoTiket] = useState("");
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [idPelanggan, setIdPelanggan] = useState("");
  const [alamat, setAlamat] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true); setError(null);
    try {
      const requests = readOnly ? [fetch("/api/usages", { cache: "no-store" })] : [fetch("/api/technician-bag", { cache: "no-store" }), fetch("/api/usages", { cache: "no-store" })];
      const responses = await Promise.all(requests);
      const usageRes = readOnly ? responses[0] : responses[1];
      const usageJson = await usageRes.json();
      if (!usageRes.ok) throw new Error(usageJson.error || "Gagal memuat penggunaan material.");
      if (!readOnly) {
        const bagJson = await responses[0].json();
        if (!responses[0].ok) throw new Error(bagJson.error || "Gagal memuat tas teknisi.");
        setBagItems((bagJson.data || []).filter((item: TechnicianBagItem) => item.status === "ACTIVE" && item.qty > 0));
      }
      setUsages(usageJson.data || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(); }, []);

  const selectedBag = useMemo(() => bagItems.find((item) => item.id === selectedBagId), [bagItems, selectedBagId]);
  const availableBagItems = useMemo(() => bagItems.map((bag) => { const alreadySelected = items.find((item) => item.bag_id === bag.id)?.qty ?? 0; return { ...bag, remaining_qty: bag.qty - alreadySelected }; }).filter((bag) => bag.remaining_qty > 0), [bagItems, items]);

  function resetForm() { setItems([]); setNoTiket(""); setNamaPelanggan(""); setIdPelanggan(""); setAlamat(""); setRootCause(""); setFoto(null); setSelectedBagId(""); setQty(1); const fileInput = document.getElementById("usage-photo") as HTMLInputElement | null; if (fileInput) fileInput.value = ""; }
  function addItem() {
    setError(null);
    if (!selectedBag) return setError("Material dari tas wajib dipilih.");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Qty wajib lebih dari 0.");
    if (selectedBag.wajib_sn && qty !== 1) return setError("Material berserial hanya boleh digunakan qty 1 per serial number.");
    const existing = items.find((item) => item.bag_id === selectedBag.id);
    const nextQty = (existing?.qty ?? 0) + qty;
    if (nextQty > selectedBag.qty) return setError("Qty penggunaan tidak boleh melebihi stok tas.");
    const label = selectedBag.material_nama;
    setItems((prev) => existing ? prev.map((item) => item.bag_id === selectedBag.id ? { ...item, qty: nextQty } : item) : [...prev, { bag_id: selectedBag.id, label, serial_number: selectedBag.serial_number, wajib_sn: selectedBag.wajib_sn, available_qty: selectedBag.qty, qty }]);
    setSelectedBagId(""); setQty(1);
  }

  async function submitUsage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null);
    if (items.length === 0) return setError("Minimal satu material harus ditambahkan.");
    if (!foto) return setError("Foto eviden wajib diupload.");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("no_tiket", noTiket); formData.append("nama_pelanggan", namaPelanggan); formData.append("id_pelanggan", idPelanggan); formData.append("alamat", alamat); formData.append("root_cause", rootCause); formData.append("items", JSON.stringify(items.map((item) => ({ bag_id: item.bag_id, qty: item.qty })))); formData.append("foto", foto);
      const response = await fetch("/api/usages", { method: "POST", body: formData }); const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal menyimpan penggunaan material.");
      setMessage(json.message || "Penggunaan material berhasil dicatat."); resetForm(); setFormOpen(false); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal menyimpan penggunaan material."); }
    finally { setSubmitting(false); }
  }

  return <div className="page-grid">
    <section className="card"><div className="section-header"><div className="section-title"><h3>{readOnly ? "Laporan Penggunaan Material" : "Riwayat Penggunaan Material"}</h3><p>{readOnly ? "Pantau penggunaan material yang dikirim seluruh teknisi." : "Klik input penggunaan untuk mencatat penggunaan material dari Tas Saya."}</p></div><div className="action-row">{!readOnly && <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={16}/> Input Penggunaan</button>}<button className="btn-secondary" type="button" onClick={() => void loadData()} disabled={loading || submitting}><RefreshCcw size={15}/> Refresh</button></div></div>
      {message && <div className="alert-success">{message}</div>}{error && <div className="alert-error">{error}</div>}
      <div className="table-wrap"><table className="table"><thead><tr>{readOnly && <th>Teknisi</th>}<th>Tanggal</th><th>Tiket</th><th>Pelanggan</th><th>Alamat</th><th>Material</th><th>Serial Number</th><th>Qty</th><th>Foto</th></tr></thead><tbody>{loading ? <tr><td colSpan={readOnly ? 9 : 8}>Memuat data...</td></tr> : usages.length === 0 ? <tr><td colSpan={readOnly ? 9 : 8}>Belum ada penggunaan material.</td></tr> : usages.map((usage) => <tr key={usage.id}>{readOnly && <td>{usage.teknisi_nama}</td>}<td>{formatDate(usage.created_at)}</td><td>{usage.no_tiket}</td><td>{usage.nama_pelanggan || "-"}</td><td className="wide-cell">{usage.alamat || "-"}</td><td>{usage.material_names || materialName(usage.materials_used) || `${usage.item_count} item`}</td><td>{usage.serial_numbers || "-"}</td><td>{usage.total_qty}</td><td><EvidenceThumb path={usage.foto_url} alt={`Foto penggunaan ${usage.no_tiket}`} /></td></tr>)}</tbody></table></div>
    </section>
    {formOpen && !readOnly && <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><h3 className="modal-title">Input Penggunaan Material</h3><div className="modal-subtitle">Pilih material dari Tas Saya, isi tiket/pelanggan, lalu upload foto eviden.</div></div><button type="button" className="btn-ghost" onClick={() => { resetForm(); setFormOpen(false); }}><X size={16}/> Tutup</button></div><form onSubmit={submitUsage} className="form-stack"><div className="modal-body"><div className="form-grid three"><label><span>Nomor Tiket *</span><input value={noTiket} onChange={(e) => setNoTiket(e.target.value)} placeholder="Contoh: TIK-001" required /></label><label><span>Nama Pelanggan</span><input value={namaPelanggan} onChange={(e) => setNamaPelanggan(e.target.value)} placeholder="Nama pelanggan" /></label><label><span>ID Pelanggan</span><input value={idPelanggan} onChange={(e) => setIdPelanggan(e.target.value)} placeholder="ID pelanggan" /></label></div><label><span>Alamat Pelanggan</span><textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={2} placeholder="Alamat pelanggan / lokasi pekerjaan" /></label><div className="form-grid usage-add-grid"><label><span>Material dari Tas *</span><select value={selectedBagId} onChange={(e) => setSelectedBagId(e.target.value)} disabled={loading}><option value="">Pilih material</option>{availableBagItems.map((item) => <option key={item.id} value={item.id}>{item.material_nama} {item.serial_number ? `| SN: ${item.serial_number}` : ""} | Stok: {item.remaining_qty}</option>)}</select></label><label><span>Qty *</span><input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label><button className="btn-dark align-end" type="button" onClick={addItem}>Tambah</button></div>{items.length > 0 && <div className="mini-table-wrap"><table className="table compact"><thead><tr><th>Material</th><th>Serial Number</th><th>Qty</th><th>Aksi</th></tr></thead><tbody>{items.map((item) => <tr key={item.bag_id}><td>{item.label}</td><td>{item.serial_number || "-"}</td><td>{item.qty}</td><td><button className="btn-danger-small" type="button" onClick={() => setItems((prev) => prev.filter((row) => row.bag_id !== item.bag_id))}>Hapus</button></td></tr>)}</tbody></table></div>}<label><span>Root Cause *</span><textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} placeholder="Jelaskan penyebab dan pekerjaan yang dilakukan" required /></label><label><span>Foto Eviden *</span><input id="usage-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} required />{foto && <img className="upload-preview" src={URL.createObjectURL(foto)} alt="Preview foto eviden" />}</label></div><div className="modal-footer"><button className="btn-primary" type="submit" disabled={submitting || loading}>{submitting ? "Menyimpan penggunaan..." : "Kirim Laporan"}</button></div></form></div></div>}
  </div>;
}
