"use client";

import { useEffect, useMemo, useState } from "react";

type Material = { material_id: string; material_code: string; nama: string; stock_gudang: number; stock_teknisi: number; total_stock: number; min_stock: number; stock_status: string };
type TopMaterial = { material_id: string; material_code: string; nama: string; total_used: number };

export function SupervisorAnalysisClient() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topMaterials, setTopMaterials] = useState<TopMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [matRes, dashRes] = await Promise.all([fetch("/api/monitoring/materials"), fetch("/api/dashboard/supervisor")]);
      const matJson = await matRes.json();
      const dashJson = await dashRes.json();
      if (!matRes.ok) throw new Error(matJson.error || "Gagal memuat material.");
      if (!dashRes.ok) throw new Error(dashJson.error || "Gagal memuat analisa.");
      setMaterials(matJson.data || []);
      setTopMaterials(dashJson.top_materials || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat analisa material.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const insight = useMemo(() => {
    const totalStock = materials.reduce((sum, r) => sum + Number(r.total_stock || 0), 0);
    const warehouseStock = materials.reduce((sum, r) => sum + Number(r.stock_gudang || 0), 0);
    const technicianStock = materials.reduce((sum, r) => sum + Number(r.stock_teknisi || 0), 0);
    const lowStock = materials.filter((r) => r.stock_status !== "AMAN");
    return { totalStock, warehouseStock, technicianStock, lowStock };
  }, [materials]);

  return (
    <div className="supervisor-page supervisor-analysis-view">
      {error && <div className="alert-error">{error}</div>}
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Stat label="Total Stok Sistem" value={insight.totalStock} />
        <Stat label="Stok Gudang" value={insight.warehouseStock} />
        <Stat label="Stok Teknisi" value={insight.technicianStock} />
        <Stat label="Material Perlu Perhatian" value={insight.lowStock.length} />
      </div>
      <div className="grid grid-2">
        <section className="card">
          <div className="section-title"><h3>Top Material Digunakan</h3><p>Diurutkan berdasarkan total qty pemakaian.</p></div>
          <div className="table-wrap"><table className="table supervisor-table"><thead><tr><th>Kode</th><th>Material</th><th>Total Used</th></tr></thead><tbody>{loading ? <tr><td colSpan={3}>Memuat data...</td></tr> : topMaterials.length === 0 ? <tr><td colSpan={3}>Belum ada data penggunaan.</td></tr> : topMaterials.map((r) => <tr key={r.material_id}><td>{r.material_code}</td><td>{r.nama}</td><td>{r.total_used}</td></tr>)}</tbody></table></div>
        </section>
        <section className="card">
          <div className="section-title"><h3>Material Rendah/Kritis</h3><p>Material dengan stok gudang kurang dari atau sama dengan minimum stok.</p></div>
          <div className="table-wrap"><table className="table supervisor-table"><thead><tr><th>Kode</th><th>Material</th><th>Gudang</th><th>Min</th><th>Status</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Memuat data...</td></tr> : insight.lowStock.length === 0 ? <tr><td colSpan={5}>Tidak ada stok rendah.</td></tr> : insight.lowStock.map((r) => <tr key={r.material_id}><td>{r.material_code}</td><td>{r.nama}</td><td>{r.stock_gudang}</td><td>{r.min_stock}</td><td><span className="badge badge-warning">{r.stock_status}</span></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat-card"><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div></div>;
}
