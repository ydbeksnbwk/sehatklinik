# PRD — Sistem Informasi Klinik Kesehatan (Tim 7)

**Versi 2.0 · 12 November 2026 · acuan tunggal pengerjaan.** Letakkan di `docs/PRD.md`.
Menggantikan `DOKUMEN_INDUK.md`, `RINGKAS.md`, `RENCANA_PENGERJAAN.md`, Kontrak API, dan SRS (dipindah ke `docs/arsip/`, tidak dibaca agen).
Kemajuan dicatat di `docs/STATUS.md`. Aturan kerja agen di `AGENTS.md` (root).

**Cara membaca (agen):** baca penuh §1–§4 setiap sesi (sekitar 120 baris). Bagian lain dibuka hanya bila tugas menyebutnya. Tugas dikerjakan per tahap di §10.

| § | Isi |
|---|---|
| 1 | Produk dan ruang lingkup |
| 2 | Keputusan mengikat K1–K15 |
| 3 | Ketentuan dosen (pokok) |
| 4 | Aturan bisnis BR-01..18 dan nilai referensi |
| 5 | Alur uji minimum dan pengujian tambahan |
| 6 | Data: tabel, constraint, data dummy |
| 7 | Web Push dan worker |
| 8 | Arsitektur, keamanan, API, halaman |
| 9 | Kebutuhan non-fungsional |
| 10 | Rencana tahap dan prompt kerja |
| 11 | Verifikasi akhir dan pertanyaan terbuka |

---

## 1. Produk dan ruang lingkup

Aplikasi web klinik: pasien mendaftar kunjungan dan memantau antrean, petugas mengelola kedatangan dan antrean, dokter mencatat pemeriksaan dan tindakan, admin mengelola dokter, layanan, jadwal, pengguna, dan rekap. Notifikasi nyata lewat Web Push dengan background worker.
Peran: `pasien`, `petugas`, `dokter`, `admin`.
**Bukan sasaran:** payment gateway (pembayaran cukup pencatatan status), rekam medis lanjutan, integrasi BPJS. Item P1 (giliran hampir tiba, log aktivitas, lampiran privat, CI) hanya setelah semua P0 lulus.

## 2. Keputusan mengikat (K1–K15)

| | Keputusan |
|---|---|
| K1 | Supabase Auth, dipanggil dari endpoint backend kita. Tidak ada tabel sesi atau `password_hash`. |
| K2 | Akses data lewat Drizzle ORM (atau `pg`). **Dilarang PostgREST** (`supabase.from`, `createAdminClient` untuk data). |
| K3 | Foto dokter di Supabase Storage; tabel menyimpan path. |
| K4 | Web Push nyata wajib; tabel `notifikasi` menjadi sumber kejadian. |
| K5 | Tanpa Realtime atau SDK Supabase di browser. Status antrean lewat polling 5 detik (atau SSE) ke API kita. |
| K6 | Web di Vercel. Worker dan Redis di layanan lain (Railway/Render + Upstash). |
| K7 | Zod di semua endpoint. |
| K8 | Kode API JavaScript; `schema.ts` boleh TypeScript. Satu URL tidak boleh punya `route.js` dan `route.ts`. |
| K9 | Semua logika bisnis di backend JS. Fungsi DB `fn_...` tidak dipanggil aplikasi. DB = lapisan validasi ketiga. |
| K10 | NIK wajib 16 digit angka, unik. |
| K11 | Pasien membatalkan hanya saat antrean Menunggu dan paling lambat 2 jam sebelum jam mulai praktik (`BATAS_BATAL_JAM = 2`). Petugas boleh selama belum diperiksa. |
| K12 | Hanya petugas: check-in, walk-in, batal kunjungan. Admin ditolak 403. |
| K13 | `push_subscriptions` wajib; status kirim sebagai kolom di `notifikasi`. |
| K14 | Petugas dan dokter boleh panggil/lewati. Hanya dokter memulai pemeriksaan. |
| K15 | `lampiran_pemeriksaan` dan `log_aktivitas` ditunda (P1). |

Urutan otoritas: ketentuan dosen > K1–K15 > berkas arsip > kode saat ini. Hal ambigu: berhenti dan tanya.

## 3. Ketentuan dosen (pokok)

**Halaman utama tanpa login:** profil klinik, layanan, dokter, jadwal praktik, lokasi (peta), jam operasional, tombol Daftar Kunjungan.
**Dashboard:** Pasien (profil, daftar kunjungan, nomor antrean, status dan riwayat pribadi); Petugas (pendaftaran, antrean, administrasi); Dokter (antrean, hasil pemeriksaan, tindakan); Admin (dokter, layanan, jadwal, pengguna, rekap).
**Fungsional wajib:** kelola dokter/layanan/jadwal; daftar kunjungan; nomor antrean per dokter dan tanggal; batasi kuota; panggil antrean; catat pemeriksaan dan tindakan; selesaikan kunjungan.

