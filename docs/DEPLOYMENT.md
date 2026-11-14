# Panduan Deployment Produksi & Konfigurasi Multi-Platform
**Sistem Informasi Klinik Kesehatan (Klinik Tim 7)**  
*Acuan Panduan Bagi Pengembang & Administrator Sistem*

---

## 1. Ikhtisar Arsitektur Deployment Multi-Platform

Sistem dirancang untuk beroperasi secara terdistribusi pada platform cloud modern:

```
┌────────────────────────────────────────────────────────┐
│                   VERCEL (SERVERLESS)                  │
│  - Next.js 15 App Router Frontend & Route Handlers     │
│  - Region: Singapore (sin1)                            │
│  - DATABASE_URL: Transaction Pooler Supabase (Port 6543)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│              SUPABASE (DATABASE & STORAGE)             │
│  - PostgreSQL 15 Database (Region: Singapore)          │
│  - Storage Bucket Publik: 'foto-dokter'                │
│  - Supabase Auth Service (Manajemen Pengguna)          │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│             RAILWAY / RENDER (LONG-RUNNING WORKER)     │
│  - Process: npm run worker:prod                        │
│  - Consumer BullMQ & Outbox Poller                     │
│  - DATABASE_URL: Session Pooler Supabase (Port 5432)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│                  UPSTASH (SERVERLESS REDIS)            │
│  - URL: rediss://default:token@host.upstash.io:6379    │
│  - Antrean BullMQ ('notifikasi-push') & Rate Limiter   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Tabel Environment Variables per Platform

> [!IMPORTANT]
> Kolom **Sifat** menandai apakah variabel merupakan data sensitif (*Secret*) yang tidak boleh bocor ke publik atau repositori Git.

### A. Lingkungan Vercel (Web Application & Route Handlers)

| Nama Variabel | Sifat | Deskripsi |
|---|---|---|
| `DATABASE_URL` | **SENSITIVE** | URL PostgreSQL Transaction Pooler Supabase (Port **6543** dengan `?pgbouncer=true`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Publik | URL API instance Supabase (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik | Kunci publik/anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **SENSITIVE** | Kunci Service Role Supabase (Auth Admin & unggah foto dokter) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Publik | Kunci publik VAPID Web Push (di-inlining saat build) |
| `VAPID_PRIVATE_KEY` | **SENSITIVE** | Kunci privat VAPID Web Push |
| `VAPID_SUBJECT` | **SENSITIVE** | Kontak pengirim Web Push (`mailto:admin@domain.com`) |
| `REDIS_URL` | **SENSITIVE** | URL Upstash Redis dengan protokol `rediss://` |
| `NODE_ENV` | Sistem | Disetel otomatis ke `production` oleh Vercel |

### B. Lingkungan Railway / Render (Background Worker)

| Nama Variabel | Sifat | Deskripsi |
|---|---|---|
| `DATABASE_URL` | **SENSITIVE** | URL PostgreSQL Session Pooler Supabase (Port **5432** / host `pooler.supabase.com`) |
| `REDIS_URL` | **SENSITIVE** | URL Upstash Redis dengan protokol `rediss://` |
| `VAPID_PUBLIC_KEY` | Publik | Kunci publik VAPID Web Push |
| `VAPID_PRIVATE_KEY` | **SENSITIVE** | Kunci privat VAPID Web Push |
| `VAPID_SUBJECT` | **SENSITIVE** | Kontak pengirim Web Push (`mailto:admin@domain.com`) |
| `LOG_LEVEL` | Konfigurasi | Level log Pino (`info`, `warn`, `error`) |

---

## 3. Langkah-Langkah Deployment Bertahap

