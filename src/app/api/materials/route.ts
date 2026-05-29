import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode, normalizeText } from "@/lib/normalize";

const materialSchema = z.object({
  material_code: z.string().min(1),
  nama: z.string().min(1),
  merk: z.string().min(1),
  satuan: z.string().min(1),
  kondisi_default: z.string().min(1),
  min_stock: z.number().min(0),
  wajib_sn: z.boolean(),
  qty_awal: z.number().min(0).default(0),
  serial_numbers: z.array(z.string()).default([]),
});

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN" && profile.role !== "SUPERVISOR") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("materials_with_stock")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Gagal memuat data material." }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh menambah material." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = materialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload material tidak valid." }, { status: 400 });
  }

  const input = parsed.data;
  const serials = input.serial_numbers.map(normalizeCode).filter(Boolean);
  const uniqueSerials = new Set(serials);

  if (input.wajib_sn && serials.length === 0) {
    return NextResponse.json({ error: "Material wajib SN minimal harus memiliki satu serial number." }, { status: 400 });
  }
  if (uniqueSerials.size !== serials.length) {
    return NextResponse.json({ error: "Serial number duplikat di form." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_material_with_initial_stock", {
    p_material_code: normalizeCode(input.material_code),
    p_nama: normalizeText(input.nama),
    p_merk: normalizeText(input.merk),
    p_satuan: normalizeCode(input.satuan),
    p_kondisi_default: normalizeCode(input.kondisi_default),
    p_min_stock: input.min_stock,
    p_wajib_sn: input.wajib_sn,
    p_qty_awal: input.wajib_sn ? serials.length : input.qty_awal,
    p_serial_numbers: serials,
    p_created_by: profile.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Gagal menyimpan material." }, { status: 400 });
  }

  return NextResponse.json({ data, message: "Material berhasil disimpan." }, { status: 201 });
}