**Tujuh belas ketentuan umum**

| No | Ketentuan |
|---|---|
| 1 | Teknologi: Next.js, React, JavaScript, PostgreSQL, Git; riwayat Git wajar |
| 2 | Data tersimpan di database persisten, bukan memori/`localStorage` |
| 3 | Aset (foto dokter) di object storage (Supabase Storage) |
| 4 | Berkas privat tidak dapat diakses tanpa izin |
| 5 | Dashboard memerlukan sesi Supabase Auth valid; tanpa sesi diarahkan ke login |
| 6 | Otorisasi per peran di server + RLS |
| 7 | Tidak ada secret di repo atau browser; `.env.example` tersedia |
| 8 | Integritas data: constraint DB, transaksi |
| 9 | Validasi masukan di frontend, backend, database |
| 10 | Angka dashboard/rekap konsisten dengan data database |
| 11 | Antarmuka responsif dan dapat dipakai keyboard |
| 12 | Umpan balik jelas: loading, kosong, berhasil, gagal; tombol nonaktif saat submit |
| 13 | Daftar punya pencarian/filter dan pagination |
| 14 | Aplikasi ter-deploy dan berfungsi tanpa server lokal |
| 15 | Data dummy minimal 5 pasien, 5 jadwal, 5 kunjungan |
| 16 | Data dummy bervariasi status (komposisi di §6.3) |
| 17 | Pembayaran cukup pencatatan status |

**Technical Requirements (ringkas):** validasi tiga lapis yang dapat didemonstrasikan independen; **dilarang PostgREST/layanan lain sebagai pengganti backend**; migrasi bisa membangun ulang DB; transaksi dan pertimbangan race condition; pagination dan hindari N+1; hak akses di server, jangan percaya role/id/status dari client; rate limiting; Web Push nyata (Service Worker, VAPID, `web-push`, worker terpisah, antrean persisten, retry terbatas, anti-ganda); log terstruktur (Pino) tanpa data sensitif dan kegagalan worker tidak diam-diam; dokumentasi: instalasi, `.env.example`, migrasi, ERD, arsitektur, VAPID dan worker, daftar fitur dan keterbatasan; HTTPS untuk Web Push. Penyimpangan wajib butuh persetujuan dosen; bila ambigu minta klarifikasi. Tampilan bagus saja tidak cukup.

## 4. Aturan bisnis

| Kode | Aturan |
|---|---|
| BR-01 | Kuota = batas kunjungan aktif (tidak batal) per jadwal per tanggal. |
| BR-02 | Satu pasien maksimal satu kunjungan aktif per jadwal per tanggal (409). |
| BR-03 | Nomor antrean unik per (dokter, tanggal), otomatis oleh sistem. |
| BR-04 | Cek kuota + nomor antrean dalam satu transaksi dengan kunci baris dokter. |
| BR-05 | Antrean dipanggil hanya setelah check-in (kunjungan Hadir). |
| BR-06 | Antrean: Menunggu → Dipanggil → Sedang Diperiksa → Selesai. Menunggu → Batal. Dipanggil → Dilewati/Batal. |
| BR-07 | Kunjungan: Terdaftar → Hadir → Selesai. Terdaftar/Hadir → Batal. |
| BR-08 | Pasien batal: antrean Menunggu dan ≥ 2 jam sebelum mulai praktik. |
| BR-09 | Kunjungan tidak selesai sebelum ada catatan pemeriksaan. |
| BR-10 | Pemeriksaan hanya saat antrean Sedang Diperiksa, hanya oleh dokter pemilik kunjungan (id dari sesi). |
| BR-11 | Peran/status hanya diubah admin; admin tidak mengubah akunnya sendiri. |
| BR-12 | Pasien walk-in boleh tanpa akun (`profile_id` kosong). |
| BR-13 | Tanggal sesuai hari praktik (0 Minggu … 6 Sabtu), bukan masa lalu; hari ini harus sebelum jam selesai. |
| BR-14 | Dokter aktif dan melayani layanan yang dipilih. |
| BR-15 | Lewati dan batal wajib alasan (min 3 karakter). |
| BR-16 | Dokter nonaktif tidak tampil publik; akun loginnya ikut nonaktif. |
| BR-17 | No. RM, no. referensi kunjungan, no. SIP, NIK unik. |
| BR-18 | Vital: sistolik 50–300, diastolik 30–200, suhu 30–45, berat 1–500, tinggi 20–250 (angka). |

