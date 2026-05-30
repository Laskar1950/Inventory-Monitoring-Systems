import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile) redirect("/dashboard");

  return (
    <main className="login-screen login-nature-bg">
      <section className="login-card login-card-modern">
        <div className="login-badge login-badge-icon" aria-label="Lightning logo">
          <Zap size={34} strokeWidth={3} fill="currentColor" />
        </div>
        <div className="login-title">
          <h1>Inventory Monitoring</h1>
        </div>
        <LoginForm />
        <div className="login-footer-credit">
          <p>Next.js • Supabase • Vercel</p>
          <span>Created by Rizki Afrizal</span>
        </div>
      </section>
    </main>
  );
}
