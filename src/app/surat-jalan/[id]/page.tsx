import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuratJalanPrintButton } from "./print-button";
import type { RequestSummary } from "@/types/database";

type ItemRow = { id: string; material_id: string; material_code: string; material_nama: string; qty_requested: number; qty_approved: number | null; status: string; wajib_sn: boolean; kondisi?: string | null; serials: string[] };
type PrintRow = { name: string; code: string; qty: number | string; type: string; serial: string };
type SignatureBlockProps = { title: string; role: string; name?: string | null; phone?: string | null; company?: string | null; signatureUrl?: string | null; signedSrc?: string | null };

function formatDate(value?: string | null) { if (!value) return "-"; return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)); }
function formatDateTime(value?: string | null) { if (!value) return "-"; return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function signatureText(path?: string | null) { if (!path) return "Menunggu tanda tangan"; if (path.startsWith("digital")) return "Ditandatangani digital"; return "Tanda tangan tersimpan"; }
function personLine(name?: string | null, phone?: string | null) { return [name || "-", phone || ""].filter(Boolean).join(" - "); }

async function getSignedSignatureUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("digital")) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

async function getSuratJalan(id: string) {
  const supabase = createAdminClient();
  const { data: request, error } = await supabase.from("material_request_summary").select("*").eq("id", id).single();
  if (error || !request) return null;

  const { data: rawItems } = await supabase.from("material_request_items").select("id,request_id,material_id,qty_requested,qty_approved,status,materials(material_code,nama,merk,satuan,wajib_sn,kondisi_default)").eq("request_id", id).order("created_at", { ascending: true });
  const { data: selected } = await supabase.from("material_request_selected_serial_detail").select("serial_number,material_id,request_item_id").eq("request_id", id).order("selected_at");
  const { data: moves } = await supabase.from("material_serial_movement_detail").select("serial_number,material_id,reference_item_id").eq("reference_type", "material_requests").eq("reference_id", id).eq("movement_type", "REQUEST_APPROVED");
  const serialRows = (moves && moves.length > 0) ? moves : (selected || []);

  const items: ItemRow[] = (rawItems ?? []).map((row: any) => {
    const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
    const serials = (serialRows ?? []).filter((m: any) => m.reference_item_id === row.id || m.request_item_id === row.id || m.material_id === row.material_id).map((m: any) => m.serial_number);
    return { id: row.id, material_id: row.material_id, material_code: material?.material_code ?? "-", material_nama: material?.nama ?? "-", qty_requested: row.qty_requested, qty_approved: row.qty_approved, status: row.status, wajib_sn: Boolean(material?.wajib_sn), kondisi: material?.kondisi_default ?? null, serials };
  }).filter((item) => Number(item.qty_approved ?? 0) > 0);

  const r = request as RequestSummary;
  const signatures = { admin: await getSignedSignatureUrl(r.admin_signature_url), koordinator: await getSignedSignatureUrl(r.koordinator_signature_url), supervisor: await getSignedSignatureUrl(r.supervisor_signature_url), teknisi: await getSignedSignatureUrl(r.teknisi_signature_url) };
  return { request: r, items, signatures };
}

function buildRows(items: ItemRow[]): PrintRow[] {
  const rows = items.map((item) => ({ name: item.material_nama, code: item.material_code, qty: item.qty_approved ?? item.qty_requested, type: item.kondisi || "-", serial: item.serials.length > 0 ? item.serials.join(", ") : item.wajib_sn ? "Menunggu final approval" : "Non Serial" }));
  return rows.length > 0 ? rows : [{ name: "-", code: "-", qty: 0, type: "-", serial: "-" }];
}

function SignatureBlock({ title, role, name, phone, company, signatureUrl, signedSrc }: SignatureBlockProps) {
  return <div className="sj-sign-box">
    <strong>{title}</strong>
    <span>{role}</span>
    <div className="sj-sign-space">{signedSrc ? <img className="sj-sign-img" src={signedSrc} alt={`Tanda tangan ${role}`} /> : <em>{name ? signatureText(signatureUrl) : "Menunggu tanda tangan"}</em>}</div>
    <b>{personLine(name, phone)}</b>
    <small>{company || "-"}</small>
  </div>;
}

