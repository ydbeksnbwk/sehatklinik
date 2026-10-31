-- =====================================================================
-- SISTEM INFORMASI KLINIK KESEHATAN | 06_view.sql
-- BAGIAN 6 - View antrean, riwayat, rekap
-- Jalankan berurutan sesuai nomor file. Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 11. VIEW (security_invoker: RLS pemanggil tetap berlaku)
-- ---------------------------------------------------------------------
create view public.v_antrean_detail with (security_invoker = true) as
select a.id as antrean_id, a.kunjungan_id, a.dokter_id, a.tanggal, a.nomor_antrean,
       a.status as status_antrean, a.alasan, a.waktu_dipanggil,
       k.no_referensi, k.status as status_kunjungan, k.keluhan, k.sumber, k.layanan_id, k.jadwal_id,
       ps.id as pasien_id, ps.nama as nama_pasien, ps.no_rekam_medis,
       d.nama as nama_dokter, l.nama_layanan, jp.jam_mulai, jp.jam_selesai
from public.antrean a
join public.kunjungan k      on k.id  = a.kunjungan_id
join public.pasien ps        on ps.id = k.pasien_id
join public.dokter d         on d.id  = k.dokter_id
join public.layanan l        on l.id  = k.layanan_id
join public.jadwal_praktik jp on jp.id = k.jadwal_id;

create view public.v_riwayat_kunjungan with (security_invoker = true) as
select k.id as kunjungan_id, k.no_referensi, k.tanggal, k.status, k.sumber, k.keluhan, k.pasien_id,
       d.id as dokter_id, d.nama as nama_dokter, d.spesialisasi,
       l.nama_layanan, a.nomor_antrean, a.status as status_antrean,
       pm.id as pemeriksaan_id, pm.anamnesis, pm.tanda_vital, pm.diagnosis, pm.catatan
from public.kunjungan k
join public.dokter d  on d.id = k.dokter_id
join public.layanan l on l.id = k.layanan_id
left join public.antrean a      on a.kunjungan_id = k.id
left join public.pemeriksaan pm on pm.kunjungan_id = k.id;   -- RLS: hanya pasien pemilik & dokter penangan yang melihat isinya

create view public.v_rekap_kunjungan with (security_invoker = true) as
select k.tanggal,
       date_trunc('week',  k.tanggal)::date as minggu,
       date_trunc('month', k.tanggal)::date as bulan,
       k.dokter_id, d.nama as nama_dokter, k.layanan_id, l.nama_layanan,
       k.status, k.sumber, count(*)::int as jumlah
from public.kunjungan k
join public.dokter d  on d.id = k.dokter_id
join public.layanan l on l.id = k.layanan_id
group by k.tanggal, k.dokter_id, d.nama, k.layanan_id, l.nama_layanan, k.status, k.sumber;

