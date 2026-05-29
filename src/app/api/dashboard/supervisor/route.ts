import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesi berakhir." }, { status: 401 });
  if (profile.role !== "SUPERVISOR" && profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses dashboard supervisor ditolak." }, { status: 403 });
  }

  const supabase = createAdminClient();
  const [summary, lowStock, technicians, recentActivities, topMaterials] = await Promise.all([
    supabase.rpc("get_supervisor_dashboard_summary"),
    supabase.from("supervisor_monitoring_materials").select("*").or("stock_status.eq.RENDAH,stock_status.eq.KRITIS").order("stock_gudang", { ascending: true }).limit(8),
    supabase.from("supervisor_monitoring_technicians").select("*").order("total_activity", { ascending: false }).limit(8),
    supabase.from("activity_logs").select("id, action, entity_type, description, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("supervisor_top_material_usage").select("*").limit(8),
  ]);

  if (summary.error) return NextResponse.json({ error: summary.error.message }, { status: 500 });

  return NextResponse.json({
    summary: summary.data,
    low_stock: lowStock.data || [],
    technicians: technicians.data || [],
    recent_activities: recentActivities.data || [],
    top_materials: topMaterials.data || [],
  });
}
