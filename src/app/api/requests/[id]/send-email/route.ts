import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const allowedRoles = ["ADMIN", "KOORDINATOR", "MANAGER"];
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Anda tidak memiliki akses untuk mengirim surat jalan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload email tidak valid." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: req } = await supabase
    .from("material_request_summary")
    .select("surat_jalan_number,request_code,teknisi_nama,status")
    .eq("id", id)
    .single();

  if (!req) return NextResponse.json({ error: "Request tidak ditemukan." }, { status: 404 });

  const allowedStatuses = ["WAITING_SIGNATURE", "KOORDINATOR_SIGNED", "MANAGER_SIGNED", "APPROVED"];
  if (!allowedStatuses.includes(req.status)) {
    return NextResponse.json({ error: "Surat jalan belum tersedia." }, { status: 400 });
  }

  // Cek apakah RESEND_API_KEY tersedia
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({ error: "Konfigurasi email belum diatur. Hubungi administrator." }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000";
  const suratJalanUrl = `${appUrl}/surat-jalan/${id}`;
  const sjNumber = req.surat_jalan_number ?? req.request_code;
  const subject = parsed.data.subject || `Surat Jalan ${sjNumber} - ${req.teknisi_nama}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">PLN ICON PLUS — Bukti Serah Terima Barang</h2>
      <p>Surat Jalan <strong>${sjNumber}</strong> untuk teknisi <strong>${req.teknisi_nama}</strong> telah diterbitkan.</p>
      <p>Klik link berikut untuk melihat dan mencetak surat jalan:</p>
      <a href="${suratJalanUrl}" style="display:inline-block;padding:10px 20px;background:#1e40af;color:#fff;text-decoration:none;border-radius:6px;">Lihat Surat Jalan</a>
      <hr style="margin: 24px 0;" />
      <p style="color:#6b7280;font-size:12px;">Email ini dikirim otomatis oleh sistem PLN ICONPLUS Inventory Monitoring.</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "noreply@pln-iconplus.co.id",
        to: parsed.data.to,
        subject,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return NextResponse.json({ error: (errJson as any).message || "Gagal mengirim email." }, { status: 500 });
    }

    return NextResponse.json({ message: `Email berhasil dikirim ke ${parsed.data.to.join(", ")}.` });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal mengirim email." }, { status: 500 });
  }
}