Nilai referensi: sumber `online|walk_in`; status kunjungan `terdaftar|hadir|selesai|batal`; status antrean `menunggu|dipanggil|diperiksa|selesai|dilewati|batal`.
Privasi medis: petugas dan admin tidak membaca pemeriksaan; hanya dokter pemilik dan pasien pemilik (baca).

## 5. Alur uji minimum

Harus berjalan dari UI sampai database pada URL deployment, akun uji tiap peran, worker proses terpisah.

| Langkah | Aktor | Tindakan | Hasil |
|---|---|---|---|
| 1 | Pasien | Aktifkan Notifikasi, beri izin | Subscription tersimpan dan terhubung ke pasien |
| 2 | Pasien | Login, pilih layanan, dokter, tanggal, sesi, kirim | Kunjungan Terdaftar, nomor antrean unik; push muncul di pasien dan petugas |
| 3 | Pasien | Buka dasbor | Nomor antrean aktif dan status Menunggu |
| 4 | Petugas | Buka antrean, check-in | Kunjungan Hadir |
| 5 | Petugas | Panggil | Status Dipanggil tampil di dasbor pasien tanpa muat ulang; push diterima, klik membuka dasbor |
| 6 | Dokter | Buka antrean pribadi, mulai periksa | Sedang Diperiksa; hanya pasien dokter itu terlihat |
| 7 | Dokter | Isi pemeriksaan dan tindakan, simpan, selesaikan | Antrean dan kunjungan Selesai |
| 8 | Pasien | Buka riwayat | Tampil; pasien lain tidak bisa melihat |
| 9 | Admin | Buka rekap | Jumlah konsisten dengan daftar |
| 10 | Admin/petugas | Buka daftar pekerjaan notifikasi | Berhasil dan gagal tampil dengan percobaan dan penyebab |

**Pengujian tambahan:** kuota penuh ditolak; pendaftaran ganda ditolak; kirim ulang form tidak membuat ganda; dashboard tanpa login diarahkan ke login; ganti ID di URL tidak membuka data orang lain; pengguna tidak bisa mengubah perannya lewat profil; data tetap ada setelah refresh/logout/perangkat lain; curl tanpa frontend ditolak bila tidak valid; data tidak valid ditolak constraint DB; subscription 404/410 dinonaktifkan tanpa menghentikan worker; worker dihentikan lalu dijalankan tanpa kehilangan pekerjaan; push gagal (termasuk Redis mati) tidak membatalkan kunjungan.

## 6. Data

### 6.1 Tabel

| Tabel | Kolom kunci |
|---|---|
| `profiles` | id (= auth.users.id), nama, telepon, role, status_aktif |
| `pasien` | id, profile_id (null untuk walk-in), no_rekam_medis, nama, nik, tanggal_lahir, jenis_kelamin, alamat, telepon, kontak_darurat |
| `dokter` | id, profile_id, nama, spesialisasi, no_sip, foto_path, deskripsi, aktif |
| `layanan` | id, nama_layanan, deskripsi, durasi_menit, aktif |
| `dokter_layanan` | dokter_id, layanan_id |
| `jadwal_praktik` | id, dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif |
| `profil_klinik` | id, nama, deskripsi, alamat, latitude, longitude, kontak, jam_operasional (jsonb) |
| `kunjungan` | id, no_referensi, pasien_id, dokter_id, layanan_id, jadwal_id, dibuat_oleh, tanggal, keluhan, sumber, status, created_at |
| `antrean` | id, kunjungan_id, dokter_id, tanggal, nomor_antrean, status, alasan, waktu_dipanggil |
| `pemeriksaan` | id, kunjungan_id, dokter_id, anamnesis, tanda_vital (jsonb), diagnosis, catatan |
| `tindakan` | id, pemeriksaan_id, nama_tindakan, keterangan, saran |
| `notifikasi` | id, profile_id, pesan, is_read, created_at + kolom push (§7.2) |
| `push_subscriptions` | lihat §7.2 |

Tidak dibuat: tabel `sesi`, `password_hash`, `notifikasi_job`. P1: `lampiran_pemeriksaan`, `log_aktivitas`.

### 6.2 Constraint (lapisan ketiga)

