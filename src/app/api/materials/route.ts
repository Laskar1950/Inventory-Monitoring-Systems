import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode, normalizeText } from "@/lib/normalize";
import { getPagination, paginationMeta } from "@/lib/pagination";

const conditionOptions = new Set(["New", "Ex-Project", "Rusak"]);

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

const serialUpdateSchema = z.object({ id: z.string().uuid(), serial_number: z.string().min(1) });

const updateSchema = z.object({
  id: z.string().uuid(),
  material_code: z.string().min(1),
  nama: z.string().min(1),
  merk: z.string().min(1),
  satuan: z.string().min(1),
  kondisi_default: z.string().min(1),
  min_stock: z.number().min(0),
  serial_numbers: z.array(serialUpdateSchema).optional().default([]),
});

function normalizeCondition(value: string) {
  const raw = value.trim().toLowerCase();
  if (raw === "new") return "New";
  if (raw === "ex-project" || raw === "ex project" || raw === "ex_project") return "Ex-Project";
  if (raw === "rusak") return "Rusak";
  return value.trim();
}

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN" && profile.role !== "SUPERVISOR") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const supabase = createAdminClient();
  if (id) {
    const [{ data: material, error: materialError }, { data: serials, error: serialError }] = await Promise.all([
      supabase.from("materials_with_stock").select("id,material_code,nama,merk,satuan,kondisi_default,min_stock,wajib_sn,is_active,created_at,updated_at,gudang_qty,serial_count").eq("id", id).single(),
      supabase.from("material_serial_numbers").select("id,serial_number,status,location_type,kondisi,created_at").eq("material_id", id).order("serial_number"),
    ]);
    if (materialError) return NextResponse.json({ error: "Material tidak ditemukan." }, { status: 404 });
    if (serialError) return NextResponse.json({ error: "Gagal memuat serial number." }, { status: 500 });
    return NextResponse.json({ data: material, serials: serials || [] });
  }

  const { page, limit, from, to } = getPagination(request, 25, 100);
  const { data, error, count } = await supabase
    .from("materials_with_stock")
    .select("id,material_code,nama,merk,satuan,kondisi_default,min_stock,wajib_sn,is_active,created_at,updated_at,gudang_qty,serial_count", { count: "exact" })
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return NextResponse.json({ error: "Gagal memuat data material." }, { status: 500 });
  return NextResponse.json({ data, meta: paginationMeta(count, page, limit) });
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh menambah material." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = materialSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload material tidak valid." }, { status: 400 });
  const input = parsed.data;
  const condition = normalizeCondition(input.kondisi_default);
  if (!conditionOptions.has(condition)) return NextResponse.json({ error: "Kondisi material harus New, Ex-Project, atau Rusak." }, { status: 400 });
  const serials = input.serial_numbers.map(normalizeCode).filter(Boolean);
  const uniqueSerials = new Set(serials);
  if (input.wajib_sn && serials.length === 0) return NextResponse.json({ error: "Material wajib SN minimal harus memiliki satu serial number." }, { status: 400 });
  if (uniqueSerials.size !== serials.length) return NextResponse.json({ error: "Serial number duplikat di form." }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_material_with_initial_stock", { p_material_code: normalizeCode(input.material_code), p_nama: normalizeText(input.nama), p_merk: normalizeText(input.merk), p_satuan: normalizeCode(input.satuan), p_kondisi_default: condition, p_min_stock: input.min_stock, p_wajib_sn: input.wajib_sn, p_qty_awal: input.wajib_sn ? serials.length : input.qty_awal, p_serial_numbers: serials, p_created_by: profile.id });
  if (error) return NextResponse.json({ error: error.message || "Gagal menyimpan material." }, { status: 400 });
  return NextResponse.json({ data, message: "Material berhasil disimpan." }, { status: 201 });
}

export async function PUT(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh mengedit material." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload edit material tidak valid." }, { status: 400 });
  const input = parsed.data;
  const condition = normalizeCondition(input.kondisi_default);
  if (!conditionOptions.has(condition)) return NextResponse.json({ error: "Kondisi material harus New, Ex-Project, atau Rusak." }, { status: 400 });

  const serials = input.serial_numbers.map((s) => ({ ...s, serial_number: normalizeCode(s.serial_number) })).filter((s) => s.serial_number);
  if (new Set(serials.map((s) => s.serial_number)).size !== serials.length) return NextResponse.json({ error: "Serial number duplikat di form." }, { status: 400 });

  const supabase = createAdminClient();
  if (serials.length > 0) {
    const { data: duplicates, error: dupError } = await supabase
      .from("material_serial_numbers")
      .select("id,serial_number")
      .in("serial_number", serials.map((s) => s.serial_number));
    if (dupError) return NextResponse.json({ error: "Gagal validasi serial number." }, { status: 500 });
    const serialIdSet = new Set(serials.map((s) => s.id));
    const conflict = (duplicates || []).find((row) => !serialIdSet.has(row.id));
    if (conflict) return NextResponse.json({ error: `Serial number ${conflict.serial_number} sudah digunakan material lain.` }, { status: 400 });
  }

  const { error } = await supabase.from("materials").update({ material_code: normalizeCode(input.material_code), nama: normalizeText(input.nama), merk: normalizeText(input.merk), satuan: normalizeCode(input.satuan), kondisi_default: condition, min_stock: input.min_stock }).eq("id", input.id);
  if (error) return NextResponse.json({ error: error.message || "Gagal mengedit material." }, { status: 400 });
  await supabase.from("material_stocks").update({ kondisi: condition }).eq("material_id", input.id).eq("location_type", "GUDANG");
  await supabase.from("material_serial_numbers").update({ kondisi: condition }).eq("material_id", input.id).eq("location_type", "GUDANG");
  for (const serial of serials) {
    const { error: serialError } = await supabase.from("material_serial_numbers").update({ serial_number: serial.serial_number }).eq("id", serial.id).eq("material_id", input.id);
    if (serialError) return NextResponse.json({ error: serialError.message || "Gagal mengedit serial number." }, { status: 400 });
  }
  return NextResponse.json({ message: "Material berhasil diperbarui." });
}

export async function DELETE(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang boleh menghapus material." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID material wajib dikirim." }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("materials").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message || "Gagal menghapus material." }, { status: 400 });
  return NextResponse.json({ message: "Material berhasil dihapus dari daftar aktif." });
}
