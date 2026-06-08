import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SuratJalanPrintButton } from "./print-button";
import type { RequestSummary } from "@/types/database";

type ItemRow = {
  id: string;
  material_id: string;
  material_code: string;
  material_nama: string;
  qty_requested: number;
  qty_approved: number | null;
  status: string;
  wajib_sn: boolean;
  kondisi?: string | null;
  serials: string[];
};

type PrintRow = {
  name: string;
  code: string;
  qty: number | string;
  type: string;
  serial: string;
};

type SignatureBlockProps = {
  title: string;
  role: string;
  name?: string | null;
  signedAt?: string | null;
  signatureUrl?: string | null;
  signedSrc?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function signatureText(path?: string | null) {
  if (!path) return "Menunggu tanda tangan";
  if (path.startsWith("digital")) return "Ditandatangani digital";
  return "Tanda tangan tersimpan";
}

function isImageSignature(path?: string | null) {
  return Boolean(path && !path.startsWith("digital") && !path.startsWith("http"));
}

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

  const { data: rawItems } = await supabase
    .from("material_request_items")
    .select("id,request_id,material_id,qty_requested,qty_approved,status,materials(material_code,nama,merk,satuan,wajib_sn,kondisi_default)")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  const { data: moves } = await supabase
    .from("material_serial_movement_detail")
    .select("serial_number,material_id,reference_item_id")
    .eq("reference_type", "material_requests")
    .eq("reference_id", id)
    .eq("movement_type", "REQUEST_APPROVED");

  const items: ItemRow[] = (rawItems ?? []).map((row: any) => {
    const material = Array.isArray(row.materials) ? row.materials[0] : row.materials;
    const serials = (moves ?? []).filter((m: any) => m.reference_item_id === row.id || m.material_id === row.material_id).map((m: any) => m.serial_number);
    return {
      id: row.id,
      material_id: row.material_id,
      material_code: material?.material_code ?? "-",
      material_nama: material?.nama ?? "-",
      qty_requested: row.qty_requested,
      qty_approved: row.qty_approved,
      status: row.status,
      wajib_sn: Boolean(material?.wajib_sn),
      kondisi: material?.kondisi_default ?? null,
      serials,
    };
  });

  const r = request as RequestSummary;
  const signatures = {
    admin: await getSignedSignatureUrl(r.admin_signature_url),
    koordinator: await getSignedSignatureUrl(r.koordinator_signature_url),
    supervisor: await getSignedSignatureUrl(r.supervisor_signature_url),
    teknisi: await getSignedSignatureUrl(r.teknisi_signature_url),
  };

  return { request: r, items, signatures };
}

function fillRows(items: ItemRow[]): PrintRow[] {
  const rows: PrintRow[] = items.map((item) => ({
    name: item.material_nama,
    code: item.material_code,
    qty: item.qty_approved ?? item.qty_requested,
    type: item.kondisi || "-",
    serial: item.serials.length > 0 ? item.serials.join(", ") : item.wajib_sn ? "Menunggu final approval" : "Non Serial",
  }));
  while (rows.length < 40) rows.push({ name: "", code: "", qty: "", type: "", serial: "" });
  return rows.slice(0, 40);
}

function SignatureBlock({ title, role, name, signedAt, signatureUrl, signedSrc }: SignatureBlockProps) {
  return <div className="sj-sign-box">
    <strong>{title}</strong>
    <span>{role}</span>
    <div className="sj-sign-space">
      {signedSrc ? <img className="sj-sign-img" src={signedSrc} alt={`Tanda tangan ${role}`} /> : <em>{name ? signatureText(signatureUrl) : "Menunggu tanda tangan"}</em>}
    </div>
    <b>{name || "-"}</b>
    <small>{formatDateTime(signedAt)}</small>
  </div>;
}

export default async function SuratJalanPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["ADMIN", "LEADER", "KOORDINATOR", "SUPERVISOR", "TEKNISI"]);
  const { id } = await params;
  const data = await getSuratJalan(id);
  if (!data) notFound();
  const { request, items, signatures } = data;
  if (profile.role === "TEKNISI" && request.teknisi_id !== profile.id) notFound();
  const rows = fillRows(items);

  return <main className="sj-page-wrap">
    <div className="sj-toolbar no-print"><a className="sj-back-link" href="/dashboard">← Kembali</a><SuratJalanPrintButton /></div>
    <section className="sj-sheet">
      <header className="sj-header">
        <div className="sj-company"><strong>PT. PLN ICON PLUS</strong><span>Jl. Gatot Subroto, Jakarta Selatan</span><span>Inventory Monitoring Systems</span></div>
        <div className="sj-logo"><span className="sj-logo-mark">⚡</span><div><b>PLN</b><small>Icon Plus</small></div></div>
      </header>

      <h1>BUKTI SERAH TERIMA BARANG</h1>
      <p className="sj-subtitle">Telah dilakukan serah terima barang/material sebagai berikut:</p>

      <div className="sj-info-grid">
        <span>Nama</span><b>: {request.teknisi_nama}</b>
        <span>Nama Perusahaan</span><b>: PLN ICONPLUS</b>
        <span>Basecamp</span><b>: {request.basecamp || "-"}</b>
        <span>Referensi Pekerjaan / Proyek</span><b>: {request.referensi_pekerjaan || request.request_code}</b>
        <span>No. Surat Jalan</span><b>: {request.surat_jalan_number || "Belum diterbitkan"}</b>
        <span>Tanggal</span><b>: {formatDate(request.approved_at || request.created_at)}</b>
      </div>

      <table className="sj-material-table">
        <thead><tr><th style={{ width: 28 }}>NO.</th><th>Nama Barang / Material</th><th style={{ width: 92 }}>Kode SAP</th><th style={{ width: 58 }}>Jumlah</th><th style={{ width: 78 }}>Type</th><th>Serial Number / Keterangan</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}><td>{index + 1}</td><td>{row.name}</td><td>{row.code}</td><td>{row.qty}</td><td>{row.type}</td><td>{row.serial}</td></tr>)}</tbody>
      </table>

      <p className="sj-note">Catatan: Barang/material diterima dan diserahkan dalam kondisi sesuai hasil pemeriksaan dan persetujuan pada sistem.</p>

      <div className="sj-signatures">
        <SignatureBlock title="Yang Menyerahkan" role="Admin Gudang" name={request.approved_by_nama} signedAt={request.admin_signed_at || request.approved_at} signatureUrl={request.admin_signature_url} signedSrc={signatures.admin} />
        <SignatureBlock title="Mengetahui" role="Koordinator" name={request.koordinator_nama} signedAt={request.koordinator_signed_at} signatureUrl={request.koordinator_signature_url} signedSrc={signatures.koordinator} />
        <SignatureBlock title="Menyetujui" role="Supervisor" name={request.supervisor_nama} signedAt={request.supervisor_signed_at} signatureUrl={request.supervisor_signature_url} signedSrc={signatures.supervisor} />
        <SignatureBlock title="Yang Menerima" role="Teknisi" name={request.teknisi_signature_url ? request.teknisi_nama : null} signedAt={request.teknisi_signed_at || request.received_at} signatureUrl={request.teknisi_signature_url} signedSrc={signatures.teknisi} />
      </div>
    </section>
  </main>;
}