`profiles.role` CHECK 4 nilai. `pasien`: `no_rekam_medis` UNIQUE, `nik` UNIQUE NOT NULL CHECK `^[0-9]{16}$`, `jenis_kelamin` CHECK L/P. `dokter.no_sip` UNIQUE NOT NULL. `layanan.durasi_menit` > 0.
`jadwal_praktik`: `hari` 0..6, `kuota` > 0, `jam_selesai > jam_mulai`, exclusion constraint jadwal tumpang tindih (`btree_gist`).
`kunjungan`: `no_referensi` UNIQUE, `sumber` dan `status` CHECK, unique partial index `(pasien_id, jadwal_id, tanggal) WHERE status <> 'batal'`.
`antrean`: UNIQUE `(dokter_id, tanggal, nomor_antrean)`, `kunjungan_id` UNIQUE, `status` CHECK.
`pemeriksaan`: `kunjungan_id` UNIQUE, `tanda_vital` CHECK rentang BR-18.
Migrasi SQL 01–11 sudah ada (`db/migrations`, dijalankan `npm run db:migrate`). Perubahan skema = berkas baru bernomor berikutnya + perbarui `src/db/schema.ts`. Jangan edit migrasi lama. Trigger `handle_new_user` hanya membaca `raw_app_meta_data.role` (migrasi 11).

### 6.3 Data dummy (seed idempoten, `npm run db:seed`)

5+ pasien (≥1 walk-in tanpa akun, 2 berakun), 5 dokter (≥2 berakun), 5 layanan, 5+ jadwal (satu kuota 3 terisi 2, satu kuota 2 terisi 2 penuh), 12 kunjungan, 5 pemeriksaan, 5 tindakan, akun uji (1 admin, 1 petugas, 2 dokter, 2 pasien; kata sandi didokumentasikan di README), contoh subscription dan notifikasi (menunggu/berhasil/gagal).

| Antrean | Jumlah | Kunjungan |
|---|---|---|
| Menunggu | 3 | Terdaftar 2, Hadir 1 |
| Dipanggil | 1 | Hadir |
| Diperiksa | 1 | Hadir |
| Selesai | 5 | Selesai, masing-masing ada pemeriksaan |
| Dilewati | 1 | Hadir, dengan alasan |
| Batal | 1 | Batal, dengan alasan |

## 7. Web Push dan worker

### 7.1 Alur

Kejadian bisnis → baris `notifikasi` (trigger DB, `push_status='menunggu'`) → pemindai worker saat start dan tiap 30 detik + enqueue BullMQ (`jobId` = id notifikasi) → processor kirim via `web-push` + VAPID → Service Worker `sw.js` menampilkan notifikasi; klik membuka tautan. Aplikasi web hanya mencoba enqueue setelah commit; Redis mati tidak menggagalkan transaksi bisnis dan pemindai menanggung.

### 7.2 Database

`push_subscriptions`: id, profile_id (FK profiles ON DELETE CASCADE), endpoint (UNIQUE NOT NULL), p256dh, auth, user_agent, aktif (default true), created_at, last_success_at; indeks `profile_id`; RLS pemilik (baca/tambah/hapus miliknya).
`notifikasi` tambahan: `jenis_kejadian` (CHECK), `tautan`, `push_status` (CHECK menunggu/berhasil/gagal, default menunggu), `push_percobaan` (CHECK ≥ 0, default 0), `push_error`, `push_diproses_at`; indeks `(push_status, created_at)`.

### 7.3 Kejadian wajib

| Kode | Pemicu | Penerima | Tujuan klik |
|---|---|---|---|
| KUNJUNGAN_TERDAFTAR | Pendaftaran berhasil | Pasien | Dasbor pasien |
| PENDAFTARAN_BARU | Pasien mendaftar daring | Semua petugas aktif | Antrean petugas |
| ANTREAN_DIPANGGIL | Status Dipanggil | Pasien | Dasbor pasien |
| KUNJUNGAN_DIBATALKAN | Antrean/kunjungan batal | Pasien | Riwayat |

**Isi notifikasi hanya nomor antrean, nama dokter, tanggal.** Dilarang memuat keluhan atau diagnosis.

### 7.4 Pengiriman dan hasil

201 → berhasil + `push_diproses_at`. 404/410 → nonaktifkan subscription, tanpa retry. Tidak ada subscription aktif → gagal dengan alasan. 429/5xx/timeout → retry exponential backoff maks 5×. 400/401/403 → gagal tanpa retry, log error. Percobaan habis → gagal + `push_error`. Cegah kirim ganda (cek status, update atomik). Pino mencatat durasi, status job, error; SIGTERM ditangani rapi. Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (hanya server), `VAPID_SUBJECT`, `REDIS_URL` (`rediss://` untuk Upstash), `DATABASE_URL` (koneksi langsung/session untuk worker).

### 7.5 Komponen

