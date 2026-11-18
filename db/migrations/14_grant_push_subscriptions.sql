-- Migrasi 14: Grant hak akses tabel push_subscriptions ke authenticated
-- Melengkapi policy RLS (push_sub_select dkk) yang dibuat pada migrasi 12.

grant select, insert, update, delete on public.push_subscriptions to authenticated;
