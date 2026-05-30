import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPagination, paginationMeta } from "@/lib/pagination";

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN") return NextResponse.json({ error: "Akses laporan ditolak." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start_date");
  const end = searchParams.get("end_date");
  const teknisiId = searchParams.get("teknisi_id");
  const keyword = searchParams.get("keyword")?.trim() || null;
  if (start && end && start > end) return NextResponse.json({ error: "Tanggal mulai tidak boleh lebih besar dari tanggal akhir." }, { status: 400 });

  const { page, limit, from } = getPagination(request, 25, 100);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("list_usage_report_page", {
    p_keyword: keyword,
    p_start_date: start || null,
    p_end_date: end || null,
    p_teknisi_id: teknisiId && teknisiId !== "ALL" ? teknisiId : null,
    p_limit: limit,
    p_offset: from,
  });
  if (error) return NextResponse.json({ error: "Gagal memuat preview laporan." }, { status: 500 });

  const rows = data ?? [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
  const cleaned = rows.map(({ total_count, ...row }: any) => row);
  const totalQty = cleaned.reduce((sum: number, row: any) => sum + Number(row.total_qty || 0), 0);
  return NextResponse.json({ data: cleaned, summary: { total_records: total, total_qty: totalQty }, meta: paginationMeta(total, page, limit) });
}
