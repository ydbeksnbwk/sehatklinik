-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 02_tabel_akun_master.sql
-- BAGIAN 2 - Tabel akun (profiles, pasien) dan data master
-- Jalankan berurutan sesuai nomor file. Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3. TABEL AKUN
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nama         text not null check (length(btrim(nama)) between 1 and 150),
  telepon      text check (telepon ~ '^\+?[0-9]{8,15}$'),
  role         public.user_role not null default 'pasien',
  status_aktif boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.pasien (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid unique references public.profiles(id) on delete set null,  -- NULL = pasien walk-in tanpa akun
  no_rekam_medis  text not null unique
                  default ('RM-' || lpad(nextval('public.seq_no_rekam_medis')::text, 6, '0')),
  nama            text not null check (length(btrim(nama)) between 1 and 150),
  nik             text check (nik ~ '^[0-9]{16}$'),
  tanggal_lahir   date not null check (tanggal_lahir >= date '1900-01-01' and tanggal_lahir <= current_date),
  jenis_kelamin   text not null check (jenis_kelamin in ('L','P')),
  alamat          text,
  telepon         text check (telepon ~ '^\+?[0-9]{8,15}$'),
  kontak_darurat  text,
  created_at      timestamptz not null default now()
);
create unique index uq_pasien_nik on public.pasien(nik) where nik is not null;
create index idx_pasien_nama    on public.pasien(lower(nama));
create index idx_pasien_telepon on public.pasien(telepon);

-- ---------------------------------------------------------------------
-- 4. TABEL DATA MASTER
-- ---------------------------------------------------------------------
create table public.dokter (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique references public.profiles(id) on delete set null,  -- NULL = dokter belum punya akun
  nama        text not null check (length(btrim(nama)) > 0),
  spesialisasi text not null,
  no_sip      text not null unique,
  foto_path   text,            -- object key di bucket 'foto-dokter'
  deskripsi   text,
  aktif       boolean not null default true
);

create table public.layanan (
  id            uuid primary key default gen_random_uuid(),
  nama_layanan  text not null unique check (length(btrim(nama_layanan)) > 0),
  deskripsi     text,
  durasi_menit  int not null check (durasi_menit between 1 and 480),
  aktif         boolean not null default true
);

create table public.dokter_layanan (
  dokter_id  uuid not null references public.dokter(id)  on delete cascade,
  layanan_id uuid not null references public.layanan(id) on delete cascade,
  primary key (dokter_id, layanan_id)
);

create table public.jadwal_praktik (
  id          uuid primary key default gen_random_uuid(),
  dokter_id   uuid not null references public.dokter(id) on delete cascade,
  hari        smallint not null check (hari between 0 and 6),   -- 0=Minggu ... 6=Sabtu
  jam_mulai   time not null,
  jam_selesai time not null,
  kuota       int not null check (kuota > 0),
  aktif       boolean not null default true,
  constraint ck_jadwal_jam check (jam_selesai > jam_mulai),
  constraint uq_jadwal_id_dokter unique (id, dokter_id),
  -- jadwal bentrok pada dokter + hari yang sama ditolak
  constraint ex_jadwal_bentrok exclude using gist (
    (dokter_id::text) with =,   -- dicast ke text agar jalan di btree_gist versi lama (tanpa dukungan uuid)
    hari with =,
    tsrange(date '2000-01-01' + jam_mulai, date '2000-01-01' + jam_selesai) with &&
  ) where (aktif)
);

create table public.profil_klinik (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null,
  deskripsi       text,
  alamat          text,
  latitude        numeric(9,6) check (latitude  between -90  and 90),
  longitude       numeric(9,6) check (longitude between -180 and 180),
  kontak          text,
  jam_operasional jsonb not null default '{}'::jsonb
);
create unique index uq_profil_klinik_satu_baris on public.profil_klinik ((true));

