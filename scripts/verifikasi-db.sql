-- scripts/verifikasi-db.sql
-- Pembuktian Integritas Constraint Database (Lapisan Ketiga - PRD §6.2 & §11 Butir 3)
-- Seluruh pengujian dibungkus transaksi dengan ROLLBACK agar data tetap bersih dan idempoten.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. UJI CONSTRAINT: PASIEN (NIK Wajib Tepat 16 Digit Angka & Unik)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Coba insert NIK 15 digit (harus gagal oleh pasien_nik_check)
  BEGIN
    INSERT INTO pasien (no_rekam_medis, nama, nik, tanggal_lahir, jenis_kelamin)
    VALUES ('RM-TEST99', 'Pasien Invalid', '123456789012345', '1990-01-01', 'L');
    RAISE EXCEPTION 'GAGAL: NIK 15 digit seharusnya ditolak oleh CHECK constraint pasien_nik_check!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 1A LULUS: NIK 15 digit ditolak CHECK constraint (pasien_nik_check).';
  END;

  -- Coba insert NIK huruf (harus gagal oleh pasien_nik_check)
  BEGIN
    INSERT INTO pasien (no_rekam_medis, nama, nik, tanggal_lahir, jenis_kelamin)
    VALUES ('RM-TEST98', 'Pasien Invalid', '123456789012345A', '1990-01-01', 'L');
    RAISE EXCEPTION 'GAGAL: NIK huruf seharusnya ditolak oleh CHECK constraint!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 1B LULUS: NIK dengan huruf ditolak CHECK constraint.';
  END;
END $$;

-- -----------------------------------------------------------------------------
-- 2. UJI CONSTRAINT: DOKTER (No SIP Wajib Unik)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Coba insert dokter dengan SIP yang sudah ada (SIP-2026-0001 milik dr. Reyhan)
  BEGIN
    INSERT INTO dokter (nama, spesialisasi, no_sip, aktif)
    VALUES ('dr. Duplikat Sip', 'Umum', 'SIP-2026-0001', true);
    RAISE EXCEPTION 'GAGAL: No SIP duplikat seharusnya ditolak oleh UNIQUE constraint dokter_no_sip_key!';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'BUKTI 2 LULUS: No SIP duplikat ditolak UNIQUE constraint (dokter_no_sip_key).';
  END;
END $$;

-- -----------------------------------------------------------------------------
-- 3. UJI CONSTRAINT: JADWAL PRAKTIK (Jam Selesai > Jam Mulai & Kuota > 0)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_dokter_id uuid;
BEGIN
  SELECT id INTO v_dokter_id FROM dokter LIMIT 1;

  -- Coba insert jadwal dengan jam_selesai <= jam_mulai
  BEGIN
    INSERT INTO jadwal_praktik (dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif)
    VALUES (v_dokter_id, 2, '14:00:00', '10:00:00', 10, true);
    RAISE EXCEPTION 'GAGAL: Jam selesai <= jam mulai seharusnya ditolak oleh ck_jadwal_jam!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 3A LULUS: Jam selesai <= jam mulai ditolak CHECK constraint (ck_jadwal_jam).';
  END;

  -- Coba insert kuota 0
  BEGIN
    INSERT INTO jadwal_praktik (dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif)
    VALUES (v_dokter_id, 2, '08:00:00', '10:00:00', 0, true);
    RAISE EXCEPTION 'GAGAL: Kuota 0 seharusnya ditolak oleh jadwal_praktik_kuota_check!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 3B LULUS: Kuota <= 0 ditolak CHECK constraint (jadwal_praktik_kuota_check).';
  END;
END $$;

-- -----------------------------------------------------------------------------
-- 4. UJI CONSTRAINT: ANTREAN (Alasan Wajib untuk Dilewati atau Batal & Nomor > 0)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_kunjungan_id uuid;
  v_dokter_id uuid;
  v_tanggal date;
BEGIN
  -- Ambil satu kunjungan berstatus selesai untuk percobaan
  SELECT id, dokter_id, tanggal INTO v_kunjungan_id, v_dokter_id, v_tanggal
  FROM kunjungan
  WHERE status = 'selesai'
  LIMIT 1;

  -- Coba insert antrean dilewati tanpa alasan
  BEGIN
    INSERT INTO antrean (kunjungan_id, dokter_id, tanggal, nomor_antrean, status, alasan)
    VALUES (gen_random_uuid(), v_dokter_id, v_tanggal, 99, 'dilewati', NULL);
    RAISE EXCEPTION 'GAGAL: Antrean dilewati tanpa alasan seharusnya ditolak oleh ck_antrean_alasan!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 4A LULUS: Status dilewati/batal tanpa alasan ditolak CHECK constraint (ck_antrean_alasan).';
  END;

  -- Coba insert nomor antrean <= 0
  BEGIN
    INSERT INTO antrean (kunjungan_id, dokter_id, tanggal, nomor_antrean, status)
    VALUES (gen_random_uuid(), v_dokter_id, v_tanggal, 0, 'menunggu');
    RAISE EXCEPTION 'GAGAL: Nomor antrean 0 seharusnya ditolak oleh antrean_nomor_antrean_check!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 4B LULUS: Nomor antrean <= 0 ditolak CHECK constraint (antrean_nomor_antrean_check).';
  END;
