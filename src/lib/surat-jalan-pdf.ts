import PDFDocument from "pdfkit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestSummary } from "@/types/database";
import { drawPlnIconPlusLogo } from "@/lib/pln-logo";

type PdfItem = { material_nama: string; material_code: string; qty_requested: number; qty_approved: number | null; wajib_sn: boolean; kondisi?: string | null; serials: string[] };

function formatDate(value?: string | null) { if (!value) return "-"; return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)); }
function formatDateTime(value?: string | null) { if (!value) return "-"; return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function personLine(name?: string | null, phone?: string | null) { return [name || "-", phone || ""].filter(Boolean).join(" - "); }

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
  const { data: selected } = await supabase.from("material_request_selected_serial_detail").select("serial_number,material_id,request_item_id").eq("request_id", requestId).order("selected_at");
  const { data: moves } = await supabase.from("material_serial_movement_detail").select("serial_number,material_id,reference_item_id").eq("reference_type", "material_requests").eq("reference_id", requestId).eq("movement_type", "REQUEST_APPROVED");
  const serialRows = (moves && moves.length > 0) ? moves : (selected || []);
  const items: PdfItem[] = (rawItems ?? []).map((row: any) => {
    const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
    const serials = (serialRows ?? []).filter((m: any) => m.reference_item_id === row.id || m.request_item_id === row.id || m.material_id === row.material_id).map((m: any) => m.serial_number);
    return { material_nama: material?.nama ?? "-", material_code: material?.material_code ?? "-", qty_requested: row.qty_requested, qty_approved: row.qty_approved, wajib_sn: Boolean(material?.wajib_sn), kondisi: material?.kondisi_default ?? null, serials };
  }).filter((item) => Number(item.qty_approved ?? 0) > 0);
  return { request: request as RequestSummary, items };
}

async function drawSignature(doc: PDFKit.PDFDocument, supabase: SupabaseClient, x: number, y: number, w: number, imagePath?: string | null, tall = false) {
  const img = await loadImage(supabase, imagePath);
  const h = tall ? 58 : 46;
  if (img) { try { doc.image(img, x + 8, y + 2, { fit: [w - 16, h], align: "center", valign: "center" }); return; } catch {} }
  doc.font("Helvetica").fontSize(6).fillColor("#6b7280").text(imagePath ? "Ditandatangani digital" : "Menunggu tanda tangan", x, y + (tall ? 24 : 18), { width: w, align: "center" }).fillColor("#111827");
}

