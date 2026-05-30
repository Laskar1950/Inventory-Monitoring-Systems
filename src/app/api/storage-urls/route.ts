import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_BUCKETS = new Set(["usage-evidence", "return-evidence", "stock-opname-evidence", "profile-photos", "foto-inventory"]);

type Item = { bucket: string; path: string };

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items as Item[] : [];
  if (items.length === 0) return NextResponse.json({ data: {} });
  if (items.length > 75) return NextResponse.json({ error: "Maksimal 75 file per request." }, { status: 400 });

  const supabase = createAdminClient();
  const result: Record<string, string> = {};

  for (const item of items) {
    if (!ALLOWED_BUCKETS.has(item.bucket) || !item.path) continue;
    if (item.path.startsWith("http")) {
      result[item.bucket + ":" + item.path] = item.path;
      continue;
    }
    const signed = await supabase.storage.from(item.bucket).createSignedUrl(item.path, 60 * 10);
    if (signed.data?.signedUrl) result[item.bucket + ":" + item.path] = signed.data.signedUrl;
  }

  return NextResponse.json({ data: result });
}
