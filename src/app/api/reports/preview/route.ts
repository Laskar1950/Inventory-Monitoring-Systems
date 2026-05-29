import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function applyFilters(query: any, searchParams: URLSearchParams) {
  const start = searchParams.get("start_date");
  const end = searchParams.get("end_date");
  const teknisiId = searchParams.get("teknisi_id");
  const keyword = searchParams.get("keyword")?.trim();
  if (start) query = query.gte("created_at", `${start}T00:00:00`);
  if (end) query = query.lte("created_at", `${end}T23:59:59`);
  if (teknisiId && teknisiId !== "ALL") query = query.eq("teknisi_id", teknisiId);
  if (keyword) query = query.or(`usage_code.ilike.%${keyword}%,teknisi_nama.ilike.%${keyword}%,no_tiket.ilike.%${keyword}%,nama_pelanggan.ilike.%${keyword}%,materials_used.ilike.%${keyword}%`);
  return query;
}

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN") return NextResponse.json({ error: "Akses laporan ditolak." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start_date");
  const end = searchParams.get("end_date");
  if (start && end && start > end) return NextResponse.json({ error: "Tanggal mulai tidak boleh lebih besar dari tanggal akhir." }, { status: 400 });

  const supabase = createAdminClient();
  const query = applyFilters(supabase.from("material_usage_summary").select("*").order("created_at", { ascending: false }), searchParams);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat preview laporan." }, { status: 500 });
  const totalQty = (data || []).reduce((sum: number, row: any) => sum + Number(row.total_qty || 0), 0);
  return NextResponse.json({ data: data || [], summary: { total_records: data?.length || 0, total_qty: totalQty } });
}
