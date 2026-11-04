-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 08_realtime_storage.sql
-- BAGIAN 8 - Realtime dan Storage (bucket + policy)
-- Jalankan berurutan sesuai nomor file. Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 13. REALTIME (status antrean tanpa muat ulang; RLS tetap berlaku)
-- ---------------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.antrean;    exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.kunjungan;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifikasi; exception when others then null; end $$;

-- ---------------------------------------------------------------------
-- 14. STORAGE
-- foto-dokter & klinik-aset : publik (baca), tulis hanya Admin, maks 2 MB
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('foto-dokter',          'foto-dokter',          true,  2097152, array['image/jpeg','image/png','image/webp']),
  ('klinik-aset',          'klinik-aset',          true,  2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy storage_publik_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('foto-dokter','klinik-aset'));
create policy storage_publik_admin on storage.objects for all to authenticated
  using (bucket_id in ('foto-dokter','klinik-aset') and public.my_role() = 'admin')
  with check (bucket_id in ('foto-dokter','klinik-aset') and public.my_role() = 'admin');
