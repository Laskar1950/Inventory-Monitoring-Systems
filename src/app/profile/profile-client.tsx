"use client";

import { useEffect, useState } from "react";
import { Camera, KeyRound, PenLine, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/types/database";
import { getInitials } from "@/lib/normalize";

type ExtendedProfile = Profile & { keterangan?: string | null; photo_url?: string | null; signature_url?: string | null; signature_updated_at?: string | null };

function SignaturePreview({ path }: { path: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    if (!path) { setSrc(""); return; }
    if (path.startsWith("http")) { setSrc(path); return; }
    fetch(`/api/storage-url?bucket=signatures&path=${encodeURIComponent(path)}`).then((r) => r.json()).then((j) => { if (active) setSrc(j.signedUrl || ""); }).catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [path]);
  if (!src) return <div className="signature-empty">Tanda tangan belum dimuat.</div>;
  return <img className="signature-preview-img" src={src} alt="Tanda tangan" />;
}

export function ProfileClient({ profile }: { profile: ExtendedProfile }) {
  const [nama, setNama] = useState(profile.nama || "");
  const [keterangan, setKeterangan] = useState(profile.keterangan || "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(profile.photo_url || "");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPassword, setKonfirmasiPassword] = useState("");
  const [signature, setSignature] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [storedSignature, setStoredSignature] = useState(profile.signature_url || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  function onPhotoChange(file: File | null) {
    setPhoto(file);
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  }

  function onSignatureChange(file: File | null) {
    setSignature(file);
    if (!file) { setSignaturePreview(""); return; }
    setSignaturePreview(URL.createObjectURL(file));
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

  async function saveSignature(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signature) return toast.error("Pilih file tanda tangan terlebih dahulu.");
    setSavingSignature(true);
    try {
      const formData = new FormData();
      formData.append("signature", signature);
      const res = await fetch("/api/profile/signature", { method: "PATCH", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan tanda tangan.");
      setStoredSignature(json.data?.signature_url || "");
      setSignature(null); setSignaturePreview("");
      toast.success("Tanda tangan berhasil disimpan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan tanda tangan.");
    } finally {
      setSavingSignature(false);
    }
  }

  async function deleteSignature() {
    if (!window.confirm("Hapus tanda tangan digital akun ini?")) return;
    setSavingSignature(true);
    try {
      const res = await fetch("/api/profile/signature", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus tanda tangan.");
      setStoredSignature(""); setSignature(null); setSignaturePreview("");
      toast.success("Tanda tangan berhasil dihapus.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus tanda tangan.");
    } finally {
      setSavingSignature(false);
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

    <section className="card signature-card">
      <div className="section-title"><h3>Tanda Tangan Digital</h3><p>Tanda tangan ini akan dipakai otomatis saat akun ini menyetujui atau menerima Surat Jalan.</p></div>
      <div className="signature-preview-box">{signaturePreview ? <img className="signature-preview-img" src={signaturePreview} alt="Preview tanda tangan" /> : storedSignature ? <SignaturePreview path={storedSignature} /> : <div className="signature-empty">Belum ada tanda tangan tersimpan.</div>}</div>
      <form className="form-stack" onSubmit={saveSignature}>
        <label><span>Upload Tanda Tangan</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onSignatureChange(e.target.files?.[0] ?? null)} /></label>
        <div className="action-row"><button className="btn-primary" disabled={savingSignature}>{savingSignature ? "Menyimpan tanda tangan..." : <><PenLine size={16}/> Simpan Tanda Tangan</>}</button>{storedSignature && <button className="btn-danger" type="button" onClick={() => void deleteSignature()} disabled={savingSignature}><Trash2 size={16}/> Hapus</button>}</div>
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
