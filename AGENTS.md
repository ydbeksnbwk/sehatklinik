# Pedoman Kerja Agen — Klinik Tim 7

Acuan tunggal: `docs/DOKUMEN_INDUK.md`. Setiap sesi, baca §1.3 (K1–K15) dan §3 lebih dulu,
lalu bagian yang ditunjuk prompt. Gerbang tahap dan prompt per tahap ada di §18 dokumen yang sama.
Proyek ini hanya memakai dua berkas pedoman: berkas ini dan `docs/DOKUMEN_INDUK.md`.

Urutan otoritas bila ada pertentangan:
ketentuan dosen > K1–K15 dan §16 > SRS/PRD lama > kode saat ini.
SRS dan PRD lama menyebut Prisma, sesi buatan sendiri, Supabase Realtime, dan notifikasi opsional.
Itu sudah digantikan oleh K1–K15. Jangan dipakai.

## Aturan keras

1. Backend = Next.js Route Handlers (JavaScript). Browser TIDAK memakai `supabase.from`,
   `supabase.rpc`, atau Supabase Realtime untuk data. Login, registrasi, dan logout lewat
   endpoint backend yang memanggil Supabase Auth.
2. Semua logika bisnis di backend. Fungsi DB `fn_...` tidak dipanggil aplikasi. Database
   adalah lapisan validasi ketiga (PK, FK, NOT NULL, UNIQUE, CHECK, exclusion, RLS).
3. Validasi tiga lapis independen: frontend, backend (Zod di SEMUA endpoint), database.
4. Operasi multi-langkah wajib transaksi. Pendaftaran kunjungan mengikuti §9.5
   (kunci baris jadwal, cek kuota, duplikat, dan nomor antrean dalam satu transaksi).
5. Otorisasi di server. Jangan percaya role, id pemilik, atau status dari client.
   Cek kepemilikan di setiap endpoint. Data milik orang lain → 404/403.
6. Secret (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `DATABASE_URL`, `REDIS_URL`)
   hanya di env server. Tidak di repo, tidak di kode browser, tidak di variabel `NEXT_PUBLIC_*`.
   Perbarui `.env.example` (tanpa nilai asli) setiap menambah variabel.
7. Isi notifikasi hanya nomor antrean, nama dokter, dan tanggal. Dilarang memuat keluhan atau diagnosis.
8. Kegagalan push tidak boleh membatalkan transaksi bisnis. Antrean BullMQ diisi SETELAH commit;
   tabel `notifikasi` berfungsi sebagai outbox cadangan.
9. Log terstruktur dengan Pino. Jangan mencatat password, token, atau private key.
10. Perubahan skema = file migrasi Drizzle BARU. Jangan edit migrasi lama.
    Jangan menyuruh manusia mengubah fungsi atau tabel langsung di SQL Editor Supabase,
    supaya database live tetap sama dengan repo.
11. Jangan menambah pustaka atau abstraksi tanpa manfaat nyata. Item P1 (§5.7, K15)
    hanya dikerjakan setelah semua P0 lulus.
12. Bila ada pertentangan, hal ambigu, atau kamu ingin menyimpang dari K1–K15:
    BERHENTI dan tanyakan. Jangan menebak. Catat di §16.2.

## Cara kerja per tahap

- Satu tahap per sesi. Tulis rencana singkat, tunggu persetujuan bila diminta, lalu implementasi.
- Akhiri tahap dengan: lint dan build, bukti verifikasi (perintah + hasil nyata),
  pembaruan `docs/STATUS.md`, dan commit per sub-tugas dengan pesan jelas.
- Jangan menulis "selesai" tanpa bukti yang benar-benar dijalankan. Jujur bila ada yang tidak bisa diuji.
- Jelaskan keputusan teknis penting di pesan commit atau `docs/ARSITEKTUR.md`
  (tim harus bisa menjelaskannya ke dosen).
- Untuk bug: cari akar masalah dari bukti asli (pesan galat, log) sebelum mengubah kode.
  Jangan menebak penyebab. Perbaikan seminimal mungkin.

## Konteks lingkungan

- Stack: Next.js 15 (App Router), React 19, TypeScript untuk frontend, JavaScript untuk Route Handlers,
  Drizzle ORM + `pg`, Supabase (Auth, Postgres, Storage).
- Pengembang memakai Windows + PowerShell. Beri perintah PowerShell, bukan bash, kecuali diminta.
  Hindari `node -e "..."` dengan tanda kutip ganda berlapis; tulis skrip ke berkas atau pakai here-string.
- Skrip npm yang ada: `dev`, `build`, `start`, `lint`, `db:pull`, `db:migrate`.
  Skrip `dev/build/start/lint` memakai `node ./node_modules/next/dist/bin/next ...`. Jangan diubah.
- Variabel `$A`, `$ad`, `$lay` dan fungsi `Login`/`Kirim` untuk uji API hilang tiap terminal dimulai ulang.
  Simpan sebagai `scripts/uji-api.ps1` agar bisa dipakai ulang dan menjadi bahan bukti verifikasi.
- Agen tidak punya akses ke dashboard Supabase (SQL Editor, Logs). Bila butuh hasil dari sana,
  tulis SQL atau langkahnya dan minta manusia menempelkan hasil persisnya.

## Aturan Git

- Kerja di cabang per tahap atau per bug (mis. `fix/admin-dokter`, `feat/zod-validasi`).
  Jangan commit langsung ke `main`.
- JANGAN `git push`, membuka PR, atau merge sebelum manusia menyetujui.
- Sebelum commit, pastikan `.env.local`, `.next`, dan `node_modules` tidak ikut (`git status --short`).
- Jangan menjalankan `npm audit fix --force`. Kerentanan paket ditinjau manual nanti.
- Jangan mengubah berkas frontend milik anggota lain (`ClinicContext.tsx`, `ClinicWorkspace.tsx`,
  `PublicSite.tsx`, `clinic-data.ts`, CSS) kecuali tugas Tahap 1B memintanya. Selaraskan dulu dengan
  `docs/Kontrak API Sistem Informasi Klinik Kesehatan.md`; bila respons API berbeda dari kontrak,
  tanyakan, jangan ubah sepihak.
- Setelah merge konflik, pastikan tidak ada penanda tersisa:
  `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":!package-lock.json"`.
  Jalankan `npm run build` sebelum push.

## Peta berkas penting

| Berkas | Isi |
|---|---|
| `docs/DOKUMEN_INDUK.md` | Acuan tunggal (bagian 1–17) dan panduan pengerjaan: peta dokumen, gerbang tahap, prompt (bagian 18) |
| `docs/STATUS.md` | Hasil audit dan status per kebutuhan (dibuat di Tahap 0) |
| `docs/BUKTI_VERIFIKASI.md` | Bukti uji (perintah + hasil) |
| `docs/Kontrak API Sistem Informasi Klinik Kesehatan.md` | Kontrak respons API untuk frontend |
| `docs/ref/` | Berkas asli dosen (`Technical_Requirements.md`, `Project_Akhir_Web_16_Tim.xlsx`) |
| `src/app/api/**/route.js` | Route Handler |
| `src/lib/` | `auth.js`, `akses.js`, `rls.js`, `supabase-admin.js`, `supabase.js`, `tanggal.js` |
| `src/db/schema.ts` | Skema Drizzle |
