"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Material, RequestDetail } from "@/types/database";

type CartItem = { material_id: string; qty: number };

function statusClass(status: string) {
  if (status === "APPROVED") return "badge badge-success";
  if (status === "REJECTED") return "badge badge-danger";
  return "badge badge-warning";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function RequestsClient({ initialMaterials, initialRequests }: { initialMaterials: Material[]; initialRequests: RequestDetail[] }) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [qty, setQty] = useState("1");
  const [catatan, setCatatan] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const activeMaterials = useMemo(() => materials.filter((m) => m.is_active && Number(m.gudang_qty ?? 0) > 0), [materials]);
  const selectedMaterial = activeMaterials.find((m) => m.id === selectedMaterialId);

  const filteredRequests = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return requests;
    return requests.filter((r) => [r.request_code, r.status, r.catatan_teknisi ?? "", ...r.items.map((i) => `${i.material_code} ${i.material_nama}`)].some((v) => v.toLowerCase().includes(q)));
  }, [query, requests]);

  async function refresh() {
    const [reqRes, matRes] = await Promise.all([fetch("/api/requests", { cache: "no-store" }), fetch("/api/materials", { cache: "no-store" })]);
    const reqJson = await reqRes.json();
    const matJson = await matRes.json();
    if (reqRes.ok) setRequests(reqJson.data);
    if (matRes.ok) setMaterials(matJson.data);
  }

  function addToCart() {
    if (!selectedMaterial) return toast.error("Material wajib dipilih.");
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Qty wajib lebih dari 0.");
    const existingQty = cart.find((item) => item.material_id === selectedMaterial.id)?.qty ?? 0;
    if (existingQty + n > Number(selectedMaterial.gudang_qty ?? 0)) return toast.error("Qty tidak boleh melebihi stok gudang.");
    setCart((prev) => {
      const found = prev.find((item) => item.material_id === selectedMaterial.id);
      if (found) return prev.map((item) => item.material_id === selectedMaterial.id ? { ...item, qty: item.qty + n } : item);
      return [...prev, { material_id: selectedMaterial.id, qty: n }];
    });
    setQty("1");
  }

  async function submit() {
    if (cart.length === 0) return toast.error("Request minimal memiliki satu item.");
    setLoading(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catatan_teknisi: catatan, items: cart }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim request material.");
      toast.success("Request berhasil dikirim.");
      setOpen(false);
      setCart([]);
      setCatatan("");
      setSelectedMaterialId("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim request material.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div className="section-title">
            <h3>Permintaan Material</h3>
            <p>Buat request material dari stok gudang. Request akan masuk ke Admin Gudang dengan status Pending.</p>
          </div>
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Tambah Permintaan</button>
        </div>
        <div className="table-toolbar">
          <div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari request, status, material..." /></div></div>
          <button className="btn-ghost" onClick={refresh}><RefreshCcw size={15} /> Refresh</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Kode Request</th><th>Tanggal</th><th>Item</th><th>Total Qty</th><th>Status</th><th>Catatan Admin</th></tr></thead>
            <tbody>
              {filteredRequests.map((r) => <tr key={r.id}><td><strong>{r.request_code}</strong></td><td>{formatDate(r.created_at)}</td><td>{r.items.map((i) => `${i.material_code} (${i.qty_requested})`).join(", ")}</td><td><strong>{r.total_qty}</strong></td><td><span className={statusClass(r.status)}>{r.status}</span></td><td>{r.catatan_admin ?? "-"}</td></tr>)}
              {filteredRequests.length === 0 && <tr><td colSpan={6}><div className="empty-state">Belum ada request material.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {open && (
        <div className="modal-backdrop"><div className="modal">
          <div className="modal-header"><div><h3 className="modal-title">Tambah Permintaan Material</h3><div className="modal-subtitle">Material sama akan digabung qty-nya secara otomatis.</div></div><button className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}><X size={16} /></button></div>
          <div className="modal-body">
            <div className="panel"><div className="panel-title">Pilih Material</div><div className="form-grid">
              <label><span className="field-label">Material</span><select className="form-select" value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)}><option value="">Pilih material</option>{activeMaterials.map((m) => <option key={m.id} value={m.id}>{m.material_code} - {m.nama} | Stok: {m.gudang_qty}</option>)}</select></label>
              <label><span className="field-label">Qty</span><input className="form-control" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
            </div>{selectedMaterial && <span className="form-hint">Stok tersedia: {selectedMaterial.gudang_qty} {selectedMaterial.satuan}. {selectedMaterial.wajib_sn ? "Material ini berserial." : "Material ini non-serial."}</span>}<button className="btn-dark" style={{ marginTop: 12 }} onClick={addToCart}>Tambah ke Daftar</button></div>
            <div className="panel"><div className="panel-title">Daftar Request</div>{cart.length === 0 ? <div className="empty-state">Belum ada material ditambahkan.</div> : <div className="table-wrap"><table><thead><tr><th>Material</th><th>Qty</th><th>Aksi</th></tr></thead><tbody>{cart.map((item) => { const material = materials.find((m) => m.id === item.material_id); return <tr key={item.material_id}><td><strong>{material?.material_code}</strong> - {material?.nama}</td><td>{item.qty}</td><td><button className="btn-danger" onClick={() => setCart(cart.filter((x) => x.material_id !== item.material_id))}><Trash2 size={14} /></button></td></tr>; })}</tbody></table></div>}</div>
            <label><span className="field-label">Catatan Teknisi</span><textarea className="form-control" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" /></label>
          </div>
          <div className="modal-footer"><button className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}>Batal</button><button className="btn-primary" onClick={submit} disabled={loading}>{loading ? "Mengirim..." : "Kirim Request"}</button></div>
        </div></div>
      )}
    </>
  );
}
