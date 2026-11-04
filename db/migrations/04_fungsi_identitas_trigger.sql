-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 04_fungsi_identitas_trigger.sql
-- BAGIAN 4 - Fungsi identitas, trigger penjaga, trigger notifikasi dan audit
-- Jalankan berurutan sesuai nomor file. Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 7. FUNGSI IDENTITAS (dipakai RLS)
-- ---------------------------------------------------------------------
create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status_aktif
$$;

create function public.my_dokter_id() returns uuid
language sql stable security definer set search_path = public as $$
  select d.id from public.dokter d
  join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid() and p.status_aktif and p.role = 'dokter'
$$;

create function public.my_pasien_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ps.id from public.pasien ps
  join public.profiles p on p.id = ps.profile_id
  where ps.profile_id = auth.uid() and p.status_aktif and p.role = 'pasien'
$$;

-- ---------------------------------------------------------------------
-- 8. TRIGGER: AKUN BARU, PENJAGA KOLOM, ALUR STATUS
-- ---------------------------------------------------------------------
-- 8a. Akun baru di Supabase Auth -> profiles (+ pasien bila role pasien).
--     Role diambil dari raw_app_meta_data (hanya dapat diisi server/Admin API),
--     BUKAN dari raw_user_meta_data yang bisa diisi pengguna saat signUp.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := coalesce(nullif(new.raw_app_meta_data ->> 'role',''), 'pasien')::public.user_role;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nama text  := coalesce(nullif(btrim(v_meta ->> 'nama'),''), split_part(new.email,'@',1));
begin
  insert into public.profiles(id, nama, telepon, role)
  values (new.id, v_nama, nullif(v_meta ->> 'telepon',''), v_role);

  if v_role = 'pasien' then
    insert into public.pasien(profile_id, nama, nik, tanggal_lahir, jenis_kelamin, alamat, telepon, kontak_darurat)
    values (new.id, v_nama, nullif(v_meta ->> 'nik',''), (v_meta ->> 'tanggal_lahir')::date,
            v_meta ->> 'jenis_kelamin', nullif(v_meta ->> 'alamat',''),
            nullif(v_meta ->> 'telepon',''), nullif(v_meta ->> 'kontak_darurat',''));
  end if;
  return new;
end $$;

create trigger trg_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- 8b. role & status_aktif hanya boleh diubah Admin (dan bukan miliknya sendiri)
create function public.guard_profiles_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id then
    raise exception 'ID profil tidak dapat diubah' using errcode = '42501';
  end if;
  if (new.role is distinct from old.role or new.status_aktif is distinct from old.status_aktif)
     and auth.uid() is not null then
    if public.my_role() is distinct from 'admin' then
      raise exception 'Peran dan status akun hanya dapat diubah oleh Admin' using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'Admin tidak dapat mengubah peran atau status akunnya sendiri' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger trg_profiles_guard before update on public.profiles
for each row execute function public.guard_profiles_update();

-- 8c. pasien: no_rekam_medis & profile_id tetap; pasien biasa hanya ubah alamat/telepon/kontak darurat
create function public.guard_pasien_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.no_rekam_medis is distinct from old.no_rekam_medis
       or new.profile_id is distinct from old.profile_id then
      raise exception 'Nomor rekam medis dan akun pasien tidak dapat diubah' using errcode = '42501';
    end if;
    if public.my_role() = 'pasien' and (
         new.nama is distinct from old.nama or new.nik is distinct from old.nik
         or new.tanggal_lahir is distinct from old.tanggal_lahir
         or new.jenis_kelamin is distinct from old.jenis_kelamin) then
      raise exception 'Pasien hanya dapat mengubah alamat, telepon, dan kontak darurat' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger trg_pasien_guard before update on public.pasien
for each row execute function public.guard_pasien_update();

create function public.sync_pasien_ke_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null then
    update public.profiles set nama = new.nama, telepon = new.telepon where id = new.profile_id;
  end if;
  return new;
end $$;
create trigger trg_pasien_sync after update of nama, telepon on public.pasien
for each row when (new.nama is distinct from old.nama or new.telepon is distinct from old.telepon)
execute function public.sync_pasien_ke_profile();

-- 8d. kunjungan: tanggal harus sesuai hari jadwal; status mengikuti urutan; data pokok tetap
create function public.guard_kunjungan_insert() returns trigger
language plpgsql set search_path = public as $$
declare v_hari smallint;
begin
  select hari into v_hari from public.jadwal_praktik where id = new.jadwal_id;
  if extract(dow from new.tanggal)::smallint is distinct from v_hari then
    raise exception 'Tanggal kunjungan tidak sesuai dengan hari jadwal praktik';
  end if;
  return new;
end $$;
create trigger trg_kunjungan_insert before insert on public.kunjungan
for each row execute function public.guard_kunjungan_insert();

