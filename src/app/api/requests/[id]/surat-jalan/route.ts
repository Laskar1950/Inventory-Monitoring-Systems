import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/requests/[id]/surat-jalan
 * Returns JSON data for surat jalan rendering.
 * Frontend will use this data to render HTML and trigger window.print()
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  // Ambil data request lengkap
  const { data: req, error: reqError } = await supabase
    .from("material_request_summary")
    .select("*")
    .eq("id", id)
    .single();

  if (reqError || !req) return NextResponse.json({ error: "Data surat jalan tidak ditemukan." }, { status: 404 });

  const allowedStatuses = ["WAITING_SIGNATURE", "KOORDINATOR_SIGNED", "MANAGER_SIGNED", "APPROVED"];
  if (!allowedStatuses.includes(req.status)) {
    return NextResponse.json({ error: "Surat jalan belum tersedia untuk request ini." }, { status: 400 });
  }

  // Ambil items
  const { data: items, error: itemsError } = await supabase
    .from("material_request_items")
    .select("id,material_id,qty_requested,qty_approved,materials(material_code,nama,satuan,wajib_sn)")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  if (itemsError) return NextResponse.json({ error: "Gagal memuat item surat jalan." }, { status: 500 });

  // Ambil serial numbers per item
  const itemIds = (items ?? []).map((i: any) => i.id);
  let serialMap: Record<string, string[]> = {};
  if (itemIds.length > 0) {
    const { data: serials } = await supabase
      .from("material_serial_numbers")
      .select("id,serial_number,source_request_item_id")
      .in("source_request_item_id", itemIds)
      .eq("status", "IN_TECHNICIAN_BAG");
    for (const sn of serials ?? []) {
      if (!serialMap[sn.source_request_item_id]) serialMap[sn.source_request_item_id] = [];
      serialMap[sn.source_request_item_id].push(sn.serial_number);
    }
  }

  // Generate signed URLs untuk tanda tangan
  async function getSignedUrl(path: string | null): Promise<string | null> {
    if (!path) return null;
    if (path.startsWith("digital:")) return null; // digital TTD tidak punya image
    if (path.startsWith("http")) return path;
    const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  const [koordinatorSignedUrl, managerSignedUrl] = await Promise.all([
    getSignedUrl(req.koordinator_signature_url),
    getSignedUrl(req.manager_signature_url),
  ]);

  // Parse digital signature info
  function parseDigitalSig(url: string | null) {
    if (!url?.startsWith("digital:")) return null;
    const parts = url.split(":");
    return { nama: parts[1] ?? "", timestamp: parts[2] ?? "" };
  }

  const suratJalanData = {
    request_code: req.request_code,
    surat_jalan_number: req.surat_jalan_number ?? req.request_code,
    teknisi_nama: req.teknisi_nama,
    teknisi_email: req.teknisi_email,
    basecamp: req.basecamp,
    referensi_pekerjaan: req.referensi_pekerjaan,
    created_at: req.created_at,
    approved_at: req.approved_at,
    // Admin
    admin_nama: req.approved_by_nama,
    // Koordinator
    koordinator_nama: req.koordinator_nama,
    koordinator_signed_at: req.koordinator_signed_at,
    koordinator_signature_url: koordinatorSignedUrl,
    koordinator_digital: parseDigitalSig(req.koordinator_signature_url),
    // Manager
    manager_nama: req.manager_nama,
    manager_signed_at: req.manager_signed_at,
    manager_signature_url: managerSignedUrl,
    manager_digital: parseDigitalSig(req.manager_signature_url),
    // Items
    items: (items ?? []).map((item: any, index: number) => {
      const material = Array.isArray(item.materials) ? item.materials[0] : item.materials;
      const sns = serialMap[item.id] ?? [];
      return {
        no: index + 1,
        material_nama: material?.nama ?? "-",
        material_code: material?.material_code ?? "-",
        qty: item.qty_approved ?? item.qty_requested,
        kondisi: "BAIK",
        serial_numbers: sns,
        wajib_sn: Boolean(material?.wajib_sn),
      };
    }),
  };

  return NextResponse.json({ data: suratJalanData });
}
