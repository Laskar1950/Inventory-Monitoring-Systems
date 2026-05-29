"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

type ReturnSummary = {
  id: string;
  return_code: string;
  teknisi_nama: string;
  source_type: "BAG" | "MANUAL";
  status: string;
  kondisi: string;
  qty_return: number;
  foto_url: string;
  keterangan: string | null;
  catatan_admin: string | null;
  created_at: string;
  materials_returned: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "APPROVED") return "badge badge-success";
  if (status === "REJECTED") return "badge badge-danger";
  return "badge badge-warning";
}

export function ApprovalReturnsClient({ initialReturns }: { initialReturns: ReturnSummary[] }) {
  const [rows, setRows] = useState(initialReturns);
  const [query, setQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((row) => [row.return_code, row.teknisi_nama, row.source_type, row.status, row.kondisi, row.materials_returned ?? ""].some((value) => value.toLowerCase().includes(q)));
  }, [query, rows]);

  async function refresh() {
    const res = await fetch("/api/returns", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || "Gagal memuat pengembalian.");
    setRows(json.data || []);
  }

  async function processReturn(id: string, action: "approve" | "reject") {
    const note = window.prompt(action === "approve" ? "Catatan approval admin (opsional):" : "Catatan reject admin:") || "";
    if (action === "reject" && !note.trim()) return toast.error("Catatan reject wajib diisi agar teknisi memahami alasannya.");
    setProcessingId(id);
    try {
      const res = await fetch(`/api/returns/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catatan_admin: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memproses pengembalian.");
      toast.success(json.message || "Approval berhasil diproses.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses pengembalian.");
    } finally {
      setProcessingId(null);
    }
  }

  return <section className="card">
    <div className="section-header">
      <div className="section-title"><h3>Setujui Pengembalian</h3><p>Approve akan menambah stok gudang secara atomic dan memperbarui status serial number.</p></div>
      <button className="btn-ghost" onClick={refresh}><RefreshCcw size={15}/> Refresh</button>
    </div>
    <div className="table-toolbar"><div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }}/><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari return, teknisi, material, status..."/></div></div></div>
    <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Tanggal</th><th>Teknisi</th><th>Sumber</th><th>Material</th><th>Qty</th><th>Kondisi</th><th>Status</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.return_code}</strong></td><td>{formatDate(row.created_at)}</td><td>{row.teknisi_nama}</td><td>{row.source_type}</td><td>{row.materials_returned || "-"}</td><td><strong>{row.qty_return}</strong></td><td>{row.kondisi}</td><td><span className={statusClass(row.status)}>{row.status}</span></td><td>{row.keterangan || "-"}</td><td>{row.status === "PENDING" ? <div className="action-row"><button className="btn-success-small" disabled={processingId === row.id} onClick={() => processReturn(row.id, "approve")}><CheckCircle2 size={14}/> Approve</button><button className="btn-danger-small" disabled={processingId === row.id} onClick={() => processReturn(row.id, "reject")}><XCircle size={14}/> Reject</button></div> : <span className="text-muted">Selesai</span>}</td></tr>)}{filtered.length === 0 && <tr><td colSpan={10}><div className="empty-state">Belum ada pengembalian material.</div></td></tr>}</tbody></table></div>
  </section>;
}
