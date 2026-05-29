import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-badge">!</div>
        <div className="login-title">
          <h1>Akses Ditolak</h1>
          <p>Akun Anda tidak memiliki hak akses untuk membuka halaman ini.</p>
        </div>
        <Link href="/dashboard" className="btn-primary full">Kembali ke Dashboard</Link>
      </section>
    </main>
  );
}
