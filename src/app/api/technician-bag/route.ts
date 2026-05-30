import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPagination, paginationMeta } from "@/lib/pagination";

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const { page, limit, from, to } = getPagination(request, 50, 150);
  const supabase = createAdminClient();
  let query = supabase
    .from("technician_bag_summary")
    .select("id,teknisi_id,teknisi_nama,material_id,material_code,material_nama,merk,satuan,wajib_sn,serial_number_id,serial_number,qty,kondisi,source_request_id,source_request_code,status,created_at,updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (profile.role === "TEKNISI") query = query.eq("teknisi_id", profile.id).eq("status", "ACTIVE");

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat tas teknisi." }, { status: 500 });
  return NextResponse.json({ data, meta: paginationMeta(count, page, limit) });
}
