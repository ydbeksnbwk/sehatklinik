-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 10_perbaikan_handle_new_user_trigger.sql
-- Memperbaiki handle_new_user agar:
-- 1. Mendukung sinkronisasi peran saat GoTrue mengupdate raw_app_meta_data
-- 2. Hanya membuat baris pasien bila peran = 'pasien' dan data pasien ada
-- =====================================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := coalesce(
    nullif(new.raw_app_meta_data ->> 'role',''),
    nullif(new.raw_user_meta_data ->> 'role',''),
    'pasien'
  )::public.user_role;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nama text  := coalesce(nullif(btrim(v_meta ->> 'nama'),''), split_part(new.email,'@',1));
begin
  if TG_OP = 'INSERT' then
    insert into public.profiles(id, nama, telepon, role)
    values (new.id, v_nama, nullif(v_meta ->> 'telepon',''), v_role)
    on conflict (id) do update set
      nama = excluded.nama,
      telepon = coalesce(excluded.telepon, public.profiles.telepon),
      role = excluded.role;

    if v_role = 'pasien' and (v_meta ->> 'tanggal_lahir') is not null then
      insert into public.pasien(profile_id, nama, nik, tanggal_lahir, jenis_kelamin, alamat, telepon, kontak_darurat)
      values (new.id, v_nama, nullif(v_meta ->> 'nik',''), (v_meta ->> 'tanggal_lahir')::date,
              v_meta ->> 'jenis_kelamin', nullif(v_meta ->> 'alamat',''),
              nullif(v_meta ->> 'telepon',''), nullif(v_meta ->> 'kontak_darurat',''))
      on conflict (profile_id) do nothing;
    end if;
  elsif TG_OP = 'UPDATE' then
    if new.raw_app_meta_data ->> 'role' is not null and
       (old.raw_app_meta_data ->> 'role' is null or new.raw_app_meta_data ->> 'role' <> old.raw_app_meta_data ->> 'role') then
      update public.profiles
      set role = (new.raw_app_meta_data ->> 'role')::public.user_role
      where id = new.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
after insert or update of raw_app_meta_data on auth.users
for each row execute function public.handle_new_user();

grant execute on function public.handle_new_user() to supabase_auth_admin;
