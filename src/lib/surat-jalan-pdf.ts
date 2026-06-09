import PDFDocument from "pdfkit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestSummary } from "@/types/database";

type PdfItem = { material_nama: string; material_code: string; qty_requested: number; qty_approved: number | null; wajib_sn: boolean; kondisi?: string | null; serials: string[] };

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}
function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function loadImage(supabase: SupabaseClient, path?: string | null) {
  if (!path || path.startsWith("digital") || path.startsWith("http")) return null;
  const lower = path.toLowerCase();
  if (!lower.endsWith(".png") && !lower.endsWith(".jpg") && !lower.endsWith(".jpeg")) return null;
  const { data } = await supabase.storage.from("signatures").download(path);
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}

function cell(doc: PDFKit.PDFDocument, value: string | number, x: number, y: number, w: number, h: number, center = false) {
  doc.rect(x, y, w, h).stroke();
  doc.font("Helvetica").fontSize(7).fillColor("#111827").text(String(value ?? ""), x + 3, y + 3, { width: w - 6, height: h - 5, align: center ? "center" : "left", ellipsis: true });
}

async function getData(supabase: SupabaseClient, requestId: string) {
  const { data: request, error } = await supabase.from("material_request_summary").select("*").eq("id", requestId).single();
  if (error || !request) throw new Error("Data Surat Jalan tidak ditemukan.");
  const { data: rawItems } = await supabase.from("material_request_items").select("id,material_id,qty_requested,qty_approved,materials(material_code,nama,wajib_sn,kondisi_default)").eq("request_id", requestId).order("created_at", { ascending: true });
  const { data: moves } = await supabase.from("material_serial_movement_detail").select("serial_number,material_id,reference_item_id").eq("reference_type", "material_requests").eq("reference_id", requestId).eq("movement_type", "REQUEST_APPROVED");
  const items: PdfItem[] = (rawItems ?? []).map((row: any) => {
    const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
    const serials = (moves ?? []).filter((m: any) => m.reference_item_id === row.id || m.material_id === row.material_id).map((m: any) => m.serial_number);
    return { material_nama: material?.nama ?? "-", material_code: material?.material_code ?? "-", qty_requested: row.qty_requested, qty_approved: row.qty_approved, wajib_sn: Boolean(material?.wajib_sn), kondisi: material?.kondisi_default ?? null, serials };
  });
  return { request: request as RequestSummary, items };
}

async function signBox(doc: PDFKit.PDFDocument, supabase: SupabaseClient, x: number, y: number, w: number, title: string, role: string, name?: string | null, date?: string | null, imagePath?: string | null) {
  doc.font("Helvetica-Bold").fontSize(8).text(title, x, y, { width: w, align: "center" });
  doc.font("Helvetica").fontSize(7).text(role, x, y + 11, { width: w, align: "center" });
  const img = await loadImage(supabase, imagePath);
  if (img) {
    try { doc.image(img, x + 8, y + 25, { fit: [w - 16, 40], align: "center" }); } catch { doc.fontSize(6).text("Tanda tangan tersimpan", x, y + 42, { width: w, align: "center" }); }
  } else {
    doc.fontSize(6).fillColor("#6b7280").text(imagePath ? "Ditandatangani digital" : "Menunggu tanda tangan", x, y + 42, { width: w, align: "center" }).fillColor("#111827");
  }
  doc.font("Helvetica-Bold").fontSize(7).text(name || "-", x, y + 70, { width: w, align: "center" });
  doc.font("Helvetica").fontSize(6).text(formatDateTime(date), x, y + 82, { width: w, align: "center" });
}

