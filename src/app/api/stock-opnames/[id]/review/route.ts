import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewPayload = { item_id: string; status_review: "APPROVED" | "REVISION" | "REJECTED_FINAL"; catatan_admin?: string | null };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "ADMIN") return NextResponse.json({ error: "Hanya Admin Gudang yang dapat review stok opname." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { reviews?: ReviewPayload[] } | null;
  const reviews = body?.reviews;
  if (!Array.isArray(reviews) || reviews.length === 0) return NextResponse.json({ error: "Minimal ada satu item untuk direview." }, { status: 400 });
  for (const review of reviews) {
    if (!review.item_id || !["APPROVED", "REVISION", "REJECTED_FINAL"].includes(review.status_review)) return NextResponse.json({ error: "Status review item tidak valid." }, { status: 400 });
    if ((review.status_review === "REVISION" || review.status_review === "REJECTED_FINAL") && !review.catatan_admin?.trim()) return NextResponse.json({ error: "Catatan admin wajib untuk status Revisi dan Rejected Final." }, { status: 400 });
  }
  const { data, error } = await createAdminClient().rpc("review_stock_opname", {
    p_stock_opname_id: id,
    p_admin_id: profile.id,
    p_reviews: reviews.map((review) => ({ item_id: review.item_id, status_review: review.status_review, catatan_admin: review.catatan_admin || null })),
  });
  if (error) return NextResponse.json({ error: error.message || "Gagal menyimpan review stok opname." }, { status: 400 });
  return NextResponse.json({ data, message: "Review stok opname berhasil disimpan." });
}
