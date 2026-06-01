"use client";

import { KeyboardEvent, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Material } from "@/types/database";
import { normalizeCode } from "@/lib/normalize";

const kondisiOptions = ["BAIK", "RUSAK", "REKONDISI"];
const satuanOptions = ["PCS", "UNIT", "METER", "ROLL", "SET", "BUAH"];

type FormState = { material_code: string; nama: string; merk: string; satuan: string; kondisi_default: string; min_stock: string; wajib_sn: boolean; qty_awal: string; serial_numbers: string[] };
type Step = 1 | 2;

const emptyForm: FormState = { material_code: "", nama: "", merk: "", satuan: "PCS", kondisi_default: "BAIK", min_stock: "0", wajib_sn: false, qty_awal: "0", serial_numbers: [""] };

export function MaterialsClient({ initialMaterials }: { initialMaterials: Material[] }) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [step, setStep] = useState<Step>(1);
  const serialRefs = useRef<Array<HTMLInputElement | null>>([]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return materials;
    return materials.filter((m) => [m.material_code, m.nama, m.merk, m.satuan, m.kondisi_default].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [materials, query]);

  async function refresh() {
    const res = await fetch("/api/materials", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setMaterials(json.data);
  }

  function closeModal() { setOpen(false); setForm(emptyForm); setFormError(""); setStep(1); serialRefs.current = []; }
  function openModal() { setForm(emptyForm); setFormError(""); setStep(1); setOpen(true); }

  function validateBase() {
    const min = Number(form.min_stock);
    const qty = Number(form.qty_awal);
    if (!form.material_code.trim()) return "Material ID wajib diisi.";
    if (!form.nama.trim()) return "Nama material wajib diisi.";
    if (!form.merk.trim()) return "Merk wajib diisi.";
    if (!form.satuan.trim()) return "Satuan wajib diisi.";
    if (!form.kondisi_default.trim()) return "Kondisi default wajib diisi.";
    if (!Number.isFinite(min) || min < 0) return "Minimum stok harus angka dan tidak boleh negatif.";
    if (!form.wajib_sn && (!Number.isFinite(qty) || qty < 0)) return "Qty awal harus angka dan tidak boleh negatif.";
    return "";
  }

  function validate() {
    const base = validateBase();
    if (base) return base;
    if (form.wajib_sn) {
      const sn = form.serial_numbers.map(normalizeCode).filter(Boolean);
      if (sn.length === 0) return "Material wajib SN minimal harus memiliki satu serial number.";
      if (new Set(sn).size !== sn.length) return "Serial number duplikat di form.";
    }
    return "";
  }

  function goStep2() {
    const err = validateBase();
    if (err) { setFormError(err); toast.error(err); return; }
    setFormError(""); setStep(2);
    setTimeout(() => serialRefs.current[0]?.focus(), 80);
  }

  function updateSerial(index: number, value: string) {
    const next = [...form.serial_numbers];
    next[index] = value.toUpperCase();
    setForm({ ...form, serial_numbers: next });
  }

  function removeSerial(index: number) {
    const next = form.serial_numbers.filter((_, i) => i !== index);
    setForm({ ...form, serial_numbers: next.length ? next : [""] });
    setTimeout(() => serialRefs.current[Math.max(0, index - 1)]?.focus(), 50);
  }

  function addSerialAndFocus(index?: number) {
    setForm((current) => ({ ...current, serial_numbers: [...current.serial_numbers, ""] }));
    setTimeout(() => serialRefs.current[index == null ? form.serial_numbers.length : index + 1]?.focus(), 50);
  }

  function handleSerialKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = normalizeCode(form.serial_numbers[index]);
    if (!value) return;
    if (index === form.serial_numbers.length - 1) addSerialAndFocus(index);
    else serialRefs.current[index + 1]?.focus();
  }

  async function submit() {
    const err = validate();
    if (err) { setFormError(err); toast.error(err); return; }
    setLoading(true); setFormError("");
    try {
      const payload = { material_code: normalizeCode(form.material_code), nama: form.nama.trim(), merk: form.merk.trim(), satuan: normalizeCode(form.satuan), kondisi_default: normalizeCode(form.kondisi_default), min_stock: Number(form.min_stock), wajib_sn: form.wajib_sn, qty_awal: form.wajib_sn ? 0 : Number(form.qty_awal), serial_numbers: form.wajib_sn ? form.serial_numbers.map(normalizeCode).filter(Boolean) : [] };
      const res = await fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan material.");
      toast.success("Material berhasil disimpan."); closeModal(); await refresh();
    } catch (error) { const message = error instanceof Error ? error.message : "Gagal menyimpan material."; setFormError(message); toast.error(message); }
    finally { setLoading(false); }
  }

  const duplicateSn = getDuplicateSerials(form.serial_numbers);
  const validSnCount = form.serial_numbers.map(normalizeCode).filter(Boolean).length;

  return <>
    <section className="card">
      <div className="section-header"><div className="section-title"><h3>Daftar Master Material</h3><p>Material, stok gudang, dan serial number tersimpan konsisten dalam database.</p></div><button className="btn-primary" onClick={openModal}><Plus size={16} /> Tambah Material</button></div>
      <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari material, merk, kode..." /></div></div><button className="btn-ghost" onClick={refresh}><RefreshCcw size={15} /> Refresh</button></div>
      <div className="table-wrap"><table><thead><tr><th>Material ID</th><th>Nama Material</th><th>Merk</th><th>Satuan</th><th>Kondisi</th><th>Min Stok</th><th>Wajib SN</th><th>Stok Gudang</th><th>Serial</th><th>Status</th></tr></thead><tbody>{filtered.map((m) => <tr key={m.id}><td><strong>{m.material_code}</strong></td><td>{m.nama}</td><td>{m.merk}</td><td>{m.satuan}</td><td>{m.kondisi_default}</td><td>{m.min_stock}</td><td><span className={m.wajib_sn ? "badge badge-warning" : "badge badge-muted"}>{m.wajib_sn ? "YA" : "TIDAK"}</span></td><td><strong>{m.gudang_qty ?? 0}</strong></td><td>{m.serial_count ?? 0}</td><td><span className={m.is_active ? "badge badge-success" : "badge badge-danger"}>{m.is_active ? "Aktif" : "Nonaktif"}</span></td></tr>)}{filtered.length === 0 && <tr><td colSpan={10}><div className="empty-state">Belum ada data material.</div></td></tr>}</tbody></table></div>
    </section>
    {open && <div className="modal-backdrop"><div className="modal material-step-modal"><div className="modal-header"><div><h3 className="modal-title">Tambah Material</h3><div className="modal-subtitle">Tahap {step} dari 2 • {step === 1 ? "Identitas material dan stok awal." : "Pengaturan serial number / qty awal."}</div></div><button className="btn-ghost" onClick={closeModal} disabled={loading}><X size={16} /></button></div><div className="material-stepper"><span className={step === 1 ? "active" : "done"}>1. Data Material</span><i /><span className={step === 2 ? "active" : ""}>2. Stok & Serial</span></div><div className="modal-body material-step-body">{step === 1 ? <div className="form-grid material-compact-grid"><Field label="Material ID / Kode Material"><input className="form-control" value={form.material_code} onChange={(e) => setForm({ ...form, material_code: e.target.value.toUpperCase() })} placeholder="ONT-001" autoFocus /></Field><Field label="Nama Material"><input className="form-control" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Optical Network Terminal" /></Field><Field label="Merk"><input className="form-control" value={form.merk} onChange={(e) => setForm({ ...form, merk: e.target.value })} placeholder="Huawei" /></Field><Field label="Satuan"><select className="form-select" value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })}>{satuanOptions.map(o => <option key={o}>{o}</option>)}</select></Field><Field label="Kondisi Default"><select className="form-select" value={form.kondisi_default} onChange={(e) => setForm({ ...form, kondisi_default: e.target.value })}>{kondisiOptions.map(o => <option key={o}>{o}</option>)}</select></Field><Field label="Minimum Stok"><input className="form-control" type="number" min={0} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field></div> : <div className="material-stock-step"><div className="panel material-stock-panel"><div className="panel-title">Pengaturan Stok Awal</div><label className="check-row"><input type="checkbox" checked={form.wajib_sn} onChange={(e) => setForm({ ...form, wajib_sn: e.target.checked, serial_numbers: e.target.checked ? form.serial_numbers : [""], qty_awal: e.target.checked ? "0" : form.qty_awal })} /> Material wajib serial number</label>{form.wajib_sn ? <><div className="serial-toolbar"><strong>{validSnCount} serial valid</strong><span>Scanner barcode: setelah scan/Enter akan otomatis pindah ke baris berikutnya.</span></div><div className="serial-list compact-serial-list">{form.serial_numbers.map((sn, index) => { const normalized = normalizeCode(sn); const isDup = normalized && duplicateSn.has(normalized); return <div className="sn-row compact-sn-row" key={index}><span className="sn-index">{index + 1}</span><input ref={(el) => { serialRefs.current[index] = el; }} className="form-control" style={isDup ? { borderColor: "#EF4444", background: "#FFF5F5" } : undefined} value={sn} onChange={(e) => updateSerial(index, e.target.value)} onKeyDown={(e) => handleSerialKeyDown(e, index)} placeholder={`Serial Number ${index + 1}`} /> <button className="btn-danger-small" type="button" onClick={() => removeSerial(index)} disabled={form.serial_numbers.length <= 1}><Trash2 size={14} /></button>{isDup && <div className="error-text serial-error">Duplikat</div>}</div>; })}</div><button className="btn-dark" type="button" onClick={() => addSerialAndFocus()}>Tambah Baris SN</button><span className="form-hint">Qty stok awal material berserial otomatis sama dengan jumlah serial number valid.</span></> : <Field label="Qty Awal Gudang"><input className="form-control" type="number" min={0} value={form.qty_awal} onChange={(e) => setForm({ ...form, qty_awal: e.target.value })} /></Field>}</div></div>}{formError && <div className="error-text">{formError}</div>}</div><div className="modal-footer"><button className="btn-ghost" onClick={step === 1 ? closeModal : () => setStep(1)} disabled={loading}>{step === 1 ? "Batal" : <><ChevronLeft size={16}/> Kembali</>}</button>{step === 1 ? <button className="btn-primary" onClick={goStep2} disabled={loading}>Lanjut <ChevronRight size={16}/></button> : <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? "Menyimpan..." : "Simpan Material"}</button>}</div></div></div>}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-field"><span className="form-label">{label}</span>{children}</label>; }
function getDuplicateSerials(values: string[]) { const seen = new Set<string>(); const dup = new Set<string>(); values.map(normalizeCode).filter(Boolean).forEach((v) => { if (seen.has(v)) dup.add(v); seen.add(v); }); return dup; }
