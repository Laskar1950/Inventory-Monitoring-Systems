"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { RequestDetail } from "@/types/database";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function statusClass(status: string) {
  if (status === "APPROVED") return "badge badge-success";
  if (status === "REJECTED") return "badge badge-danger";
  return "badge badge-warning";
}

export function ApprovalRequestsClient({ initialRequests }: { initialRequests: RequestDetail[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return requests;
    return requests.filter((r) => [r.request_code, r.teknisi_nama, r.status, ...r.items.map((i) => `${i.material_code} ${i.material_nama}`)].some((v) => String(v).toLowerCase().includes(q)));
  }, [requests, query]);

  async function refresh() {
    const res = await fetch("/api/requests", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setRequests(json.data);
  }

  async function process(id: string, action: "approve" | "reject") {
    const confirmText = action === "approve" ? "Setujui request ini dan pindahkan stok ke tas teknisi?" : "Tolak request ini?";
    if (!window.confirm(confirmText)) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catatan_admin: notes[id] ?? "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approval gagal diproses.");
      toast.success(action === "approve" ? "Request berhasil disetujui." : "Request berhasil ditolak.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval gagal diproses.");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <section className="card">
      <div className="section-header">
        <div className="section-title">
          <h3>Setujui Permintaan Material</h3>
          <p>Approve akan mengurangi stok gudang dan memasukkan material ke tas teknisi secara atomic.</p>
        </div>
      </div>
      <div className="table-toolbar">
        <div className="search-input"><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "#94A3B8" }} /><input className="form-control" style={{ paddingLeft: 38 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari request, teknisi, material..." /></div></div>
        <button className="btn-ghost" onClick={refresh}><RefreshCcw size={15} /> Refresh</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Kode</th><th>Tanggal</th><th>Teknisi</th><th>Material</th><th>Total</th><th>Status</th><th>Catatan Admin</th><th>Aksi</th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.request_code}</strong></td>
                <td>{formatDate(r.created_at)}</td>
                <td>{r.teknisi_nama}</td>
                <td>{r.items.map((i) => `${i.material_code} (${i.qty_requested})`).join(", ")}</td>
                <td><strong>{r.total_qty}</strong></td>
                <td><span className={statusClass(r.status)}>{r.status}</span></td>
                <td><input className="form-control" value={notes[r.id] ?? r.catatan_admin ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Opsional" disabled={r.status !== "PENDING" || loadingId === r.id} /></td>
                <td>
                  {r.status === "PENDING" ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn-primary" onClick={() => process(r.id, "approve")} disabled={loadingId === r.id}><CheckCircle2 size={15} /> Approve</button><button className="btn-danger" onClick={() => process(r.id, "reject")} disabled={loadingId === r.id}><XCircle size={15} /> Reject</button></div> : <span className="form-hint">Sudah diproses</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8}><div className="empty-state">Belum ada request material.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
