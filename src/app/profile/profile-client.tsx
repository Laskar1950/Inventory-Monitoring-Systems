"use client";

import { useState } from "react";
import { Camera, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/types/database";
import { getInitials } from "@/lib/normalize";

type ExtendedProfile = Profile & { keterangan?: string | null; photo_url?: string | null };

export function ProfileClient({ profile }: { profile: ExtendedProfile }) {
  const [nama, setNama] = useState(profile.nama || "");
  const [keterangan, setKeterangan] = useState(profile.keterangan || "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(profile.photo_url || "");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPassword, setKonfirmasiPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  function onPhotoChange(file: File | null) {
    setPhoto(file);
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append("nama", nama);
      formData.append("keterangan", keterangan);
      if (photo) formData.append("photo", photo);
      const res = await fetch("/api/profile", { method: "PATCH", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan profil.");
      toast.success("Profil berhasil diperbarui.");
      setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan profil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBaru.length < 6) return toast.error("Password baru minimal 6 karakter.");
    if (passwordBaru !== konfirmasiPassword) return toast.error("Konfirmasi password tidak sama.");
    setSavingPassword(true);
    try {
      const res = await fetch("/api/profile/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: passwordBaru }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengganti password.");
      setPasswordBaru(""); setKonfirmasiPassword("");
      toast.success("Password berhasil diganti.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengganti password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return <div className="page-grid">
    <section className="card profile-hero-card">
      <div className="profile-avatar-xl">
        {photoPreview ? <img src={photoPreview} alt="Foto profil" /> : <span>{getInitials(nama)}</span>}
      </div>
      <div>
        <h3>{nama}</h3>
        <p>{profile.email}</p>
        <span className="role-badge">{profile.role}</span>
      </div>
    </section>

    <section className="card">
      <div className="section-title"><h3>Edit Profil</h3><p>Perbarui nama, keterangan, dan foto profil.</p></div>
      <form className="form-stack" onSubmit={saveProfile}>
        <label><span>Nama</span><input value={nama} onChange={(e) => setNama(e.target.value)} required /></label>
        <label><span>Keterangan</span><textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} rows={3} placeholder="Contoh: Teknisi area Purwokerto" /></label>
        <label><span>Foto Profil</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)} /></label>
        <button className="btn-primary" disabled={savingProfile}>{savingProfile ? "Menyimpan profil..." : <><Save size={16}/> Simpan Profil</>}</button>
      </form>
    </section>

    <section className="card">
      <div className="section-title"><h3>Ganti Password</h3><p>Gunakan password baru minimal 6 karakter.</p></div>
      <form className="form-stack" onSubmit={savePassword}>
        <label><span>Password Baru</span><input type="password" value={passwordBaru} onChange={(e) => setPasswordBaru(e.target.value)} /></label>
        <label><span>Konfirmasi Password Baru</span><input type="password" value={konfirmasiPassword} onChange={(e) => setKonfirmasiPassword(e.target.value)} /></label>
        <button className="btn-dark" disabled={savingPassword}>{savingPassword ? "Mengganti password..." : <><KeyRound size={16}/> Ganti Password</>}</button>
      </form>
    </section>
  </div>;
}
