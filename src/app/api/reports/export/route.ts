import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN") return NextResponse.json({ error: "Akses export ditolak." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start_date");
  const end = searchParams.get("end_date");
  const keyword = searchParams.get("keyword")?.trim();
  const teknisiId = searchParams.get("teknisi_id");
  if (start && end && start > end) return NextResponse.json({ error: "Tanggal mulai tidak boleh lebih besar dari tanggal akhir." }, { status: 400 });

  const supabase = createAdminClient();
  let query: any = supabase.from("material_usage_summary").select("*").order("created_at", { ascending: false });
  if (start) query = query.gte("created_at", `${start}T00:00:00`);
  if (end) query = query.lte("created_at", `${end}T23:59:59`);
  if (teknisiId && teknisiId !== "ALL") query = query.eq("teknisi_id", teknisiId);
  if (keyword) query = query.or(`usage_code.ilike.%${keyword}%,teknisi_nama.ilike.%${keyword}%,no_tiket.ilike.%${keyword}%,nama_pelanggan.ilike.%${keyword}%,materials_used.ilike.%${keyword}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal export laporan." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Preview laporan kosong, export dibatalkan." }, { status: 400 });

  const header = ["Kode", "Tanggal", "Teknisi", "Tiket", "Pelanggan", "ID Pelanggan", "Alamat", "Root Cause", "Material", "Total Qty"];
  const rows = data.map((r: any) => [r.usage_code, r.created_at, r.teknisi_nama, r.no_tiket, r.nama_pelanggan, r.id_pelanggan, r.alamat, r.root_cause, r.materials_used, r.total_qty].map(csvEscape).join(","));
  const csv = [header.map(csvEscape).join(","), ...rows].join("\n");
  const fileName = `laporan-pemakaian-${start || "awal"}-${end || "akhir"}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