END $$;

-- -----------------------------------------------------------------------------
-- 5. UJI CONSTRAINT: PEMERIKSAAN (Validasi Rentang Tanda Vital BR-18)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_kunjungan_id uuid;
  v_dokter_id uuid;
BEGIN
  SELECT id, dokter_id INTO v_kunjungan_id, v_dokter_id
  FROM kunjungan
  WHERE status = 'selesai'
  LIMIT 1;

  -- Coba insert tanda vital di luar rentang fisiologis (sistolik 40 < 50 atau suhu 50 > 45)
  BEGIN
    INSERT INTO pemeriksaan (kunjungan_id, dokter_id, anamnesis, tanda_vital, diagnosis)
    VALUES (
      gen_random_uuid(),
      v_dokter_id,
      'Uji tanda vital ekstrem',
      '{"sistolik": 40, "diastolik": 80, "suhu": 36.5, "berat_badan": 65, "tinggi_badan": 170}'::jsonb,
      'Uji Gagal'
    );
    RAISE EXCEPTION 'GAGAL: Sistolik di bawah 50 seharusnya ditolak oleh fn_valid_tanda_vital!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 5A LULUS: Tanda vital sistolik di bawah batas fisiologis ditolak constraint fn_valid_tanda_vital (BR-18).';
  END;

  BEGIN
    INSERT INTO pemeriksaan (kunjungan_id, dokter_id, anamnesis, tanda_vital, diagnosis)
    VALUES (
      gen_random_uuid(),
      v_dokter_id,
      'Uji tanda vital ekstrem',
      '{"sistolik": 120, "diastolik": 80, "suhu": 52.0, "berat_badan": 65, "tinggi_badan": 170}'::jsonb,
      'Uji Gagal'
    );
    RAISE EXCEPTION 'GAGAL: Suhu tubuh di atas 45 C seharusnya ditolak oleh fn_valid_tanda_vital!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'BUKTI 5B LULUS: Suhu tubuh di atas 45 C ditolak constraint fn_valid_tanda_vital (BR-18).';
  END;
END $$;

-- -----------------------------------------------------------------------------
-- 6. UJI CONSTRAINT: KUNJUNGAN AKTIF GANDA (BR-02 / uq_kunjungan_aktif)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_row record;
BEGIN
  -- Ambil kunjungan aktif yang sudah ada
  SELECT pasien_id, dokter_id, layanan_id, jadwal_id, tanggal
  INTO v_row
  FROM kunjungan
  WHERE status <> 'batal'
  LIMIT 1;

  -- Coba insert kunjungan kedua untuk pasien yang sama pada jadwal dan tanggal yang sama
  BEGIN
    INSERT INTO kunjungan (
      no_referensi, pasien_id, dokter_id, layanan_id, jadwal_id, dibuat_oleh, tanggal, keluhan, sumber, status
    )
    VALUES (
      'KJ-TESTDUPLIKAT',
      v_row.pasien_id,
      v_row.dokter_id,
      v_row.layanan_id,
      v_row.jadwal_id,
      'a0000000-0000-0000-0000-000000000002',
      v_row.tanggal,
      'Keluhan duplikat',
      'online',
      'terdaftar'
    );
    RAISE EXCEPTION 'GAGAL: Pendaftaran aktif ganda seharusnya ditolak oleh unique partial index uq_kunjungan_aktif!';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'BUKTI 6 LULUS: Pendaftaran aktif ganda pada jadwal & tanggal sama ditolak UNIQUE PARTIAL INDEX (uq_kunjungan_aktif, BR-02).';
  END;
END $$;

-- -----------------------------------------------------------------------------
-- 7. TAMPILKAN KOMPOSISI ANTREAN SAAT INI (Cocokkan dengan PRD §6.3)
-- -----------------------------------------------------------------------------
SELECT
  status AS "Status Antrean",
  count(*) AS "Jumlah Realita",
  CASE status
    WHEN 'menunggu' THEN 3
    WHEN 'dipanggil' THEN 1
    WHEN 'diperiksa' THEN 1
    WHEN 'selesai' THEN 5
    WHEN 'dilewati' THEN 1
    WHEN 'batal' THEN 1
    ELSE 0
  END AS "Target PRD §6.3",
  CASE count(*)
    WHEN (
      CASE status
        WHEN 'menunggu' THEN 3
        WHEN 'dipanggil' THEN 1
        WHEN 'diperiksa' THEN 1
        WHEN 'selesai' THEN 5
        WHEN 'dilewati' THEN 1
        WHEN 'batal' THEN 1
        ELSE 0
      END
    ) THEN 'COCOK (LULUS)'
    ELSE 'BERBEDA'
  END AS "Verifikasi"
FROM antrean
GROUP BY status
ORDER BY CASE status
  WHEN 'menunggu' THEN 1
  WHEN 'dipanggil' THEN 2
  WHEN 'diperiksa' THEN 3
  WHEN 'selesai' THEN 4
  WHEN 'dilewati' THEN 5
  WHEN 'batal' THEN 6
  ELSE 7
END;

-- Rollback seluruh operasi pengujian agar tidak meninggalkan data uji buatan di database
ROLLBACK;
