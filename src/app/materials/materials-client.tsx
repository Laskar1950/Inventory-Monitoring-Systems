"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X, Trash2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import type { Material } from "@/types/database";
import { normalizeCode } from "@/lib/normalize";

const kondisiOptions = ["BAIK", "RUSAK", "REKONDISI"];
const satuanOptions = ["PCS", "UNIT", "METER", "ROLL", "SET", "BUAH"];

type FormState = {
  material_code: string;
  nama: string;
  merk: string;
  satuan: string;
  kondisi_default: string;
  min_stock: string;
  wajib_sn: boolean;
  qty_awal: string;
  serial_numbers: string[];
};

const emptyForm: FormState = {
  material_code: "",
  nama: "",
  merk: "",
  satuan: "PCS",
  kondisi_default: "BAIK",
  min_stock: "0",
  wajib_sn: false,
  qty_awal: "0",
  serial_numbers: [""],
};

export function MaterialsClient({ initialMaterials }: { initialMaterials: Material[] }) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");

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

  function closeModal() {
    setOpen(false);
    setForm(emptyForm);
    setFormError("");
  }

  function validate() {
    const min = Number(form.min_stock);
    const qty = Number(form.qty_awal);
    if (!form.material_code.trim()) return "Material ID wajib diisi.";
    if (!form.nama.trim()) return "Nama material wajib diisi.";
    if (!form.merk.trim()) return "Merk wajib diisi.";
    if (!form.satuan.trim()) return "Satuan wajib diisi.";
    if (!form.kondisi_default.trim()) return "Kondisi default wajib diisi.";
    if (!Number.isFinite(min) || min < 0) return "Minimum stok harus angka dan tidak boleh negatif.";
    if (form.wajib_sn) {
      const sn = form.serial_numbers.map(normalizeCode).filter(Boolean);
      if (sn.length === 0) return "Material wajib SN minimal harus memiliki satu serial number.";
      if (new Set(sn).size !== sn.length) return "Serial number duplikat di form.";
    } else {
      if (!Number.isFinite(qty) || qty < 0) return "Qty awal harus angka dan tidak boleh negatif.";
    }
    return "";
  }

  async function submit() {
    const err = validate();
    if (err) {
      setFormError(err);
      toast.error(err);
      return;
    }

    setLoading(true);
    setFormError("");
    try {
      const payload = {
        material_code: normalizeCode(form.material_code),
        nama: form.nama.trim(),
        merk: form.merk.trim(),
        satuan: normalizeCode(form.satuan),
        kondisi_default: normalizeCode(form.kondisi_default),
        min_stock: Number(form.min_stock),
        wajib_sn: form.wajib_sn,
        qty_awal: form.wajib_sn ? 0 : Number(form.qty_awal),
        serial_numbers: form.wajib_sn ? form.serial_numbers.map(normalizeCode).filter(Boolean) : [],
      };

      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan material.");

      toast.success("Material berhasil disimpan.");
      closeModal();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan material.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const duplicateSn = getDuplicateSerials(form.serial_numbers);

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div className="section-title">
            <h3>Daftar Master Material</h3>
            <p>Material, stok gudang, dan serial number tersimpan konsisten dalam database.</p>
          </div>
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Tambah Material</button>
        </div>

        <div className="table-toolbar">
          <div className="search-input">
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} />
              <input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari material, merk, kode..." />
            </div>
          </div>
          <button className="btn-ghost" onClick={refresh}><RefreshCcw size={15} /> Refresh</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material ID</th>
                <th>Nama Material</th>
                <th>Merk</th>
                <th>Satuan</th>
                <th>Kondisi</th>
                <th>Min Stok</th>
                <th>Wajib SN</th>
                <th>Stok Gudang</th>
                <th>Serial</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.material_code}</strong></td>
                  <td>{m.nama}</td>
                  <td>{m.merk}</td>
                  <td>{m.satuan}</td>
                  <td>{m.kondisi_default}</td>
                  <td>{m.min_stock}</td>
                  <td><span className={m.wajib_sn ? "badge badge-warning" : "badge badge-muted"}>{m.wajib_sn ? "YA" : "TIDAK"}</span></td>
                  <td><strong>{m.gudang_qty ?? 0}</strong></td>
                  <td>{m.serial_count ?? 0}</td>
                  <td><span className={m.is_active ? "badge badge-success" : "badge badge-danger"}>{m.is_active ? "Aktif" : "Nonaktif"}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state">Belum ada data material.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Tambah Material</h3>
                <div className="modal-subtitle">Material berserial akan menghitung qty dari jumlah serial number valid.</div>
              </div>
              <button className="btn-ghost" onClick={closeModal} disabled={loading}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <Field label="Material ID / Kode Material"><input className="form-control" value={form.material_code} onChange={(e) => setForm({ ...form, material_code: e.target.value.toUpperCase() })} placeholder="ONT-001" /></Field>
                <Field label="Nama Material"><input className="form-control" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Optical Network Terminal" /></Field>
                <Field label="Merk"><input className="form-control" value={form.merk} onChange={(e) => setForm({ ...form, merk: e.target.value })} placeholder="Huawei" /></Field>
                <Field label="Satuan"><select className="form-select" value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })}>{satuanOptions.map(o => <option key={o}>{o}</option>)}</select></Field>
                <Field label="Kondisi Default"><select className="form-select" value={form.kondisi_default} onChange={(e) => setForm({ ...form, kondisi_default: e.target.value })}>{kondisiOptions.map(o => <option key={o}>{o}</option>)}</select></Field>
                <Field label="Minimum Stok"><input className="form-control" type="number" min={0} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field>
              </div>

              <div className="panel">
                <div className="panel-title">Pengaturan Stok Awal</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 12 }}>
                  <input type="checkbox" checked={form.wajib_sn} onChange={(e) => setForm({ ...form, wajib_sn: e.target.checked })} />
                  Material wajib serial number
                </label>

                {form.wajib_sn ? (
                  <>
                    {form.serial_numbers.map((sn, index) => {
                      const normalized = normalizeCode(sn);
                      const isDup = normalized && duplicateSn.has(normalized);
                      return (
                        <div className="sn-row" key={index}>
                          <div style={{ flex: 1 }}>
                            <input className="form-control" style={isDup ? { borderColor: "#EF4444", background: "#FFF5F5" } : undefined} value={sn} onChange={(e) => {
                              const next = [...form.serial_numbers];
                              next[index] = e.target.value.toUpperCase();
                              setForm({ ...form, serial_numbers: next });
                            }} placeholder={`SERIAL-NUMBER-${index + 1}`} />
                            {isDup && <div className="error-text">Serial number duplikat di form.</div>}
                          </div>
                          <button className="btn-danger" onClick={() => setForm({ ...form, serial_numbers: form.serial_numbers.filter((_, i) => i !== index) || [""] })} disabled={form.serial_numbers.length <= 1}><Trash2 size={15} /></button>
                        </div>
                      );
                    })}
                    <button className="btn-dark" onClick={() => setForm({ ...form, serial_numbers: [...form.serial_numbers, ""] })}>Tambah Baris SN</button>
                    <span className="form-hint">Qty stok awal material berserial = jumlah serial number valid.</span>
                  </>
                ) : (
                  <Field label="Qty Awal Gudang"><input className="form-control" type="number" min={0} value={form.qty_awal} onChange={(e) => setForm({ ...form, qty_awal: e.target.value })} /></Field>
                )}
              </div>

              {formError && <div className="error-text">{formError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeModal} disabled={loading}>Batal</button>
              <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? "Menyimpan..." : "Simpan Material"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="form-field"><span className="form-label">{label}</span>{children}</label>;
}

function getDuplicateSerials(values: string[]) {
  const seen = new Set<string>();
  const dup = new Set<string>();
  values.map(normalizeCode).filter(Boolean).forEach((v) => {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  });
  return dup;
}
