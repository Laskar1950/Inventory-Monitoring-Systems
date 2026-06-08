-- =============================================================
-- MIGRATION: Multi-Stage Approval System
-- Jalankan di Supabase SQL Editor
-- Urutan: eksekusi dari atas ke bawah satu per satu
-- =============================================================

-- STEP 1: Tambah role baru ke enum user_role
-- (Supabase tidak support ALTER TYPE ADD VALUE IF NOT EXISTS di semua versi,
--  jalankan satu per satu jika ada error)
ALTER TYPE user_role ADD VALUE 'LEADER';
ALTER TYPE user_role ADD VALUE 'KOORDINATOR';
ALTER TYPE user_role ADD VALUE 'MANAGER';

-- STEP 2: Tambah status baru ke transaction_status
ALTER TYPE transaction_status ADD VALUE 'LEADER_APPROVED';
ALTER TYPE transaction_status ADD VALUE 'WAITING_SIGNATURE';
ALTER TYPE transaction_status ADD VALUE 'KOORDINATOR_SIGNED';
ALTER TYPE transaction_status ADD VALUE 'MANAGER_SIGNED';

-- STEP 3: Tambah kolom baru di tabel material_requests
ALTER TABLE material_requests
  ADD COLUMN IF NOT EXISTS leader_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leader_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS leader_catatan     TEXT,
  ADD COLUMN IF NOT EXISTS koordinator_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS koordinator_signed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS koordinator_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS manager_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_signed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_signature_url     TEXT,
  ADD COLUMN IF NOT EXISTS surat_jalan_number TEXT,
  ADD COLUMN IF NOT EXISTS surat_jalan_url    TEXT,
  ADD COLUMN IF NOT EXISTS basecamp           TEXT,
  ADD COLUMN IF NOT EXISTS referensi_pekerjaan TEXT;

-- STEP 4: Buat storage bucket untuk signature
-- Jalankan di Supabase Storage tab: buat bucket 'signatures' (public: false)
-- Atau via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('surat-jalan', 'surat-jalan', false)
ON CONFLICT (id) DO NOTHING;

-- STEP 5: Storage RLS policies untuk signatures
CREATE POLICY "Authenticated can upload signatures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Authenticated can read signatures"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'signatures');

CREATE POLICY "Authenticated can upload surat-jalan"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'surat-jalan');

CREATE POLICY "Authenticated can read surat-jalan"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'surat-jalan');

-- STEP 6: Update view material_request_summary
-- Drop view lama dulu, lalu buat ulang dengan kolom baru
DROP VIEW IF EXISTS material_request_summary;

CREATE OR REPLACE VIEW material_request_summary AS
SELECT
  mr.id,
  mr.request_code,
  mr.teknisi_id,
  p_tek.nama          AS teknisi_nama,
  p_tek.email         AS teknisi_email,
  mr.basecamp,
  mr.referensi_pekerjaan,
  mr.status,
  mr.catatan_teknisi,
  mr.catatan_admin,
  -- Leader
  mr.leader_id,
  p_lead.nama         AS leader_nama,
  mr.leader_approved_at,
  mr.leader_catatan,
  -- Admin
  mr.approved_by,
  p_adm.nama          AS approved_by_nama,
  mr.approved_at,
  -- Koordinator
  mr.koordinator_id,
  p_koor.nama         AS koordinator_nama,
  mr.koordinator_signed_at,
  mr.koordinator_signature_url,
  -- Manager
  mr.manager_id,
  p_mgr.nama          AS manager_nama,
  mr.manager_signed_at,
  mr.manager_signature_url,
  -- Surat Jalan
  mr.surat_jalan_number,
  mr.surat_jalan_url,
  -- Timestamps
  mr.created_at,
  mr.updated_at,
  -- Aggregates dari items
  COUNT(mri.id)        AS item_count,
  COALESCE(SUM(mri.qty_requested), 0) AS total_qty
FROM material_requests mr
LEFT JOIN profiles p_tek  ON p_tek.id  = mr.teknisi_id
LEFT JOIN profiles p_lead ON p_lead.id = mr.leader_id
LEFT JOIN profiles p_adm  ON p_adm.id  = mr.approved_by
LEFT JOIN profiles p_koor ON p_koor.id = mr.koordinator_id
LEFT JOIN profiles p_mgr  ON p_mgr.id  = mr.manager_id
LEFT JOIN material_request_items mri ON mri.request_id = mr.id
GROUP BY
  mr.id, mr.request_code, mr.teknisi_id, p_tek.nama, p_tek.email,
  mr.basecamp, mr.referensi_pekerjaan, mr.status,
  mr.catatan_teknisi, mr.catatan_admin,
  mr.leader_id, p_lead.nama, mr.leader_approved_at, mr.leader_catatan,
  mr.approved_by, p_adm.nama, mr.approved_at,
  mr.koordinator_id, p_koor.nama, mr.koordinator_signed_at, mr.koordinator_signature_url,
  mr.manager_id, p_mgr.nama, mr.manager_signed_at, mr.manager_signature_url,
  mr.surat_jalan_number, mr.surat_jalan_url,
  mr.created_at, mr.updated_at;