### Langkah 1: Persiapan Database & Storage di Supabase
1. Buat project baru di [Supabase](https://supabase.com) dengan region **Southeast Asia (Singapore)** agar memiliki latensi rendah ke Indonesia.
2. Buat bucket penyimpanan publik di menu **Storage**:
   - Nama bucket: `foto-dokter`.
   - Akses: **Public Bucket** (dapat dibaca publik).
3. Jalankan migrasi dan inisialisasi data seed dari terminal lokal:
   ```powershell
   # 1. Jalankan 12 file migrasi database
   npm run db:migrate

   # 2. Jalankan seed data terstandar
   $env:SEED_ALLOW="1"; npm run db:seed

   # (Catatan: Pembersihan outbox data uji pra-deploy telah diselesaikan pada inisialisasi awal)
   ```

### Langkah 2: Pembuatan Kunci VAPID & Konfigurasi Upstash Redis
1. Buat pasangan kunci Web Push VAPID di terminal:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Buat instance database Redis baru di [Upstash](https://upstash.com) (Region Singapore).
3. Salin connection string `rediss://...` (pastikan menggunakan protokol TLS `rediss`).

### Langkah 3: Deployment Aplikasi Web ke Vercel
1. Masuk ke [Vercel Dashboard](https://vercel.com) dan impor repositori GitHub `sehatklinik`.
2. Pada bagian **Settings > Functions**, pilih region **Singapore (sin1)**.
3. Pada bagian **Environment Variables**, masukkan seluruh variabel sesuai Tabel 2.A:
   > [!WARNING]
   > `NEXT_PUBLIC_VAPID_PUBLIC_KEY` wajib diisi **sebelum** build dijalankan karena Next.js melakukan inlining variabel publik saat kompilasi.
4. Pastikan `DATABASE_URL` menggunakan port **6543** (Transaction Pooler).
5. Klik **Deploy** dan catat URL produksi yang dihasilkan (misal: `https://sehatklinik-tim7.vercel.app`).

### Langkah 4: Deployment Background Worker ke Railway / Render
1. Buat service baru di [Railway](https://railway.app) atau [Render](https://render.com) dari repositori yang sama.
2. Konfigurasikan perintah eksekusi:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run worker:prod`
3. Masukkan environment variables sesuai Tabel 2.B:
   > [!IMPORTANT]
   > Gunakan string koneksi Supabase Session Pooler (port **5432**) pada `DATABASE_URL` untuk worker agar terhindar dari kendala jaringan IPv6.
4. Periksa log keluaran worker. Worker yang aktif akan mencetak:
   `[BullMQ] Worker aktif dan mendengarkan antrean 'notifikasi-push'...`

---

## 4. Urutan Verifikasi Pasca-Deployment

Setelah kedua platform (Vercel dan Worker) berstatus aktif:

1. **Pemeriksaan Health Endpoint**:
   Buka `https://<domain-vercel>/api/health`. Pastikan merespons:
   ```json
   { "status": "ok", "db": "connected" }
   ```
2. **Pemeriksaan Autentikasi & Cookie**:
   Buka halaman `/login` dan login menggunakan masing-masing dari 6 akun demo (Admin, Petugas, Dokter 1, Dokter 2, Pasien 1, Pasien 2). Pastikan cookie `sb-access-token` terpasang dengan flag `HttpOnly` dan `Secure`.
3. **Aktivasi Notifikasi Web Push**:
   Login sebagai Pasien di satu browser (misal Chrome), klik tombol **Aktifkan Notifikasi**, dan izinkan dialog notifikasi peramban. Lakukan hal yang sama sebagai Petugas di browser kedua (misal Edge).
4. **Eksekusi Pengujian Otomatis Produksi**:
   Jalankan skrip uji otomatis terhadap URL Vercel dari terminal pengembang:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/uji-deploy.ps1 -BaseUrl "https://sehatklinik-tim7.vercel.app"
   ```
5. **Verifikasi Alur End-to-End Manual**:
   Lakukan pengujian fungsional interaktif menggunakan tabel "Uji Alur di URL Deploy" pada Bagian 5 di bawah.

---

## 5. Uji Alur di URL Deploy (Checklist Manual 10 Langkah)

Berikut adalah panduan pengujian alur fungsional end-to-end pada URL deployment produksi dengan dua peramban berbeda (Peramban A untuk Pasien, Peramban B untuk Petugas/Dokter):

| No | Langkah | Aktor & Akun | Tindakan yang Dilakukan | Hasil yang Diharapkan | Status | Catatan Penguji |
|:---:|---|---|---|---|:---:|---|
| **1** | **Aktivasi Notifikasi** | Pasien (`ani.wulandari@gmail.com`) di Peramban A | Klik tombol **"Aktifkan Notifikasi"**, lalu pilih **Allow/Izinkan** pada dialog izin browser | Dialog sukses muncul; tombol berubah status menjadi "Notifikasi Aktif"; langganan tersimpan di database | | |
| **2** | **Pendaftaran Kunjungan** | Pasien di Peramban A | Masuk menu Pendaftaran Kunjungan: pilih Layanan (Poli Umum), Dokter (dr. Reyhan), Tanggal, Sesi Jadwal, masukkan keluhan, klik **Kirim** | Kunjungan berhasil terdaftar dengan nomor referensi unik dan nomor antrean; notifikasi push pendaftaran muncul di layar | | |
| **3** | **Pemantauan Dasbor Pasien** | Pasien di Peramban A | Buka halaman Dasbor Pasien (`/dashboard` atau `/pasien`) | Kartu antrean aktif menampilkan nomor antrean (#1) dengan status **Menunggu** | | |
| **4** | **Check-in Kedatangan** | Petugas (`rina.petugas@gmail.com`) di Peramban B | Login sebagai Petugas, buka Dasbor Antrean (`/petugas`), cari antrean pasien tadi, klik tombol **Check-in** | Status kunjungan berubah menjadi **Hadir**; tombol "Panggil" menjadi aktif | | |
| **5** | **Pemanggilan Antrean** | Petugas di Peramban B | Klik tombol **Panggil** pada antrean pasien yang telah Hadir | Status berubah menjadi **Dipanggil**; notifikasi Web Push berbunyi/muncul di Peramban A; klik notifikasi membuka tab dasbor pasien | | |
| **6** | **Mulai Pemeriksaan Dokter** | Dokter (`dokter.reyhan@gmail.com`) di Peramban B | Login sebagai Dokter, buka antrean pribadi (`/dokter-dashboard`), temukan pasien, klik **Mulai Periksa** | Status antrean berubah menjadi **Sedang Diperiksa**; hanya pasien dr. Reyhan yang terlihat di daftar | | |
| **7** | **Pencatatan Rekam Medis & Selesai** | Dokter di Peramban B | Masukkan Anamnesis, Tanda Vital valid (TD: 120/80, Suhu: 36.5, BB: 65, TB: 170), Diagnosis, Tindakan medis, klik **Simpan & Selesaikan Kunjungan** | Kunjungan dan nomor antrean berubah status menjadi **Selesai**; data rekam medis tersimpan persisten | | |
| **8** | **Isolasi Riwayat Medis** | Pasien di Peramban A | Buka halaman Riwayat (`/riwayat` atau `/dashboard`) | Kunjungan yang baru saja selesai muncul lengkap dengan ringkasan medis; login akun Pasien 2 membuktikan kunjungan ini terisolasi total | | |
| **9** | **Rekapitulasi Konsisten** | Admin (`admin.klinik@gmail.com`) | Login sebagai Admin, buka menu Rekapitulasi Kunjungan (`/admin`) | Angka ringkasan total kunjungan sama persis dengan penjumlahan status (Terdaftar + Hadir + Selesai + Batal) | | |
| **10** | **Audit Outbox & Worker** | Admin / Petugas | Buka menu Pekerjaan Notifikasi (`/admin` atau `/api/admin/pekerjaan-notifikasi`) | Daftar pekerjaan outbox push notification menampilkan status riwayat pengiriman (`berhasil`, `gagal`) dengan jumlah percobaan | | |

---

## 6. Pemecahan Masalah (Troubleshooting Guide)

### 1. Perbedaan Pooler Supabase: Port 6543 vs Port 5432
- **Port 6543 (Transaction Mode)**:
  - Digunakan khusus untuk aplikasi web serverless di Vercel.
  - Membuka dan menutup koneksi secepat mungkin per transaksi HTTP handler.
  - *Catatan*: Dilarang menggunakan prepared statements bernama atau perintah session-level tanpa transaksi.
- **Port 5432 (Session Mode)**:
  - Digunakan untuk proses persisten seperti background worker di Railway/Render.
  - Mendukung koneksi jangka panjang dan event listener database.

### 2. Kendala Jaringan Direct IPv6 pada Platform Worker
- **Gejala**: Worker gagal terhubung ke database dengan pesan error `getaddrinfo ENOTFOUND db.xxxx.supabase.co` atau `ETIMEDOUT`.
- **Akar Masalah**: Host direct connection Supabase (`db.xxxx.supabase.co`) hanya memiliki AAAA record (IPv6). Sebagian provider container (seperti Render Free atau Railway default) tidak menyediakan rute keluar IPv6 publik.
- **Solusi**: Jangan gunakan host `db.xxxx.supabase.co`. Gunakan host Supabase Pooler (`aws-0-ap-northeast-1.pooler.supabase.com`) pada port **5432** yang memiliki alamat IPv4 publik.

### 3. Galat HTTP 403 Forbidden pada Request Mutasi (CSRF Origin Check)
- **Gejala**: Pendaftaran kunjungan, login, atau perubahan data gagal dengan status 403 `Akses CSRF ditolak: Origin tidak cocok`.
- **Akar Masalah**: Di balik reverse proxy atau custom domain, header `host` internal berbeda dari `origin` peramban.
- **Solusi**: Middleware `src/middleware.ts` telah dilengkapi fallback otomatis membaca `x-forwarded-host || host`. Pastikan proxy meneruskan header `x-forwarded-host` dengan benar.

### 4. Notifikasi Web Push Tidak Muncul di Peramban
- **Gejala**: Tombol "Aktifkan Notifikasi" gagal mendaftarkan Service Worker atau pesan push tidak tampil.
- **Akar Masalah**: Spesifikasi W3C Web Push mewajibkan protokol aman **HTTPS**. Service Worker diblokir secara otomatis oleh browser bila diakses melalui protokol HTTP biasa (kecuali `http://localhost`).
- **Solusi**: Pastikan URL aplikasi diakses melalui HTTPS Vercel.

### 5. Kunci VAPID Tidak Cocok Setelah Penggantian Kunci
- **Gejala**: Pengiriman push gagal dengan error `401 Unauthorized` atau `400 Bad Request` dari push gateway FCM/Mozilla.
- **Akar Masalah**: Browser menyimpan subscription yang ditandatangani oleh VAPID Public Key lama. Jika developer meng-generate VAPID key baru tanpa me-reset langganan browser, gateway menolak payload.
- **Solusi**: Pada menu peramban, buka `Site Settings > Clear data` atau klik tombol opt-out lalu aktifkan kembali notifikasi pada browser pengguna.
