"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Email/username dan password wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session tidak ditemukan setelah login.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, is_active")
        .eq("auth_user_id", user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error("Profile user belum dibuat. Hubungi Admin Gudang.");
      }
      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error("Akun tidak aktif. Hubungi Admin Gudang.");
      }

      toast.success("Login berhasil.");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login gagal.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-field">
        <label className="form-label">Email / Username</label>
        <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@email.com" autoComplete="email" />
      </div>
      <div className="form-field">
        <label className="form-label">Password</label>
        <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" autoComplete="current-password" />
      </div>
      <button className="btn-primary full" disabled={loading} type="submit">
        {loading ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