export async function generateSuratJalanPdf(supabase: SupabaseClient, requestId: string) {
  const { request, items } = await getData(supabase, requestId);
  if (request.status !== "COMPLETED") throw new Error("PDF final hanya dapat dibuat setelah Teknisi menerima material.");
  if (!request.surat_jalan_number) throw new Error("Nomor Surat Jalan belum tersedia.");

  const doc = new PDFDocument({ size: "LETTER", margin: 30, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });

  const pageW = doc.page.width;
  const startX = 30;
  const usableW = pageW - 60;

  doc.font("Helvetica-Bold").fontSize(9).text("PT. PLN ICON PLUS", startX, 28);
  doc.font("Helvetica").fontSize(8).text("Jl. Gatot Subroto, Jakarta Selatan", startX, 40).text("Inventory Monitoring Systems", startX, 51);
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#0284c7").text("PLN", pageW - 130, 28, { width: 70, align: "right" });
  doc.fontSize(10).fillColor("#6b7280").text("Icon Plus", pageW - 120, 52, { width: 90, align: "right" }).fillColor("#111827");
  doc.font("Helvetica-Bold").fontSize(14).text("BUKTI SERAH TERIMA BARANG", 0, 76, { width: pageW, align: "center", underline: true });
  doc.font("Helvetica").fontSize(8).text("Telah dilakukan serah terima barang/material sebagai berikut:", 0, 96, { width: pageW, align: "center", underline: true });

  let y = 118;
  const infoX = 175;
  const info = [["Nama", request.teknisi_nama], ["Nama Perusahaan", "PLN ICONPLUS"], ["Basecamp", request.basecamp || "-"], ["Referensi Pekerjaan / Proyek", request.referensi_pekerjaan || request.request_code], ["No. Surat Jalan", request.surat_jalan_number], ["Tanggal", formatDate(request.approved_at || request.created_at)]];
  for (const [label, value] of info) { doc.font("Helvetica-Bold").fontSize(8).text(label, infoX, y, { width: 145 }); doc.text(`: ${value}`, infoX + 150, y, { width: 280 }); y += 12; }

  y += 6;
  const widths = [28, 160, 72, 45, 64, usableW - 369];
  const headers = ["NO.", "Nama Barang / Material", "Kode SAP", "Jumlah", "Type", "Serial Number / Keterangan"];
  let x = startX;
  headers.forEach((h, i) => { doc.rect(x, y, widths[i], 18).fillAndStroke("#35bfd0", "#111827"); doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7).text(h, x + 2, y + 5, { width: widths[i] - 4, align: "center" }); x += widths[i]; });
  y += 18;
  const rows = items.map((item, index) => [index + 1, item.material_nama, item.material_code, item.qty_approved ?? item.qty_requested, item.kondisi || "-", item.wajib_sn ? item.serials.join(", ") : "Non Serial"]);
  while (rows.length < 30) rows.push([rows.length + 1, "", "", "", "", ""]);
  for (const row of rows.slice(0, 30)) { x = startX; widths.forEach((w, i) => { cell(doc, row[i], x, y, w, 14, i === 0 || i === 3 || i === 4); x += w; }); y += 14; }

  y += 8;
  doc.font("Helvetica-Bold").fontSize(7).text("Catatan: Barang/material diterima dan diserahkan dalam kondisi sesuai hasil pemeriksaan dan persetujuan pada sistem.", startX, y, { underline: true });
  y += 26;
  const sigW = usableW / 4;
  await signBox(doc, supabase, startX, y, sigW, "Yang Menyerahkan", "Admin Gudang", request.approved_by_nama, request.admin_signed_at || request.approved_at, request.admin_signature_url);
  await signBox(doc, supabase, startX + sigW, y, sigW, "Mengetahui", "Koordinator", request.koordinator_nama, request.koordinator_signed_at, request.koordinator_signature_url);
  await signBox(doc, supabase, startX + sigW * 2, y, sigW, "Menyetujui", "Supervisor", request.supervisor_nama, request.supervisor_signed_at, request.supervisor_signature_url);
  await signBox(doc, supabase, startX + sigW * 3, y, sigW, "Yang Menerima", "Teknisi", request.teknisi_nama, request.teknisi_signed_at || request.received_at, request.teknisi_signature_url);

  doc.end();
  const pdfBuffer = await done;
  const safeNumber = request.surat_jalan_number.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filePath = `${request.teknisi_id}/${safeNumber}.pdf`;
  const { error: uploadError } = await supabase.storage.from("surat-jalan").upload(filePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`Gagal upload PDF Surat Jalan: ${uploadError.message}`);
  const { error: updateError } = await supabase.from("material_requests").update({ surat_jalan_url: filePath, updated_at: new Date().toISOString() }).eq("id", requestId);
  if (updateError) throw new Error(`Gagal menyimpan URL PDF Surat Jalan: ${updateError.message}`);
  return { filePath, suratJalanNumber: request.surat_jalan_number };
}
