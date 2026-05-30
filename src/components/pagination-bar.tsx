"use client";

type Meta = { page: number; limit: number; total: number; totalPages: number };

export function PaginationBar({ meta, loading, onPageChange }: { meta: Meta; loading?: boolean; onPageChange: (page: number) => void }) {
  return <div className="pagination-row"><span>Halaman {meta.page} dari {meta.totalPages} - {meta.total} data</span><div><button className="btn-secondary" disabled={loading || meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>Sebelumnya</button><button className="btn-secondary" disabled={loading || meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>Berikutnya</button></div></div>;
}
