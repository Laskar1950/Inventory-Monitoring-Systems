import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile) redirect("/dashboard");

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-badge">IP</div>
        <div className="login-title">
          <h1>Inventory Monitoring</h1>
          <p>PLN ICON PLUS Inventory Monitoring Systems</p>
        </div>
        <LoginForm />
        <p style={{ textAlign: "center", color: "#94A3B8", fontSize: ".76rem", marginTop: 14 }}>
          Next.js • Supabase • Vercel
        </p>
      </section>
    </main>
  );
}