`public/sw.js` (event `push`, `notificationclick`); tombol Aktifkan Notifikasi (izin hanya setelah klik; tangani ditolak, tidak didukung, subscription tidak valid); `GET /api/push/kunci`; `POST/DELETE /api/push/langganan`; `GET /api/admin/pekerjaan-notifikasi` (admin dan petugas, filter status, pagination) + halamannya; `worker/index.js` (`npm run worker`).

### 7.6 Bukti

(1) push muncul di browser pasien dan petugas saat daftar; (2) panggil → push, klik membuka dasbor; (3) endpoint palsu 404/410 → dinonaktifkan; (4) stop lalu start worker → tidak hilang dan tidak ganda; (5) Redis mati → pendaftaran tetap berhasil dan push terkirim setelah Redis pulih.

## 8. Arsitektur, keamanan, API, halaman

**Lapisan:** Browser (React) → Route Handlers Next.js (otorisasi, Zod, logika bisnis, transaksi Drizzle) → PostgreSQL (constraint, RLS, trigger). `supabase-js` hanya di server untuk Auth dan Storage. Worker proses terpisah membaca outbox `notifikasi`.
**Sesi:** login lewat `/api/auth/login`, cookie httpOnly (Secure di production, SameSite=Lax), cek Origin pada metode non-GET, token tidak di body. Header Bearer hanya untuk skrip uji. Middleware mengarahkan halaman dasbor tanpa sesi ke `/login`. Peran dibaca dari database/`app_metadata` di server.
**RLS dan role koneksi:** `DATABASE_URL` memakai role `postgres` (melewati RLS). Otorisasi utama di server (`requireRole` + cek kepemilikan). Baca data milik pengguna memakai `denganRls`; tulis multi-langkah memakai `db` dalam transaksi dengan otorisasi ketat. Jelaskan jujur saat demo.
**Transaksi pendaftaran (BR-04):** `db.transaction`: kunci baris dokter (`.for("update")`), cek jadwal/hari/jam, dokter aktif dan melayani layanan, kuota, duplikat, hitung nomor antrean, insert kunjungan + antrean.
**Format API:** sukses `{ "data": ..., "meta": { page, pageSize, total, totalPages } }`, field camelCase. Galat `{ "error": { "code", "message", "fields" } }` dengan status 400/401/403/404/409/422/429/500, tanpa stack atau SQL ke client. Pagination wajib pada daftar.

**Rute API dipertahankan:** `/api/public/{klinik,layanan,dokter,jadwal}`, `/api/auth/{register,login,logout,me}`, `/api/profil`, `/api/kunjungan`, `/api/kunjungan/[id]`, `/api/kunjungan/[id]/transition` (checkin, panggil, periksa, lewati, batal, selesai), `/api/kunjungan/[id]/pemeriksaan`, `/api/pasien`, `/api/riwayat`, `/api/notifikasi`, `/api/admin/{dokter,jadwal}`. **Menyusul:** `/api/admin/{layanan,pengguna,profil-klinik,rekap,pekerjaan-notifikasi}`, `/api/admin/dokter/[id]/foto`, `/api/push/{kunci,langganan}`.

| Peran | Boleh |
|---|---|
| Pasien | profil sendiri (alamat, telepon, kontak darurat saja), daftar kunjungan sendiri, batal sendiri (BR-08), riwayat sendiri |
| Petugas | pasien, walk-in, check-in, panggil, lewati, batal kunjungan, daftar pekerjaan notifikasi |
| Dokter | antrean pribadi, panggil/lewati, mulai periksa, pemeriksaan + tindakan, selesaikan, riwayat pasien yang ditangani |
| Admin | CRUD dokter, layanan, jadwal, pengguna, profil klinik; rekap; pekerjaan notifikasi. **Bukan** check-in/walk-in/batal kunjungan. |

**Halaman frontend (rute yang sudah ada dipertahankan):** `/`, `/layanan`, `/layanan/[id]`, `/dokter`, `/dokter/[id]`, `/jadwal`, `/lokasi`, `/login`, `/daftar`, `/dashboard` (pasien), `/pasien`, `/petugas`, `/dokter/dashboard` dan `/dokter-dashboard`, `/admin`, `/profil`, `/kunjungan/[id]`, `/riwayat/[id]`. Perilaku UI wajib: skeleton saat memuat, keterangan kosong, toast/pesan inline berhasil dan gagal, tombol nonaktif saat submit, daftar dengan pencarian/filter dan pagination, tabel menggulir di ponsel, fokus keyboard terlihat.

## 9. Non-fungsional

