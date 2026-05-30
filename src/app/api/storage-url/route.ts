import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_BUCKETS = new Set(["usage-evidence", "return-evidence", "stock-opname-evidence", "profile-photos", "foto-inventory"]);

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") || "";
  const path = url.searchParams.get("path") || "";

  if (!ALLOWED_BUCKETS.has(bucket)) return NextResponse.json({ error: "Bucket tidak valid." }, { status: 400 });
  if (!path) return NextResponse.json({ error: "Path file wajib diisi." }, { status: 400 });
  if (path.startsWith("http")) return NextResponse.json({ signedUrl: path });

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error) return NextResponse.json({ error: error.message || "Gagal membuat URL foto." }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl });
}
