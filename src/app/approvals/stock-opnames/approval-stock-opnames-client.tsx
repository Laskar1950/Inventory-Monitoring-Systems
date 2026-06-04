"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCcw, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

type StockOpnameSummary = { id: string; so_code: string; teknisi_nama: string; status: string; catatan_teknisi: string | null; created_at: string; item_count: number; total_system_qty: number; total_physical_qty: number; total_selisih: number; problem_count: number; materials?: string | null };
type StockOpnameItem = { id: string; stock_opname_id: string; material_code: string; material_nama: string; merk: string; satuan: string; wajib_sn: boolean; serial_number: string | null; qty_system: number; qty_physical: number; selisih: number; kondisi_fisik: string; foto_url: string; status_review: "PENDING" | "APPROVED" | "REVISION" | "REJECTED_FINAL"; catatan_admin: string | null };
type ReviewState = Record<string, { status_review: "APPROVED" | "REVISION" | "REJECTED_FINAL"; catatan_admin: string }>;

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

function statusLabel(status: string, revisionCount?: number) {
  if (status === "PENDING") return "Pending Review";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED_FINAL") return "Rejected Final";
  if (status === "REVISION") {
    if (revisionCount && revisionCount > 0) return `${revisionCount} Material Perlu Revisi`;
    return "Perlu Revisi";
  }
  return status;
}

function statusClass(status: string) {
  return status === "APPROVED" ? "badge badge-success" :
         status === "PENDING"  ? "badge badge-warning" :
         status === "REVISION" ? "badge badge-danger" :
         "badge badge-danger";
}

