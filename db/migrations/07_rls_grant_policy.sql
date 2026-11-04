-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 07_rls_grant_policy.sql
-- BAGIAN 7 - Hak akses tabel (GRANT) dan Row Level Security
-- Jalankan berurutan sesuai nomor file. Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 12. HAK AKSES TABEL + ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant usage on sequence public.seq_no_rekam_medis, public.seq_no_referensi to authenticated;

grant select on public.profil_klinik, public.layanan, public.dokter,
                public.dokter_layanan, public.jadwal_praktik to anon;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.dokter, public.layanan, public.dokter_layanan,
      public.jadwal_praktik, public.profil_klinik to authenticated;           -- dibatasi RLS: Admin
grant update on public.profiles to authenticated;                              -- dibatasi RLS: Admin
grant insert, update on public.pasien to authenticated;                        -- dibatasi RLS: Petugas / pasien sendiri
grant update (keluhan) on public.kunjungan to authenticated;                   -- koreksi administratif (Petugas)
grant insert, update on public.pemeriksaan to authenticated;                   -- dibatasi RLS: Dokter pemilik
grant insert, update, delete on public.tindakan to authenticated;
grant update (is_read) on public.notifikasi to authenticated;

grant execute on function public.my_role(), public.my_dokter_id(), public.my_pasien_id(),
      public.hari_ini(), public.fn_valid_tanda_vital(jsonb)
  to authenticated;
grant execute on function public.hari_ini() to anon;

alter table public.profiles             enable row level security;
alter table public.pasien               enable row level security;
alter table public.dokter               enable row level security;
alter table public.layanan              enable row level security;
alter table public.dokter_layanan       enable row level security;
alter table public.jadwal_praktik       enable row level security;
alter table public.profil_klinik        enable row level security;
alter table public.kunjungan            enable row level security;
alter table public.antrean              enable row level security;
alter table public.pemeriksaan          enable row level security;
alter table public.tindakan             enable row level security;
alter table public.notifikasi           enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- data master: publik membaca yang aktif, pengguna login membaca semua (untuk riwayat), Admin menulis
create policy dokter_anon  on public.dokter for select to anon using (aktif);
create policy dokter_read  on public.dokter for select to authenticated using (true);
create policy dokter_admin on public.dokter for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy layanan_anon  on public.layanan for select to anon using (aktif);
create policy layanan_read  on public.layanan for select to authenticated using (true);
create policy layanan_admin on public.layanan for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy dl_read  on public.dokter_layanan for select to anon, authenticated using (true);
create policy dl_admin on public.dokter_layanan for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy jadwal_anon  on public.jadwal_praktik for select to anon using (aktif);
create policy jadwal_read  on public.jadwal_praktik for select to authenticated using (true);
create policy jadwal_admin on public.jadwal_praktik for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy klinik_read  on public.profil_klinik for select to anon, authenticated using (true);
create policy klinik_admin on public.profil_klinik for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- pasien
create policy pasien_self    on public.pasien for select to authenticated using (profile_id = auth.uid() and public.my_role() = 'pasien');
create policy pasien_staff   on public.pasien for select to authenticated using (public.my_role() in ('petugas','admin'));
create policy pasien_dokter  on public.pasien for select to authenticated using (
  public.my_role() = 'dokter' and exists (
    select 1 from public.kunjungan k where k.pasien_id = pasien.id and k.dokter_id = public.my_dokter_id()));
create policy pasien_insert  on public.pasien for insert to authenticated with check (public.my_role() = 'petugas');
create policy pasien_upd_petugas on public.pasien for update to authenticated
  using (public.my_role() = 'petugas') with check (public.my_role() = 'petugas');
create policy pasien_upd_self on public.pasien for update to authenticated
  using (profile_id = auth.uid() and public.my_role() = 'pasien')
  with check (profile_id = auth.uid() and public.my_role() = 'pasien');

-- kunjungan (pembuatan hanya lewat backend Next.js)
create policy kunjungan_pasien on public.kunjungan for select to authenticated
  using (public.my_role() = 'pasien' and pasien_id = public.my_pasien_id());
create policy kunjungan_dokter on public.kunjungan for select to authenticated
  using (public.my_role() = 'dokter' and dokter_id = public.my_dokter_id());
create policy kunjungan_staff  on public.kunjungan for select to authenticated
  using (public.my_role() in ('petugas','admin'));
create policy kunjungan_koreksi on public.kunjungan for update to authenticated
  using (public.my_role() = 'petugas') with check (public.my_role() = 'petugas');

-- antrean (perubahan status hanya lewat fungsi)
create policy antrean_pasien on public.antrean for select to authenticated using (
  public.my_role() = 'pasien' and exists (
    select 1 from public.kunjungan k where k.id = antrean.kunjungan_id and k.pasien_id = public.my_pasien_id()));
create policy antrean_dokter on public.antrean for select to authenticated
  using (public.my_role() = 'dokter' and dokter_id = public.my_dokter_id());
create policy antrean_staff  on public.antrean for select to authenticated
  using (public.my_role() in ('petugas','admin'));

-- pemeriksaan & tindakan: dokter pemilik (baca-tulis), pasien pemilik (baca saja); petugas & Admin tidak punya akses
create policy pemeriksaan_dokter on public.pemeriksaan for select to authenticated
  using (public.my_role() = 'dokter' and dokter_id = public.my_dokter_id());
create policy pemeriksaan_pasien on public.pemeriksaan for select to authenticated using (
  public.my_role() = 'pasien' and exists (
    select 1 from public.kunjungan k where k.id = pemeriksaan.kunjungan_id and k.pasien_id = public.my_pasien_id()));
create policy pemeriksaan_ins on public.pemeriksaan for insert to authenticated
  with check (public.my_role() = 'dokter' and dokter_id = public.my_dokter_id());
create policy pemeriksaan_upd on public.pemeriksaan for update to authenticated
  using (public.my_role() = 'dokter' and dokter_id = public.my_dokter_id())
  with check (public.my_role() = 'dokter' and dokter_id = public.my_dokter_id());

create policy tindakan_dokter on public.tindakan for all to authenticated
  using (public.my_role() = 'dokter' and exists (
    select 1 from public.pemeriksaan p where p.id = tindakan.pemeriksaan_id and p.dokter_id = public.my_dokter_id()))
  with check (public.my_role() = 'dokter' and exists (
    select 1 from public.pemeriksaan p where p.id = tindakan.pemeriksaan_id and p.dokter_id = public.my_dokter_id()));
create policy tindakan_pasien on public.tindakan for select to authenticated using (
  public.my_role() = 'pasien' and exists (
    select 1 from public.pemeriksaan p join public.kunjungan k on k.id = p.kunjungan_id
    where p.id = tindakan.pemeriksaan_id and k.pasien_id = public.my_pasien_id()));

-- notifikasi
create policy notif_select on public.notifikasi for select to authenticated using (profile_id = auth.uid());
create policy notif_update on public.notifikasi for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

