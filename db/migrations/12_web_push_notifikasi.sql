-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 12_web_push_notifikasi.sql
-- TAHAP 2: Tabel push_subscriptions, perluasan kolom notifikasi (outbox),
-- dan pembaruan trigger antrean untuk Web Push Notification.
-- =====================================================================

-- 1. TABEL push_subscriptions
create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  endpoint        text unique not null,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  aktif           boolean not null default true,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists idx_push_sub_profile on public.push_subscriptions(profile_id);

alter table public.push_subscriptions enable row level security;

-- Policy RLS push_subscriptions
drop policy if exists push_sub_select on public.push_subscriptions;
create policy push_sub_select on public.push_subscriptions
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists push_sub_insert on public.push_subscriptions;
create policy push_sub_insert on public.push_subscriptions
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists push_sub_update on public.push_subscriptions;
create policy push_sub_update on public.push_subscriptions
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists push_sub_delete on public.push_subscriptions;
create policy push_sub_delete on public.push_subscriptions
  for delete to authenticated using (profile_id = auth.uid());


-- 2. KOLOM TAMBAHAN PADA notifikasi (Outbox Web Push)
alter table public.notifikasi
  add column if not exists jenis_kejadian text check (
    jenis_kejadian in (
      'KUNJUNGAN_TERDAFTAR',
      'PENDAFTARAN_BARU',
      'ANTREAN_DIPANGGIL',
      'KUNJUNGAN_DIBATALKAN',
      'GILIRAN_MENDEKAT',
      'ANTREAN_DILEWATI',
      'INFO'
    )
  ),
  add column if not exists tautan text,
  add column if not exists push_status text not null default 'menunggu' check (push_status in ('menunggu', 'berhasil', 'gagal')),
  add column if not exists push_percobaan integer not null default 0 check (push_percobaan >= 0),
  add column if not exists push_error text,
  add column if not exists push_diproses_at timestamptz;

create index if not exists idx_notifikasi_push on public.notifikasi (push_status, created_at);


-- 3. PERBARUI FUNGSI TRIGGER NOTIFIKASI
create or replace function public.notif_antrean_baru() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_sumber public.sumber_daftar;
  v_dokter_nama text;
  v_tanggal text;
begin
  select ps.profile_id, k.sumber, coalesce(d.nama, 'Dokter'), to_char(new.tanggal, 'DD-MM-YYYY')
    into v_profile, v_sumber, v_dokter_nama, v_tanggal
  from public.kunjungan k
  join public.pasien ps on ps.id = k.pasien_id
  left join public.dokter d on d.id = k.dokter_id
  where k.id = new.kunjungan_id;

  if v_profile is not null then
    insert into public.notifikasi(profile_id, pesan, jenis_kejadian, tautan, push_status)
    values (
      v_profile,
      'Pendaftaran berhasil. Antrean: ' || new.nomor_antrean || ' (' || v_dokter_nama || ', ' || v_tanggal || ')',
      'KUNJUNGAN_TERDAFTAR',
      '/pasien',
      'menunggu'
    );
  end if;

  if v_sumber = 'online' then
    insert into public.notifikasi(profile_id, pesan, jenis_kejadian, tautan, push_status)
    select id,
      'Pendaftaran online baru, antrean ' || new.nomor_antrean || ' (' || v_dokter_nama || ', ' || v_tanggal || ')',
      'PENDAFTARAN_BARU',
      '/petugas',
      'menunggu'
    from public.profiles
    where role = 'petugas' and status_aktif;
  end if;

  return new;
end $$;

create or replace function public.notif_antrean_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_dokter_nama text;
  v_tanggal text;
  v_next record;
begin
  select ps.profile_id, coalesce(d.nama, 'Dokter'), to_char(new.tanggal, 'DD-MM-YYYY')
    into v_profile, v_dokter_nama, v_tanggal
  from public.kunjungan k
  join public.pasien ps on ps.id = k.pasien_id
  left join public.dokter d on d.id = k.dokter_id
  where k.id = new.kunjungan_id;

  if v_profile is not null then
    if new.status = 'dipanggil' then
      insert into public.notifikasi(profile_id, pesan, jenis_kejadian, tautan, push_status)
      values (
        v_profile,
        'Nomor antrean ' || new.nomor_antrean || ' dipanggil ke ruang periksa (' || v_dokter_nama || ')',
        'ANTREAN_DIPANGGIL',
        '/pasien',
        'menunggu'
      );
    elsif new.status = 'batal' then
      insert into public.notifikasi(profile_id, pesan, jenis_kejadian, tautan, push_status)
      values (
        v_profile,
        'Kunjungan nomor antrean ' || new.nomor_antrean || ' dibatalkan (' || v_dokter_nama || ')',
        'KUNJUNGAN_DIBATALKAN',
        '/pasien',
        'menunggu'
      );
    elsif new.status = 'dilewati' then
      insert into public.notifikasi(profile_id, pesan, jenis_kejadian, tautan, push_status)
      values (
        v_profile,
        'Antrean nomor ' || new.nomor_antrean || ' dilewati: ' || coalesce(new.alasan, '-'),
        'ANTREAN_DILEWATI',
        '/pasien',
        'menunggu'
      );
    end if;
  end if;

  if new.status = 'dipanggil' then
    select ps.profile_id, a.nomor_antrean, coalesce(d.nama, 'Dokter') as dokter_nama
      into v_next
    from public.antrean a
    join public.kunjungan k on k.id = a.kunjungan_id
    join public.pasien ps on ps.id = k.pasien_id
    left join public.dokter d on d.id = a.dokter_id
    where a.dokter_id = new.dokter_id
      and a.tanggal = new.tanggal
      and a.status = 'menunggu'
      and a.nomor_antrean > new.nomor_antrean
    order by a.nomor_antrean
    limit 1;

    if v_next.profile_id is not null then
      insert into public.notifikasi(profile_id, pesan, jenis_kejadian, tautan, push_status)
      values (
        v_next.profile_id,
        'Giliran Anda hampir tiba. Nomor antrean: ' || v_next.nomor_antrean || ' (' || v_next.dokter_nama || ')',
        'GILIRAN_MENDEKAT',
        '/pasien',
        'menunggu'
      );
    end if;
  end if;

  return new;
end $$;
