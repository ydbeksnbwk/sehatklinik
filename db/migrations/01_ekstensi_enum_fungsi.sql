-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 01_ekstensi_enum_fungsi.sql
-- BAGIAN 1 - Ekstensi, tipe ENUM, sequence, fungsi pembantu
-- Jalankan berurutan sesuai nomor file. Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- 0. EKSTENSI (dibutuhkan exclusion constraint jadwal bentrok)
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 1. TIPE ENUM
-- ---------------------------------------------------------------------
create type public.user_role         as enum ('pasien','petugas','dokter','admin');
create type public.sumber_daftar     as enum ('online','walk_in');
create type public.status_kunjungan  as enum ('terdaftar','hadir','selesai','batal');
create type public.status_antrean    as enum ('menunggu','dipanggil','diperiksa','selesai','dilewati','batal');

create sequence public.seq_no_rekam_medis;
create sequence public.seq_no_referensi;

-- ---------------------------------------------------------------------
-- 2. FUNGSI PEMBANTU DASAR
-- ---------------------------------------------------------------------
create function public.hari_ini() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- Rentang tanda vital: sistolik, diastolik, suhu, berat_badan, tinggi_badan
create function public.fn_valid_tanda_vital(tv jsonb) returns boolean
language plpgsql immutable as $$
declare
  k text;
  rng jsonb := '{"sistolik":[50,300],"diastolik":[30,200],"suhu":[30,45],"berat_badan":[1,500],"tinggi_badan":[20,250]}';
begin
  if tv is null or jsonb_typeof(tv) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(tv) loop
    if not (rng ? k) then return false; end if;
    if jsonb_typeof(tv -> k) <> 'number' then return false; end if;
    if (tv ->> k)::numeric < (rng -> k ->> 0)::numeric
       or (tv ->> k)::numeric > (rng -> k ->> 1)::numeric then
      return false;
    end if;
  end loop;
  return true;
end $$;