Rate limiting pada login, registrasi, daftar kunjungan, langganan push (429 + `Retry-After`; Redis bila ada, memori bila tidak, fail-open dengan log). Pino terstruktur dengan redaksi data sensitif. Unggah foto: ≤ 2 MB, tipe jpeg/png/webp dicek dari isi, nama berkas oleh server, bucket `foto-dokter` (baca publik, tulis hanya server). Tidak ada secret di repo atau bundle browser; hanya `NEXT_PUBLIC_*` (URL, kunci publik VAPID) yang boleh di browser. Halaman publik ≤ 3 detik di 4G. Responsif dan keyboard. Dapat dibangun ulang dari README, migrasi, seed, `.env.example`.

## 10. Rencana tahap dan prompt kerja

**Prioritas:** Langkah 0 → 1A → 1B → 1C → 2 → 3 → 4 → 1D → 1E → 5 → 6 → (7 opsional). Jalur cepat bila waktu mepet: 0, 1A, 1B, 1C (alur inti), 2, 3, 4, 5 (bukti dan README), 6; 1D parsial (layanan, pengguna, rekap), 1E hanya rate limit dan Pino. Jangan memotong 1A.
**Cara menugaskan agy** (tempel ini saja): *"Baca AGENTS.md dan docs/PRD.md §1–§4. Kerjakan Tahap X di docs/PRD.md §10 (buka hanya bagian itu dan bagian yang disebut). Berhenti setelah butir N dan laporkan."*
**Tiap tahap:** cek `git branch --show-current` dan `git status --short` (harus sesuai/bersih), satu commit per sub-tugas dengan pesan yang menjelaskan keputusan teknis, bukti dijalankan (perintah + hasil nyata), perbarui `docs/STATUS.md`, jangan `push`/`merge`, jangan cetak secret, berhenti dan tanya bila ambigu. Pekerjaan lama ada di `stash@{0}` (Zod, logger, rate limit): boleh dibaca (`git show "stash@{0}^3:<path>"`), dilarang `stash pop/drop/clear`, jangan pakai `middleware.ts` darinya.

### Langkah 0 (manusia)
Simpan audit dan dokumen ini, rapikan `docs/` (§ catatan di AGENTS.md), merge ke `main`, `npm install`, `npm run build`, kabari teman (jangan edit `src/app/api`, `ClinicContext.tsx`, `src/components`, `src/middleware.ts`), kirim pertanyaan ke dosen (§11), buat cabang `feat/tahap-1`.

### Tahap 1A — Pulihkan backend inti (cabang `feat/tahap-1`)
Konteks: merge frontend mengganti route aman dengan `route.ts` tanpa auth/transaksi dan memakai PostgREST. Pertahankan URL yang dipanggil frontend; tulis ulang sebagai `route.js`, hapus `route.ts` padanannya.
1. Modul domain `src/lib/domain/` (kunjungan, transisi, pemeriksaan, pasien); semua data lewat Drizzle; `createAdminClient` tidak untuk data.
2. `POST /api/kunjungan`: `requireRole`; pasien hanya dirinya, walk-in hanya petugas; transaksi BR-01, 02, 03, 04, 13, 14 (409 untuk kuota/duplikat).
3. `POST /api/kunjungan/[id]/transition`: BR-05, 06, 07, 09, 15; peran K12/K14 (admin 403); pasien batal BR-08 (`BATAS_BATAL_JAM = 2`); `await params`.
4. `PUT /api/kunjungan/[id]/pemeriksaan`: `dokterId` dari sesi, antrean Diperiksa, BR-18, pemeriksaan + tindakan satu transaksi.
5. `GET/POST /api/pasien`: hanya petugas/admin, pagination + `meta`, pencarian, NIK 16 digit, galat DB sebagai 4xx/500.
6. `POST /api/auth/register`: NIK 16 digit, password kuat, telepon `^\+?[0-9]{8,15}$`, tanggal lahir bukan masa depan; `auth/daftar` menjadi alias.
7. Zod di lima endpoint (satu berkas per domain di `src/lib/validasi/`, pesan Indonesia), format respons sesuai §8. Selisih yang memutus frontend dicatat di STATUS untuk 1C.
8. Hapus `route.ts`; `src/utils/supabase/admin.ts` tanpa fallback ke publishable key; perluas `scripts/uji-api.ps1`.
**Bukti:** tanpa login 401; pasien memanggil transisi petugas 403; admin check-in 403; kuota penuh 409; duplikat 409; dua pendaftaran serentak tanpa nomor ganda; ID orang lain 403/404; NIK 15 digit 400; vital di luar rentang 400; batal < 2 jam 409; pemeriksaan dokter lain 403; `GET /api/pasien` tanpa login 401; `createAdminClient` hanya muncul di rute Auth/Storage; `npm run build` lolos.

