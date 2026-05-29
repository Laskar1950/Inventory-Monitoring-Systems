"use client";

import { useMemo, useState } from "react";
import { RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
import type { TechnicianBagItem } from "@/types/database";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MyBagClient({ initialItems }: { initialItems: TechnicianBagItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((i) => [i.material_code, i.material_nama, i.merk, i.serial_number ?? "", i.source_request_code ?? "", i.kondisi].some((v) => String(v).toLowerCase().includes(q)));
  }, [items, query]);

  async function refresh() {
    const res = await fetch("/api/technician-bag", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || "Gagal memuat tas teknisi.");
    setItems(json.data);
  }

  return (
    <section className="card">
      <div className="section-header">
        <div className="section-title"><h3>Tas Saya</h3><p>Material aktif yang sudah disetujui Admin dan berada pada teknisi.</p></div>
      </div>
      <div className="table-toolbar">
        <div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari material, SN, request..." /></div></div>
        <button className="btn-ghost" onClick={refresh}><RefreshCcw size={15} /> Refresh</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Material ID</th><th>Nama Material</th><th>Merk</th><th>SN / Stok ID</th><th>Qty</th><th>Kondisi</th><th>Ref Request</th><th>Tanggal Masuk</th><th>Status</th></tr></thead><tbody>
        {filtered.map((item) => <tr key={item.id}><td><strong>{item.material_code}</strong></td><td>{item.material_nama}</td><td>{item.merk}</td><td>{item.serial_number ?? item.id.slice(0, 8).toUpperCase()}</td><td><strong>{item.qty}</strong> {item.satuan}</td><td>{item.kondisi}</td><td>{item.source_request_code ?? "-"}</td><td>{formatDate(item.created_at)}</td><td><span className="badge badge-success">{item.status}</span></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan={9}><div className="empty-state">Tas teknisi masih kosong.</div></td></tr>}
      </tbody></table></div>
    </section>
  );
}