-- STEP 7: Update RPC list_material_requests_page agar filter by role
-- Leader lihat PENDING
-- Admin lihat LEADER_APPROVED
-- Koordinator lihat WAITING_SIGNATURE
-- Manager lihat KOORDINATOR_SIGNED
-- Teknisi lihat punya sendiri
CREATE OR REPLACE FUNCTION list_material_requests_page(
  p_profile_id UUID,
  p_role       TEXT,
  p_limit      INT DEFAULT 20,
  p_offset     INT DEFAULT 0
)
RETURNS TABLE (
  id                    UUID,
  request_code          TEXT,
  teknisi_id            UUID,
  teknisi_nama          TEXT,
  teknisi_email         TEXT,
  basecamp              TEXT,
  referensi_pekerjaan   TEXT,
  status                TEXT,
  catatan_teknisi       TEXT,
  catatan_admin         TEXT,
  leader_id             UUID,
  leader_nama           TEXT,
  leader_approved_at    TIMESTAMPTZ,
  leader_catatan        TEXT,
  approved_by           UUID,
  approved_by_nama      TEXT,
  approved_at           TIMESTAMPTZ,
  koordinator_id        UUID,
  koordinator_nama      TEXT,
  koordinator_signed_at TIMESTAMPTZ,
  koordinator_signature_url TEXT,
  manager_id            UUID,
  manager_nama          TEXT,
  manager_signed_at     TIMESTAMPTZ,
  manager_signature_url TEXT,
  surat_jalan_number    TEXT,
  surat_jalan_url       TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  item_count            BIGINT,
  total_qty             BIGINT,
  total_count           BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.*,
    COUNT(*) OVER () AS total_count
  FROM material_request_summary s
  WHERE
    CASE p_role
      WHEN 'TEKNISI'    THEN s.teknisi_id = p_profile_id
      WHEN 'LEADER'     THEN s.status IN ('PENDING', 'LEADER_APPROVED', 'REJECTED')
      WHEN 'ADMIN'      THEN s.status IN ('LEADER_APPROVED', 'WAITING_SIGNATURE', 'APPROVED', 'REJECTED')
      WHEN 'KOORDINATOR' THEN s.status IN ('WAITING_SIGNATURE', 'KOORDINATOR_SIGNED', 'MANAGER_SIGNED', 'APPROVED')
      WHEN 'MANAGER'    THEN s.status IN ('KOORDINATOR_SIGNED', 'MANAGER_SIGNED', 'APPROVED')
      WHEN 'SUPERVISOR' THEN TRUE
      ELSE FALSE
    END
  ORDER BY s.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- STEP 8: Fungsi leader_approve_request
CREATE OR REPLACE FUNCTION leader_approve_request(
  p_request_id UUID,
  p_leader_id  UUID,
  p_catatan    TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE material_requests
  SET
    status             = 'LEADER_APPROVED',
    leader_id          = p_leader_id,
    leader_approved_at = NOW(),
    leader_catatan     = p_catatan,
    updated_at         = NOW()
  WHERE id = p_request_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request tidak ditemukan atau status bukan PENDING.';
  END IF;

  RETURN p_request_id;
END;
$$;

-- STEP 9: Fungsi leader_reject_request
CREATE OR REPLACE FUNCTION leader_reject_request(
  p_request_id UUID,
  p_leader_id  UUID,
  p_catatan    TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE material_requests
  SET
    status         = 'REJECTED',
    leader_id      = p_leader_id,
    leader_catatan = p_catatan,
    updated_at     = NOW()
  WHERE id = p_request_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request tidak ditemukan atau status bukan PENDING.';
  END IF;

  RETURN p_request_id;
END;
$$;

-- STEP 10: Fungsi koordinator_sign_request
CREATE OR REPLACE FUNCTION koordinator_sign_request(
  p_request_id    UUID,
  p_koordinator_id UUID,
  p_signature_url TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE material_requests
  SET
    status                    = 'KOORDINATOR_SIGNED',
    koordinator_id            = p_koordinator_id,
    koordinator_signed_at     = NOW(),
    koordinator_signature_url = p_signature_url,
    updated_at                = NOW()
  WHERE id = p_request_id AND status = 'WAITING_SIGNATURE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request tidak ditemukan atau status bukan WAITING_SIGNATURE.';
  END IF;

  RETURN p_request_id;
END;
$$;

-- STEP 11: Fungsi manager_sign_request (final — material masuk ke tas teknisi via approve existing)
CREATE OR REPLACE FUNCTION manager_sign_request(
  p_request_id UUID,
  p_manager_id UUID,
  p_signature_url TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE material_requests
  SET
    status                = 'MANAGER_SIGNED',
    manager_id            = p_manager_id,
    manager_signed_at     = NOW(),
    manager_signature_url = p_signature_url,
    updated_at            = NOW()
  WHERE id = p_request_id AND status = 'KOORDINATOR_SIGNED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request tidak ditemukan atau status bukan KOORDINATOR_SIGNED.';
  END IF;

  -- Jalankan distribusi material ke tas teknisi
  -- (sama seperti approve_material_request tapi dipanggil setelah manager sign)
  PERFORM approve_material_request(p_request_id, p_manager_id, NULL);

  RETURN p_request_id;
END;
$$;

-- =============================================================
-- SELESAI
-- Setelah semua step di atas berhasil:
-- 1. Pastikan ENV RESEND_API_KEY sudah diisi di Vercel/lokal
-- 2. Set NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
-- 3. Upload logo PLN Icon Plus ke public/logo-pln.png
-- =============================================================
