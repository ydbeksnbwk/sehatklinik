-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 09_grant_supabase_auth_admin.sql
-- Memberikan hak USAGE dan EXECUTE kepada role supabase_auth_admin
-- agar trigger auth.users dapat memanggil public.handle_new_user()
-- =====================================================================

grant usage on schema public to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin;