### Tahap 1B — Sesi cookie httpOnly, logout, middleware
Tulis rancangan singkat (≤ 15 baris: nama cookie, atribut, umur, refresh, CSRF, penilaian middleware) dan **berhenti untuk persetujuan**. Lalu:
1. `POST /api/auth/login` (Zod, cek `status_aktif`, set cookie, tanpa token di body), `POST /api/auth/logout` (hapus cookie, batalkan sesi), `GET /api/auth/me`, refresh otomatis.
2. `src/lib/auth.js`: cookie lebih dulu, Bearer hanya skrip uji; peran dari database.
3. `src/middleware.ts`: lindungi halaman dasbor, `/profil`, `/kunjungan/[id]`, `/riwayat/[id]`; pertahankan guard env dan try/catch; hapus `@supabase/ssr` bila tak dipakai (grep dulu).
**Bukti:** header `Set-Cookie` berflag HttpOnly (`curl.exe -i`); login salah 401; akun nonaktif 403; `/me` tanpa cookie 401; logout lalu `/me` 401; `/admin` tanpa sesi 307 ke `/login`; build lolos.

### Tahap 1C — Sambungkan frontend ke API
Tata letak, warna, CSS, dan komponen visual tidak diubah; signature state/props `ClinicContext` dipertahankan.
1. Hapus `src/utils/supabase/client.ts` dan semua importnya; tidak ada `supabase.from/rpc/Realtime/auth` di browser.
2. Klien API tunggal `src/utils/api.ts`: `fetch` same-origin, 401 → `/login`, peta `error.fields` ke form, adapter camelCase ke tipe UI.
3. `localStorage` hanya untuk preferensi tampilan; Realtime diganti polling 5 detik pada dasbor antrean (berhenti saat tab tersembunyi, backoff saat galat, bersihkan saat unmount).
4. State loading/kosong/berhasil/gagal, tombol nonaktif saat submit, pencarian/filter + pagination dari `meta`, validasi frontend (NIK 16 digit, telepon, tanggal lahir).
5. Urutan (satu commit per halaman): publik → login/daftar/logout → pasien (daftar kunjungan, kunjungan saya, detail, batal, riwayat, profil, notifikasi) → petugas → dokter → admin (pesan "belum tersedia" rapi sampai 1D). Ganti email "Akses Cepat" dengan akun uji; jangan tampilkan password di production.
**Bukti:** alur 1–9 (§5, tanpa push) dari UI di localhost; tab Network tanpa panggilan `*.supabase.co` dari browser; ubah ID di `/kunjungan/[id]` ditolak; `npm run build` dan `npm run lint` lolos. **PR ke `main` setelah tahap ini lulus.**

### Tahap 2 — Skema Web Push (cabang `feat/web-push-skema`)
Migrasi SQL berikutnya (mis. `12_web_push.sql`): `push_subscriptions` + RLS, kolom push `notifikasi`, indeks, perbarui fungsi trigger agar mengisi `jenis_kejadian` dan `tautan` untuk empat kejadian wajib (isi hanya nomor antrean, dokter, tanggal), perbarui `schema.ts`.
**Bukti:** migrasi pada DB kosong; INSERT tidak valid ditolak CHECK/UNIQUE; baris notifikasi terbentuk setelah pendaftaran, panggil, batal; tidak ada data klinis di notifikasi.

### Tahap 3 — Browser dan endpoint push (cabang `feat/web-push-browser`)
`public/sw.js`; tombol Aktifkan Notifikasi (pasien dan petugas, izin hanya setelah klik; tangani ditolak/tidak didukung/tidak valid); `GET /api/push/kunci`, `POST/DELETE /api/push/langganan` (Zod, wajib login, upsert per endpoint, nonaktifkan saat logout); `GET /api/admin/pekerjaan-notifikasi` + halaman; env VAPID + `.env.example`; cara membuat kunci (`npx web-push generate-vapid-keys`) di README.
**Bukti:** subscription tersimpan; tanpa sesi 401; pengguna lain tidak bisa menghapus milikmu; UI benar pada izin diizinkan/ditolak/tidak didukung; `VAPID_PRIVATE_KEY` tidak ada di `.next/static`; build lolos.

### Tahap 4 — Worker (cabang `feat/web-push-worker`)
Pasang `bullmq`, `ioredis`, `web-push`, `pino`; `worker/index.js` + `npm run worker`; pemindai 30 detik; processor dan penanganan hasil sesuai §7.4; Pino; SIGTERM; web aman bila Redis mati; README cara menjalankan worker dan Redis (Docker, Memurai, atau Upstash).
**Bukti:** lima bukti §7.6 + log worker untuk job gagal.

