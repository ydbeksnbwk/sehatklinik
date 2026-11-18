-- Migrasi 13: Tambah kolom jsonb 'detail' pada profil_klinik, layanan, dan dokter
-- Default aman '{}'::jsonb agar tidak merusak data yang sudah ada dan tidak ada penghapusan kolom.

ALTER TABLE profil_klinik 
  ADD COLUMN IF NOT EXISTS detail jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE layanan 
  ADD COLUMN IF NOT EXISTS detail jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE dokter 
  ADD COLUMN IF NOT EXISTS detail jsonb NOT NULL DEFAULT '{}'::jsonb;