async function signBlock(doc: PDFKit.PDFDocument, supabase: SupabaseClient, x: number, y: number, w: number, title: string, role: string, name?: string | null, phone?: string | null, company?: string | null, imagePath?: string | null, tall = false) {
  const blockH = tall ? 138 : 122;
  doc.rect(x, y, w, blockH).stroke();
  doc.font("Helvetica-Bold").fontSize(6.5).text(title, x + 4, y + 6, { width: w - 8, align: "center", height: 18 });
  doc.font("Helvetica").fontSize(6.2).text(role, x + 4, y + 26, { width: w - 8, align: "center" });
  doc.rect(x + 7, y + 39, w - 14, tall ? 64 : 52).dash(2, { space: 2 }).strokeColor("#cbd5e1").stroke().undash().strokeColor("#111827");
  await drawSignature(doc, supabase, x + 7, y + 41, w - 14, imagePath, tall);
  doc.font("Helvetica-Bold").fontSize(6.2).text(personLine(name, phone), x + 4, y + (tall ? 108 : 95), { width: w - 8, align: "center" });
  doc.font("Helvetica").fontSize(5.8).text(company || "-", x + 4, y + (tall ? 120 : 106), { width: w - 8, align: "center" });
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
  const pageH = doc.page.height;
  const startX = 30;
  const usableW = pageW - 60;

  doc.font("Helvetica-Bold").fontSize(9).text("PT. PLN ICON PLUS", startX, 28);
  doc.font("Helvetica").fontSize(8).text("Inventory Monitoring Systems", startX, 41);
  drawPlnIconPlusLogo(doc, pageW - 205, 24, 0.9);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("BUKTI SERAH TERIMA BARANG", 0, 82, { width: pageW, align: "center", underline: true });
  doc.font("Helvetica").fontSize(8).text("Telah dilakukan serah terima barang/material sebagai berikut:", 0, 101, { width: pageW, align: "center", underline: true });

  let y = 123;
  const infoX = 160;
  const info = [["Nama", request.teknisi_nama], ["Nama Perusahaan", request.teknisi_company_name || "-"], ["Basecamp", request.basecamp || "-"], ["Referensi Pekerjaan / Proyek", request.referensi_pekerjaan || request.request_code], ["No. Surat Jalan", request.surat_jalan_number], ["Tanggal", formatDate(request.approved_at || request.created_at)]];
  for (const [label, value] of info) { doc.font("Helvetica-Bold").fontSize(8).text(label, infoX, y, { width: 145 }); doc.font("Helvetica").text(`: ${value}`, infoX + 150, y, { width: 290 }); y += 12; }

  y += 8;
  const widths = [28, 160, 72, 45, 64, usableW - 369];
  const headers = ["NO.", "Nama Barang / Material", "Kode SAP", "Jumlah", "Type", "Serial Number / Keterangan"];
  let x = startX;
  headers.forEach((h, i) => { doc.rect(x, y, widths[i], 18).fillAndStroke("#35bfd0", "#111827"); doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7).text(h, x + 2, y + 5, { width: widths[i] - 4, align: "center" }); x += widths[i]; });
  y += 18;
  const rows = items.length > 0 ? items.map((item, index) => [index + 1, item.material_nama, item.material_code, item.qty_approved ?? item.qty_requested, item.kondisi || "-", item.wajib_sn ? item.serials.join(", ") : "Non Serial"]) : [[1, "-", "-", 0, "-", "-"]];
  for (const row of rows) {
    const rowH = Math.max(16, Math.ceil(String(row[5]).length / 38) * 12);
    if (y + rowH > 500) { doc.addPage(); y = 40; }
    x = startX; widths.forEach((w, i) => { cell(doc, row[i], x, y, w, rowH, i === 0 || i === 3 || i === 4); x += w; }); y += rowH;
  }

  y += 10;
  if (y > 485) { doc.addPage(); y = 40; }
  doc.font("Helvetica-Bold").fontSize(7).text("Catatan: Barang telah diterima dan diperiksa oleh pihak penerima dalam kondisi baik dan lengkap.", startX, y, { underline: true });
  y += 16;

  doc.rect(startX, y, usableW, 58).stroke();
  const checklist = [["Material Telah Disiapkan", formatDateTime(request.admin_signed_at || request.approved_at), true], ["Waktu Pengambilan Material", "", false], ["Durasi Transaksi", "", false], ["Catatan", request.catatan_admin || "", false], ["Penerima", request.teknisi_nama || "-", false]] as const;
  let cy = y + 6;
  for (const [label, value, checked] of checklist) {
    doc.font("Helvetica-Bold").fontSize(6.5).text(label, startX + 8, cy, { width: 118 });
    doc.font("Helvetica").text(":", startX + 132, cy);
    doc.font("Helvetica-Bold").text(value, startX + 142, cy, { width: usableW - 176 });
    doc.rect(startX + usableW - 18, cy - 1, 8, 8).strokeColor("#f59e0b").stroke();
    if (checked) doc.font("Helvetica-Bold").fontSize(8).fillColor("#f59e0b").text("✓", startX + usableW - 17, cy - 3);
    doc.fillColor("#111827").strokeColor("#111827");
    cy += 10;
  }

  const signY = Math.max(y + 74, pageH - 168);
  const gap = 6;
  const w = (usableW - gap * 4) / 5;
  await signBlock(doc, supabase, startX, signY, w, "Yang Menyerahkan", "Admin Gudang", request.approved_by_nama, request.approved_by_phone_number, request.approved_by_company_name || "PLN ICONPLUS", request.admin_signature_url);
  await signBlock(doc, supabase, startX + (w + gap), signY, w, "Koordinator Mitra", "Koordinator", request.koordinator_nama, request.koordinator_phone_number, request.koordinator_company_name || "PLN ICONPLUS", request.koordinator_signature_url);
  await signBlock(doc, supabase, startX + (w + gap) * 2, signY, w, "Mengetahui & Menyetujui", "Supervisor", request.supervisor_nama, request.supervisor_phone_number, request.supervisor_company_name || "PT. PLN ICONPLUS", request.supervisor_signature_url);
  await signBlock(doc, supabase, startX + (w + gap) * 3, signY, w, "Yang Menerima", "Teknisi", request.teknisi_nama, request.teknisi_phone_number, request.teknisi_company_name || "-", request.teknisi_signature_url, true);
  await signBlock(doc, supabase, startX + (w + gap) * 4, signY, w, "BAST Final", "Penerimaan Material", request.received_at ? "Selesai" : "Menunggu", null, request.received_at ? formatDateTime(request.received_at) : "Menunggu penerimaan teknisi", null);

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