### Tahap 1D — Admin, rekap, foto dokter (cabang `feat/admin-lengkap`)
CRUD `/api/admin/layanan` (dipakai jadwal → nonaktifkan, bukan hapus); `/api/admin/pengguna` (daftar, buat staf lewat Auth Admin dengan `app_metadata.role`, aktif/nonaktif, BR-11); `GET/PUT /api/admin/profil-klinik`; `GET /api/admin/rekap` (agregasi DB, filter, pagination; sambungkan `exportRekapExcel.ts`); `POST /api/admin/dokter/[id]/foto` (§9); hubungkan halaman admin.
**Bukti:** tiap endpoint 401 tanpa login dan 403 untuk non-admin; admin ubah perannya sendiri ditolak; `.exe`/PDF/>2 MB ditolak; jadwal bentrok ditolak constraint; rekap = `SELECT count`; build dan lint lolos.

### Tahap 1E — Hardening (cabang `feat/hardening`)
Rate limiting (§9); Pino dengan `requestId`, rute, status, durasi, redaksi; pembungkus rute tunggal untuk galat (Zod → 400/422 dengan `fields`, `HttpError`, tak terduga → 500 generik); ESLint berjalan non-interaktif, `tsc --noEmit`, hindari `any`; audit rahasia (`git grep service_role|VAPID_PRIVATE|DATABASE_URL` dan `.next/static`); opsional GitHub Actions (lint, tsc, build).
**Bukti:** 20 login salah → 429; log berisi durasi/status tanpa password/token; galat DB buatan → 500 generik; grep rahasia bersih.

### Tahap 5 — Seed, pengujian, dokumentasi (cabang `feat/dokumentasi-uji`)
`scripts/seed.mjs` (§6.3; akun lewat Auth Admin, tolak berjalan bila penanda produksi aktif); `scripts/uji-api.ps1` jadi suite LULUS/GAGAL untuk §5 (sisi API) dan pengujian tambahan; README (prasyarat, instalasi, env, migrasi + seed, web dan worker, VAPID, Redis, deployment); `docs/ARSITEKTUR.md` (lapisan, keputusan RLS dan role koneksi, alur push, keterbatasan); `docs/ERD.md` (Mermaid dari `schema.ts`); daftar fitur selesai dan keterbatasan; `docs/BUKTI_VERIFIKASI.md` untuk sembilan butir §11; uji lebar ponsel 375 px dan keyboard.
**Bukti:** DB baru → migrasi + seed → suite hijau; README diikuti dari `git clone` baru sampai web dan worker jalan.

### Tahap 6 — Deployment (cabang `feat/deployment`)
Tabel env per platform (Vercel, Railway/Render, Upstash `rediss://`, Supabase); `DATABASE_URL` pooler transaksi untuk Vercel (tanpa prepared statement bernama; `set_config`/`SET LOCAL ROLE` hanya di dalam transaksi), koneksi langsung untuk worker; langkah deploy; uji alur 10 langkah di URL Vercel (HTTPS) termasuk push nyata dan membuka ulang `/kunjungan/[id]`, `/riwayat/[id]`. Agen tidak punya akses dashboard: tulis langkah dan minta hasilnya.

### Tahap 7 (P1, opsional)
Giliran hampir tiba, log aktivitas, lampiran privat, ekspor lanjutan, CI. Hanya setelah semua P0 lulus.

## 11. Verifikasi akhir dan pertanyaan terbuka

**Sembilan butir bukti (`docs/BUKTI_VERIFIKASI.md`, perintah + hasil nyata; screenshot saja tidak cukup):** (1) validasi frontend; (2) validasi backend lewat request langsung; (3) constraint database; (4) autentikasi, otorisasi, kepemilikan; (5) CRUD persisten; (6) migrasi dan relasi; (7) Web Push lewat worker; (8) kegagalan job dan subscription tidak valid; (9) konsistensi data dan penanganan galat.
**Checklist serahan:** repo dengan riwayat Git wajar; README; `.env.example`; migrasi + seed; ERD; arsitektur; VAPID dan worker; fitur selesai dan keterbatasan; URL deployment HTTPS; akun uji tiap peran.

**Pertanyaan untuk dosen (kirim sekali):** (1) login dan pembuatan akun staf lewat Supabase Auth dari backend Next.js dan `service_role` hanya di server diterima, dengan seluruh data bisnis lewat Drizzle? (2) Supabase Storage diterima sebagai object storage foto dokter? (3) Technical Requirements menyebut JavaScript (§1) dan TypeScript (§8): Route Handlers boleh JavaScript dengan tipe pada skema Drizzle?
**Keputusan sementara sampai dijawab:** usulan K1, K3, K8 di atas berlaku.
