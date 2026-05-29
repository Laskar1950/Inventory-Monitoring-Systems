"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type SelectedItem = {
  bag_id: string;
  label: string;
  serial_number: string | null;
  wajib_sn: boolean;
  available_qty: number;
  qty: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function UsagesClient() {
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [bagRes, usageRes] = await Promise.all([fetch("/api/technician-bag"), fetch("/api/usages")]);
      const bagJson = await bagRes.json();
      const usageJson = await usageRes.json();
      if (!bagRes.ok) throw new Error(bagJson.error || "Gagal memuat tas teknisi.");
      if (!usageRes.ok) throw new Error(usageJson.error || "Gagal memuat penggunaan material.");
      setBagItems((bagJson.data || []).filter((item: TechnicianBagItem) => item.status === "ACTIVE" && item.qty > 0));
      setUsages(usageJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedBag = useMemo(
    () => bagItems.find((item) => item.id === selectedBagId),
    [bagItems, selectedBagId]
  );

  const availableBagItems = useMemo(() => {
    return bagItems.map((bag) => {
      const alreadySelected = items.find((item) => item.bag_id === bag.id)?.qty ?? 0;
      return { ...bag, remaining_qty: bag.qty - alreadySelected };
    }).filter((bag) => bag.remaining_qty > 0);
  }, [bagItems, items]);

  function addItem() {
    setError(null);
    if (!selectedBag) {
      setError("Material dari tas wajib dipilih.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Qty wajib lebih dari 0.");
      return;
    }
    if (selectedBag.wajib_sn && qty !== 1) {
      setError("Material berserial hanya boleh digunakan qty 1 per serial number.");
      return;
    }
    const existing = items.find((item) => item.bag_id === selectedBag.id);
    const nextQty = (existing?.qty ?? 0) + qty;
    if (nextQty > selectedBag.qty) {
      setError("Qty penggunaan tidak boleh melebihi stok tas.");
      return;
    }

    const label = `${selectedBag.material_code} - ${selectedBag.material_nama}`;
    setItems((prev) => {
      if (existing) {
        return prev.map((item) => item.bag_id === selectedBag.id ? { ...item, qty: nextQty } : item);
      }
      return [
        ...prev,
        {
          bag_id: selectedBag.id,
          label,
          serial_number: selectedBag.serial_number,
          wajib_sn: selectedBag.wajib_sn,
          available_qty: selectedBag.qty,
          qty,
        },
      ];
    });
    setSelectedBagId("");
    setQty(1);
  }

  function removeItem(bagId: string) {
    setItems((prev) => prev.filter((item) => item.bag_id !== bagId));
  }

  async function submitUsage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (items.length === 0) {
      setError("Minimal satu material harus ditambahkan.");
      return;
    }
    if (!foto) {
      setError("Foto eviden wajib diupload.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("no_tiket", noTiket);
      formData.append("nama_pelanggan", namaPelanggan);
      formData.append("id_pelanggan", idPelanggan);
      formData.append("alamat", alamat);
      formData.append("root_cause", rootCause);
      formData.append("items", JSON.stringify(items.map((item) => ({ bag_id: item.bag_id, qty: item.qty }))));
      formData.append("foto", foto);

      const response = await fetch("/api/usages", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal menyimpan penggunaan material.");

      setMessage(json.message || "Penggunaan material berhasil dicatat.");
      setItems([]);
      setNoTiket("");
      setNamaPelanggan("");
      setIdPelanggan("");
      setAlamat("");
      setRootCause("");
      setFoto(null);
      const fileInput = document.getElementById("usage-photo") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan penggunaan material.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="card">
        <div className="section-header">
          <div className="section-title">
            <h3>Input Penggunaan Material</h3>
            <p>Pilih material dari Tas Saya, isi tiket/pelanggan, lalu upload foto eviden.</p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => void loadData()} disabled={loading || submitting}>Refresh</button>
        </div>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={submitUsage} className="form-stack">
          <div className="form-grid three">
            <label>
              <span>Nomor Tiket *</span>
              <input value={noTiket} onChange={(e) => setNoTiket(e.target.value)} placeholder="Contoh: TIK-001" required />
            </label>
            <label>
              <span>Nama Pelanggan</span>
              <input value={namaPelanggan} onChange={(e) => setNamaPelanggan(e.target.value)} placeholder="Nama pelanggan" />
            </label>
            <label>
              <span>ID Pelanggan</span>
              <input value={idPelanggan} onChange={(e) => setIdPelanggan(e.target.value)} placeholder="ID pelanggan" />
            </label>
          </div>

          <label>
            <span>Alamat</span>
            <textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={2} placeholder="Alamat pelanggan / lokasi pekerjaan" />
          </label>

          <div className="form-grid usage-add-grid">
            <label>
              <span>Material dari Tas *</span>
              <select value={selectedBagId} onChange={(e) => setSelectedBagId(e.target.value)} disabled={loading}>
                <option value="">Pilih material</option>
                {availableBagItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.material_code} - {item.material_nama} {item.serial_number ? `| SN: ${item.serial_number}` : ""} | Stok: {item.remaining_qty}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Qty *</span>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </label>
            <button className="btn-dark align-end" type="button" onClick={addItem}>Tambah</button>
          </div>

          {items.length > 0 && (
            <div className="mini-table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Serial Number</th>
                    <th>Qty</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.bag_id}>
                      <td>{item.label}</td>
                      <td>{item.serial_number || "-"}</td>
                      <td>{item.qty}</td>
                      <td><button className="btn-danger-small" type="button" onClick={() => removeItem(item.bag_id)}>Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <label>
            <span>Root Cause *</span>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} placeholder="Jelaskan penyebab dan pekerjaan yang dilakukan" required />
          </label>

          <label>
            <span>Foto Eviden *</span>
            <input id="usage-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} required />
          </label>

          <button className="btn-primary" type="submit" disabled={submitting || loading}>
            {submitting ? "Menyimpan..." : "Kirim Laporan"}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Riwayat Penggunaan</h3>
          <p>Data yang sudah dikirim akan masuk ke laporan pemakaian Admin dan monitoring Supervisor.</p>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Tanggal</th>
                <th>Tiket</th>
                <th>Pelanggan</th>
                <th>Material</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}>Memuat data...</td></tr>
              ) : usages.length === 0 ? (
                <tr><td colSpan={6}>Belum ada penggunaan material.</td></tr>
              ) : usages.map((usage) => (
                <tr key={usage.id}>
                  <td><strong>{usage.usage_code}</strong></td>
                  <td>{formatDate(usage.created_at)}</td>
                  <td>{usage.no_tiket}</td>
                  <td>{usage.nama_pelanggan || "-"}</td>
                  <td>{usage.materials_used || `${usage.item_count} item`}</td>
                  <td>{usage.total_qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