create function public.guard_kunjungan_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if row(new.pasien_id,new.dokter_id,new.layanan_id,new.jadwal_id,new.tanggal,new.no_referensi,new.sumber,new.dibuat_oleh)
     is distinct from
     row(old.pasien_id,old.dokter_id,old.layanan_id,old.jadwal_id,old.tanggal,old.no_referensi,old.sumber,old.dibuat_oleh) then
    raise exception 'Data pokok kunjungan tidak dapat diubah';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'terdaftar' and new.status in ('hadir','batal'))
         or (old.status = 'hadir'     and new.status in ('selesai','batal'))) then
      raise exception 'Status kunjungan tidak boleh berubah dari % ke %', old.status, new.status;
    end if;
    if new.status = 'selesai'
       and not exists (select 1 from public.pemeriksaan where kunjungan_id = new.id) then
      raise exception 'Kunjungan belum dapat diselesaikan karena belum ada catatan pemeriksaan';
    end if;
  end if;
  return new;
end $$;
create trigger trg_kunjungan_update before update on public.kunjungan
for each row execute function public.guard_kunjungan_update();

-- 8e. antrean: menunggu -> dipanggil -> diperiksa -> selesai; dilewati/batal = cabang akhir
create function public.guard_antrean_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if row(new.kunjungan_id,new.dokter_id,new.tanggal,new.nomor_antrean)
     is distinct from row(old.kunjungan_id,old.dokter_id,old.tanggal,old.nomor_antrean) then
    raise exception 'Nomor antrean tidak dapat diubah';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'menunggu'  and new.status in ('dipanggil','batal'))
         or (old.status = 'dipanggil' and new.status in ('diperiksa','dilewati','batal'))
         or (old.status = 'diperiksa' and new.status = 'selesai')) then
      raise exception 'Status antrean tidak boleh berubah dari % ke %', old.status, new.status;
    end if;
    if new.status = 'dipanggil' then
      if (select status from public.kunjungan where id = new.kunjungan_id) <> 'hadir' then
        raise exception 'Antrean hanya dapat dipanggil setelah pasien check-in';
      end if;
      new.waktu_dipanggil := now();
    end if;
  end if;
  return new;
end $$;
create trigger trg_antrean_update before update on public.antrean
for each row execute function public.guard_antrean_update();

-- ---------------------------------------------------------------------
-- 9. TRIGGER OPSIONAL: NOTIFIKASI
-- ---------------------------------------------------------------------
create function public.notif_antrean_baru() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid; v_sumber public.sumber_daftar;
begin
  select ps.profile_id, k.sumber into v_profile, v_sumber
  from public.kunjungan k join public.pasien ps on ps.id = k.pasien_id where k.id = new.kunjungan_id;

  if v_profile is not null then
    insert into public.notifikasi(profile_id, pesan)
    values (v_profile, 'Pendaftaran berhasil. Nomor antrean Anda: ' || new.nomor_antrean || ' (' || to_char(new.tanggal,'DD-MM-YYYY') || ')');
  end if;
  if v_sumber = 'online' then
    insert into public.notifikasi(profile_id, pesan)
    select id, 'Pendaftaran online baru, nomor antrean ' || new.nomor_antrean || ' tanggal ' || to_char(new.tanggal,'DD-MM-YYYY')
    from public.profiles where role = 'petugas' and status_aktif;
  end if;
  return new;
end $$;
create trigger trg_antrean_notif_baru after insert on public.antrean
for each row execute function public.notif_antrean_baru();

create function public.notif_antrean_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid; v_next record;
begin
  select ps.profile_id into v_profile
  from public.kunjungan k join public.pasien ps on ps.id = k.pasien_id where k.id = new.kunjungan_id;

  if v_profile is not null then
    insert into public.notifikasi(profile_id, pesan)
    select v_profile, case new.status
      when 'dipanggil' then 'Giliran Anda sudah dipanggil. Nomor antrean ' || new.nomor_antrean
      when 'dilewati'  then 'Antrean nomor ' || new.nomor_antrean || ' dilewati: ' || coalesce(new.alasan,'-')
      when 'batal'     then 'Kunjungan nomor antrean ' || new.nomor_antrean || ' dibatalkan'
    end
    where new.status in ('dipanggil','dilewati','batal');
  end if;

  if new.status = 'dipanggil' then   -- pengingat untuk antrean berikutnya
    select ps.profile_id, a.nomor_antrean into v_next
    from public.antrean a join public.kunjungan k on k.id = a.kunjungan_id
    join public.pasien ps on ps.id = k.pasien_id
    where a.dokter_id = new.dokter_id and a.tanggal = new.tanggal
      and a.status = 'menunggu' and a.nomor_antrean > new.nomor_antrean
    order by a.nomor_antrean limit 1;
    if v_next.profile_id is not null then
      insert into public.notifikasi(profile_id, pesan)
      values (v_next.profile_id, 'Giliran Anda hampir tiba. Nomor antrean ' || v_next.nomor_antrean);
    end if;
  end if;
  return new;
end $$;
create trigger trg_antrean_notif_status after update of status on public.antrean
for each row when (new.status is distinct from old.status)
execute function public.notif_antrean_status();
