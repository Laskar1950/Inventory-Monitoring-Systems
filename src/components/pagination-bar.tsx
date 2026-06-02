"use client";

import { KeyboardEvent, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Meta = { page: number; limit: number; total: number; totalPages: number };

export function PaginationBar({ meta, loading, onPageChange }: { meta: Meta; loading?: boolean; onPageChange: (page: number) => void }) {
  const [value, setValue] = useState(String(meta.page));
  useEffect(() => setValue(String(meta.page)), [meta.page]);
  function go(page: number) {
    const safe = Math.min(Math.max(1, page), Math.max(1, meta.totalPages));
    onPageChange(safe);
  }
  function submit() {
    const page = Number(value);
    if (Number.isFinite(page)) go(page);
    else setValue(String(meta.page));
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submit();
  }
  return <div className="pagination-row compact-pagination"><button className="page-btn" disabled={loading || meta.page <= 1} onClick={() => go(meta.page - 1)}><ChevronLeft size={15} /></button><input className="page-input" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))} onBlur={submit} onKeyDown={onKeyDown} disabled={loading} /><span>/ {meta.totalPages}</span><button className="page-btn" disabled={loading || meta.page >= meta.totalPages} onClick={() => go(meta.page + 1)}><ChevronRight size={15} /></button></div>;
}
