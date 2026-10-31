-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 03_tabel_transaksi.sql
-- BAGIAN 3 - Tabel transaksi (kunjungan, antrean, pemeriksaan, tindakan) dan tabel opsional
-- Jalankan berurutan sesuai nomor file. Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5. TABEL TRANSAKSI
-- ---------------------------------------------------------------------
create table public.kunjungan (
  id           uuid primary key default gen_random_uuid(),
  no_referensi text not null unique
               default ('KJ-' || lpad(nextval('public.seq_no_referensi')::text, 8, '0')),
  pasien_id    uuid not null references public.pasien(id),
  dokter_id    uuid not null references public.dokter(id),
  layanan_id   uuid not null references public.layanan(id),
  jadwal_id    uuid not null,
  dibuat_oleh  uuid not null references public.profiles(id),
  tanggal      date not null,
  keluhan      text not null check (length(btrim(keluhan)) between 1 and 500),
  sumber       public.sumber_daftar not null,
  status       public.status_kunjungan not null default 'terdaftar',
  created_at   timestamptz not null default now(),
  -- jadwal harus milik dokter yang dipilih
  constraint fk_kunjungan_jadwal  foreign key (jadwal_id, dokter_id)
    references public.jadwal_praktik(id, dokter_id),
  -- dokter harus melayani layanan yang dipilih
  constraint fk_kunjungan_dokter_layanan foreign key (dokter_id, layanan_id)
    references public.dokter_layanan(dokter_id, layanan_id),
  constraint uq_kunjungan_id_dokter     unique (id, dokter_id),
  constraint uq_kunjungan_id_dokter_tgl unique (id, dokter_id, tanggal)
);
-- satu pasien tidak boleh punya dua kunjungan aktif pada jadwal + tanggal yang sama
create unique index uq_kunjungan_aktif on public.kunjungan(pasien_id, jadwal_id, tanggal) where status <> 'batal';
create index idx_kunjungan_pasien  on public.kunjungan(pasien_id, tanggal desc);
create index idx_kunjungan_dokter  on public.kunjungan(dokter_id, tanggal);
create index idx_kunjungan_jadwal  on public.kunjungan(jadwal_id, tanggal) where status <> 'batal';

create table public.antrean (
  id              uuid primary key default gen_random_uuid(),
  kunjungan_id    uuid not null unique,
  dokter_id       uuid not null,
  tanggal         date not null,
  nomor_antrean   int  not null check (nomor_antrean > 0),
  status          public.status_antrean not null default 'menunggu',
  alasan          text,
  waktu_dipanggil timestamptz,
  constraint fk_antrean_kunjungan foreign key (kunjungan_id, dokter_id, tanggal)
    references public.kunjungan(id, dokter_id, tanggal),
  constraint uq_antrean_nomor unique (dokter_id, tanggal, nomor_antrean),
  constraint ck_antrean_alasan check (status not in ('dilewati','batal') or length(btrim(coalesce(alasan,''))) > 0)
);
create index idx_antrean_harian on public.antrean(dokter_id, tanggal, status);

create table public.pemeriksaan (
  id           uuid primary key default gen_random_uuid(),
  kunjungan_id uuid not null unique,
  dokter_id    uuid not null,
  anamnesis    text not null check (length(btrim(anamnesis)) > 0),
  tanda_vital  jsonb not null default '{}'::jsonb check (public.fn_valid_tanda_vital(tanda_vital)),
  diagnosis    text not null check (length(btrim(diagnosis)) > 0),
  catatan      text,
  created_at   timestamptz not null default now(),
  constraint fk_pemeriksaan_kunjungan foreign key (kunjungan_id, dokter_id)
    references public.kunjungan(id, dokter_id)
);

create table public.tindakan (
  id             uuid primary key default gen_random_uuid(),
  pemeriksaan_id uuid not null references public.pemeriksaan(id) on delete cascade,
  nama_tindakan  text not null check (length(btrim(nama_tindakan)) > 0),
  keterangan     text,
  saran          text
);
create index idx_tindakan_pemeriksaan on public.tindakan(pemeriksaan_id);

-- ---------------------------------------------------------------------
-- 6. TABEL OPSIONAL (prioritas P1): notifikasi
-- ---------------------------------------------------------------------
create table public.notifikasi (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pesan      text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifikasi_profile on public.notifikasi(profile_id, is_read, created_at desc);