function EvidencePhoto({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    if (!path) { setSrc(""); return; }
    if (path.startsWith("http")) { setSrc(path); return; }
    fetch(`/api/storage-url?bucket=stock-opname-evidence&path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((j) => { if (active) setSrc(j.signedUrl || ""); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [path]);
  if (!src) return <span className="muted-text">Tidak ada foto</span>;
  return <a href={src} target="_blank" rel="noreferrer"><img className="table-thumb so-photo-thumb" src={src} alt={alt} /></a>;
}

export function ApprovalStockOpnamesClient() {
  const [summaries, setSummaries] = useState<StockOpnameSummary[]>([]);
  const [items, setItems] = useState<StockOpnameItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"review" | "detail">("review");
  const [reviews, setReviews] = useState<ReviewState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/stock-opnames?limit=50", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal memuat stok opname.");
      setSummaries(json.data || []);
      setItems(json.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat stok opname.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const selectedSummary = useMemo(() => summaries.find((row) => row.id === selectedId) || null, [summaries, selectedId]);

  // Saat review PENDING: tampilkan semua item
  // Saat review ulang REVISION: tampilkan SEMUA item (supaya admin lihat konteks), tapi hanya item REVISION yang bisa diubah
  const selectedItems = useMemo(() => items.filter((item) => item.stock_opname_id === selectedId), [items, selectedId]);

  // Hitung berapa item REVISION per SO
  function getRevisionCount(soId: string) {
    return items.filter((item) => item.stock_opname_id === soId && item.status_review === "REVISION").length;
  }

  function openReview(summary: StockOpnameSummary, mode: "review" | "detail") {
    const initial: ReviewState = {};
    for (const item of items.filter((i) => i.stock_opname_id === summary.id)) {
      // Saat review PENDING: default semua APPROVED
      // Saat review ulang REVISION: pertahankan status existing, item REVISION default APPROVED
      const currentStatus = item.status_review;
      initial[item.id] = {
        status_review: (currentStatus === "APPROVED" || currentStatus === "REVISION" || currentStatus === "REJECTED_FINAL")
          ? (currentStatus === "REVISION" ? "APPROVED" : currentStatus)  // item REVISION default ke APPROVED saat review ulang
          : "APPROVED",
        catatan_admin: item.catatan_admin || "",
      };
    }
    setSelectedId(summary.id);
    setReviewMode(mode);
    setReviews(initial);
    setError(null);
  }

  function updateReview(itemId: string, patch: Partial<ReviewState[string]>) {
    setReviews((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  async function submitReview() {
    if (!selectedSummary) return;
    setError(null);

    // Saat review ulang REVISION: hanya kirim item yang masih REVISION (belum diselesaikan)
    const itemsToReview = selectedSummary.status === "REVISION"
      ? selectedItems.filter((item) => item.status_review === "REVISION")
      : selectedItems;

    const payload = itemsToReview.map((item) => ({
      item_id: item.id,
      status_review: reviews[item.id]?.status_review || "APPROVED",
      catatan_admin: reviews[item.id]?.catatan_admin || null,
    }));

    for (const item of payload) {
      if ((item.status_review === "REVISION" || item.status_review === "REJECTED_FINAL") && !item.catatan_admin?.trim()) {
        setError("Catatan admin wajib untuk item berstatus Revisi atau Rejected Final.");
        return;
      }
    }

    if (payload.length === 0) {
      setError("Tidak ada item yang perlu direview.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/stock-opnames/${selectedSummary.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: payload }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Gagal menyimpan review stok opname.");
      toast.success(json.message || "Review stok opname berhasil disimpan.");
      setSelectedId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan review stok opname.");
    } finally {
      setSubmitting(false);
    }
  }

  const canReview = selectedSummary?.status === "PENDING" || selectedSummary?.status === "REVISION";

  return (
    <section className="card clean-card-header approval-so-card">
      <div className="section-header">
        <div className="section-title">
          <h3>Setujui Stok Opname</h3>
          <p>Review laporan stok opname teknisi per item, lalu tentukan status akhir.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={() => void loadData()} disabled={loading || submitting}>
          <RefreshCcw size={15} /> Refresh
        </button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Kode SO</th>
              <th>Tanggal</th>
              <th>Teknisi</th>
              <th>Status</th>
              <th>Item</th>
              <th>Selisih</th>
              <th>Problem</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Memuat data...</td></tr>
            ) : summaries.length === 0 ? (
              <tr><td colSpan={8}>Belum ada stok opname.</td></tr>
            ) : summaries.map((row) => {
              const revCount = getRevisionCount(row.id);
              return (
                <tr key={row.id}>
                  <td><strong>{row.so_code}</strong></td>
                  <td>{formatDate(row.created_at)}</td>
                  <td>{row.teknisi_nama}</td>
                  <td>
                    <span className={statusClass(row.status)}>
                      {statusLabel(row.status, revCount)}
                    </span>
                  </td>
                  <td>{row.item_count}</td>
                  <td>{row.total_selisih}</td>
                  <td>{row.problem_count}</td>
                  <td>
                    <div className="action-row" style={{ gap: 6 }}>
                      {(row.status === "PENDING" || row.status === "REVISION") && (
                        <button
                          className="btn-primary-small"
                          type="button"
                          onClick={() => openReview(row, "review")}
                        >
                          {row.status === "PENDING" ? <><Eye size={14} /> Review</> : <><RotateCcw size={14} /> Review Revisi ({revCount})</>}
                        </button>
                      )}
                      <button
                        className="btn-secondary-small"
                        type="button"
                        onClick={() => openReview(row, "detail")}
                      >
                        <Eye size={14} /> Detail
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== MODAL REVIEW / REVIEW ULANG / DETAIL ===== */}
      {selectedSummary && (
        <div className="modal-backdrop request-detail-backdrop">
          <div className="modal stock-opname-review-modal">
            <div className="modal-header compact">
              <div>
                <h3 className="modal-title">
                  {reviewMode === "detail"
                    ? "Detail Stok Opname"
                    : selectedSummary.status === "REVISION"
                    ? `Review Ulang — ${getRevisionCount(selectedSummary.id)} Item Perlu Revisi`
                    : "Review Stok Opname"}
                </h3>
                <div className="modal-subtitle">
                  {selectedSummary.so_code} • {selectedSummary.teknisi_nama} • {formatDate(selectedSummary.created_at)}
                </div>
              </div>
              <button className="btn-ghost" type="button" onClick={() => setSelectedId(null)} disabled={submitting}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body stock-opname-review-body">
              {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}

              {selectedSummary.catatan_teknisi && (
                <div className="approval-note-box">
                  <strong>Catatan Teknisi</strong>
                  <p>{selectedSummary.catatan_teknisi}</p>
                </div>
              )}

              {/* Info banner saat review ulang revisi */}
              {reviewMode === "review" && selectedSummary.status === "REVISION" && (
                <div className="alert-info" style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, fontSize: "0.8rem", color: "#1d4ed8" }}>
                  ℹ️ Item yang sudah <strong>APPROVED</strong> sebelumnya tidak perlu direview ulang.
                  Hanya item berstatus <strong>Perlu Revisi</strong> di bawah yang akan diproses.
                </div>
              )}

              <div className="table-wrap compact-detail-table">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Serial Number</th>
                      <th>Qty Sistem</th>
                      <th>Qty Fisik</th>
                      <th>Selisih</th>
                      <th>Kondisi</th>
                      <th>Foto</th>
                      <th>Status Review</th>
                      <th>Catatan Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item) => {
                      // Saat review mode REVISION: hanya item REVISION yang bisa diubah
                      const isEditable = reviewMode === "review" &&
                        (selectedSummary.status === "PENDING" ||
                        (selectedSummary.status === "REVISION" && item.status_review === "REVISION"));

                      return (
                        <tr key={item.id} style={{
                          opacity: reviewMode === "review" && selectedSummary.status === "REVISION" && item.status_review !== "REVISION" ? 0.55 : 1,
                        }}>
                          <td>
                            <strong>{item.material_nama}</strong><br />
                            <span className="muted-text">{item.material_code}</span>
                          </td>
                          <td>{item.serial_number || "-"}</td>
                          <td>{item.qty_system}</td>
                          <td>{item.qty_physical}</td>
                          <td style={{ color: item.selisih !== 0 ? "var(--color-error, #dc2626)" : "inherit", fontWeight: item.selisih !== 0 ? 700 : 400 }}>
                            {item.selisih}
                          </td>
                          <td>{item.kondisi_fisik}</td>
                          <td><EvidencePhoto path={item.foto_url} alt={`Foto ${item.material_nama}`} /></td>
                          <td>
                            {isEditable ? (
                              <select
                                className="table-input"
                                value={reviews[item.id]?.status_review || "APPROVED"}
                                onChange={(e) => updateReview(item.id, { status_review: e.target.value as ReviewState[string]["status_review"] })}
                                disabled={submitting}
                              >
                                <option value="APPROVED">Approved</option>
                                <option value="REVISION">Revisi Lagi</option>
                                <option value="REJECTED_FINAL">Rejected Final</option>
                              </select>
                            ) : (
                              <span className={`badge ${
                                item.status_review === "APPROVED" ? "badge-success" :
                                item.status_review === "REVISION" ? "badge-danger" :
                                item.status_review === "REJECTED_FINAL" ? "badge-danger" :
                                "badge-warning"
                              }`}>
                                {item.status_review === "APPROVED" ? "Approved" :
                                 item.status_review === "REVISION" ? "Perlu Revisi" :
                                 item.status_review === "REJECTED_FINAL" ? "Rejected" :
                                 "Pending"}
                              </span>
                            )}
                          </td>
                          <td>
                            {isEditable ? (
                              <input
                                className="table-input"
                                value={reviews[item.id]?.catatan_admin || ""}
                                onChange={(e) => updateReview(item.id, { catatan_admin: e.target.value })}
                                placeholder="Wajib untuk Revisi/Rejected"
                                disabled={submitting}
                              />
                            ) : (
                              item.catatan_admin
                                ? <span style={{ color: "var(--color-error, #dc2626)", fontSize: "0.78rem" }}>{item.catatan_admin}</span>
                                : <span className="muted-text">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setSelectedId(null)} disabled={submitting}>
                Tutup
              </button>
              {canReview && reviewMode === "review" && (
                <button
                  className="btn-primary" type="button"
                  onClick={() => void submitReview()}
                  disabled={submitting}
                >
                  <Save size={16} />
                  {submitting
                    ? "Menyimpan..."
                    : selectedSummary.status === "REVISION"
                    ? `Simpan Review Ulang`
                    : "Simpan Review"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