export default async function SuratJalanPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["ADMIN", "LEADER", "KOORDINATOR", "SUPERVISOR", "TEKNISI"]);
  const { id } = await params;
  const data = await getSuratJalan(id);
  if (!data) notFound();
  const { request, items, signatures } = data;
  if (profile.role === "TEKNISI" && request.teknisi_id !== profile.id) notFound();
  const rows = buildRows(items);

  return <main className="sj-page-wrap">
    <div className="sj-toolbar no-print"><a className="sj-back-link" href="/dashboard">← Kembali</a><SuratJalanPrintButton /></div>
    <section className="sj-sheet">
      <header className="sj-header">
        <div className="sj-company"><strong>PT. PLN ICON PLUS</strong><span>Inventory Monitoring Systems</span></div>
        <div className="sj-logo"><span className="sj-logo-mark"><i>⚡</i></span><div><b>PLN</b><small>Icon Plus</small></div></div>
      </header>
      <h1>BUKTI SERAH TERIMA BARANG</h1>
      <p className="sj-subtitle">Telah dilakukan serah terima barang/material sebagai berikut:</p>
      <div className="sj-info-grid"><span>Nama</span><b>: {request.teknisi_nama}</b><span>Nama Perusahaan</span><b>: {request.teknisi_company_name || "-"}</b><span>Basecamp</span><b>: {request.basecamp || "-"}</b><span>Referensi Pekerjaan / Proyek</span><b>: {request.referensi_pekerjaan || request.request_code}</b><span>No. Surat Jalan</span><b>: {request.surat_jalan_number || "Belum diterbitkan"}</b><span>Tanggal</span><b>: {formatDate(request.approved_at || request.created_at)}</b></div>
      <table className="sj-material-table"><thead><tr><th style={{ width: 28 }}>NO.</th><th>Nama Barang / Material</th><th style={{ width: 92 }}>Kode SAP</th><th style={{ width: 58 }}>Jumlah</th><th style={{ width: 78 }}>Type</th><th>Serial Number / Keterangan</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{index + 1}</td><td>{row.name}</td><td>{row.code}</td><td>{row.qty}</td><td>{row.type}</td><td>{row.serial}</td></tr>)}</tbody></table>
      <p className="sj-note">Catatan: Barang telah diterima dan diperiksa oleh pihak penerima dalam kondisi baik dan lengkap.</p>
      <div className="sj-bottom-grid"><SignatureBlock title="Yang Menyerahkan" role="Tim Gudang" name={request.approved_by_nama} phone={request.approved_by_phone_number} company={request.approved_by_company_name || "PLN ICONPLUS"} signatureUrl={request.admin_signature_url} signedSrc={signatures.admin} /><div className="sj-checklist"><label><strong>Material Telah Disiapkan</strong><span>: {formatDateTime(request.admin_signed_at || request.approved_at)}</span><input type="checkbox" checked readOnly /></label><label><strong>Waktu Pengambilan Material</strong><span>:</span><input type="checkbox" readOnly /></label><label><strong>Durasi Transaksi</strong><span>:</span><input type="checkbox" readOnly /></label><label><strong>Catatan</strong><span>: {request.catatan_admin || ""}</span><input type="checkbox" readOnly /></label><label><strong>Penerima</strong><span>: {request.teknisi_nama}</span><input type="checkbox" readOnly /></label></div><SignatureBlock title="Yang Bertanggung Jawab atas Permintaan Material" role="Tim Management" name={request.koordinator_nama} phone={request.koordinator_phone_number} company={request.koordinator_company_name || "PLN ICONPLUS"} signatureUrl={request.koordinator_signature_url} signedSrc={signatures.koordinator} /><SignatureBlock title="Mengetahui & Menyetujui" role="Tim Leader Pemeliharaan" name={request.supervisor_nama} phone={request.supervisor_phone_number} company={request.supervisor_company_name || "PT. PLN ICONPLUS"} signatureUrl={request.supervisor_signature_url} signedSrc={signatures.supervisor} /></div>
    </section>
  </main>;
}
