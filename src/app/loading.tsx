import { TableSkeleton } from "@/components/table-skeleton";

export default function Loading() {
  return (
    <main className="content-wrapper">
      <section className="card">
        <div className="section-header">
          <div className="section-title">
            <h3>Memuat halaman...</h3>
            <p>Menyiapkan data terbaru untuk tampilan ini.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <tbody><TableSkeleton rows={6} columns={6} /></tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
