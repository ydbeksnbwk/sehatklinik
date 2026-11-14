# Sistem Informasi Klinik Kesehatan (Klinik Tim 7)

Aplikasi web Sistem Informasi Manajemen Klinik Kesehatan berbasis **Next.js 15 (App Router, React 19, TypeScript & JavaScript Route Handlers)** dengan arsitektur validasi tiga lapis, otorisasi ketat berbasis sesi cookie HttpOnly, transaksi database Drizzle ORM + PostgreSQL (Supabase), serta notifikasi nyata Web Push VAPID dengan background worker BullMQ + Redis.

---

## 📋 Prasyarat Sistem

Sebelum memulai instalasi, pastikan lingkungan pengembangan telah memenuhi prasyarat berikut:
- **Node.js**: Versi `20.x` atau lebih baru (`node -v`).
- **NPM**: Versi `10.x` atau lebih baru (`npm -v`).
- **PostgreSQL**: Instance PostgreSQL 15+ (disarankan menggunakan [Supabase](https://supabase.com/)).
- **Redis** (Opsional untuk development, wajib untuk Web Push Worker): Instance Redis 6+ lokal (Docker / Memurai) atau cloud ([Upstash Redis](https://upstash.com/)).

---

## 🚀 Panduan Instalasi dari Git Clone

### 1. Klon Repositori
```bash
git clone https://github.com/username/sehatklinik.git
cd sehatklinik
```

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Salin berkas template environment:
```bash
cp .env.example .env.local
```
Lengkapi nilai-nilai variabel di dalam `.env.local` sesuai panduan tabel di bawah.

---

## 🔐 Tabel Environment Variables

| Nama Variabel | Lingkungan | Deskripsi |
|---|---|---|
| `DATABASE_URL` | Server | String koneksi PostgreSQL pooler / direct (`postgresql://...`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser & Server | URL instance Supabase project (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser & Server | Kunci anon/publik Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Khusus | Kunci service role Supabase (Auth Admin & Storage internal) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser & Server | Kunci publik VAPID Web Push untuk registrasi Service Worker |
| `VAPID_PRIVATE_KEY` | Server Khusus | Kunci privat VAPID untuk penandatanganan payload Web Push |
| `VAPID_SUBJECT` | Server Khusus | Kontak pengirim VAPID (`mailto:admin@kliniktujuh.com` atau URL) |
| `REDIS_URL` | Server & Worker | URL koneksi Redis (`redis://...` atau `rediss://...` untuk SSL) |
| `SEED_ALLOW` | Tooling / Script | Penanda izin eksekusi seed database (`1` untuk mengizinkan) |

> [!CAUTION]
> Jangan pernah mengekspos `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `DATABASE_URL`, atau `REDIS_URL` ke sisi peramban atau berkas frontend. Variabel-variabel tersebut hanya boleh diakses di lingkungan server.

---

## 🔑 Pembuatan Kunci VAPID (Web Push)

Untuk mengaktifkan fitur notifikasi browser berbasis standar Web Push VAPID, buat pasangan kunci menggunakan perintah:
```bash
npx web-push generate-vapid-keys
```
Keluaran perintah akan menghasilkan **Public Key** dan **Private Key**:
1. Masukkan nilai Public Key ke variabel `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
2. Masukkan nilai Private Key ke variabel `VAPID_PRIVATE_KEY`.
3. Tentukan subjek kontak pada `VAPID_SUBJECT` (contoh: `mailto:admin@klinik.local`).

---

## 🗄️ Konfigurasi Redis

Redis digunakan untuk penyimpanan antrean tugas background worker (`BullMQ`) dan *sliding-window rate limiter*. Pilih salah satu opsi:

### Opsi A: Docker Container (Lokal)
```bash
docker run -d --name redis-klinik -p 6379:6379 redis:alpine
```
Setel di `.env.local`:
```env
REDIS_URL=redis://127.0.0.1:6379
```

### Opsi B: Memurai / Windows Native
Jalankan layanan Memurai pada port default 6379.

### Opsi C: Upstash Serverless Redis (Cloud)
Gunakan koneksi TLS dari dashboard Upstash:
```env
REDIS_URL=rediss://default:token@host.upstash.io:6379
```

> [!NOTE]
> Aplikasi web dirancang dengan arsitektur **fail-open** ber-log: bila koneksi Redis belum tersedia atau terputus, endpoint web tetap melayani transaksi bisnis secara normal (rate limit beralih ke cache memori lokal, dan notifikasi aman tersimpan pada tabel outbox database).

---

## 🛠️ Migrasi Database & Seed Data

### 1. Eksekusi Migrasi Skema
Menjalankan berkas migrasi SQL berurutan (`01` sampai `12`) pada database:
```bash
npm run db:migrate
```

### 2. Eksekusi Seed Data Idempoten
Mengisi master data klinik, katalog layanan, jadwal praktik terstandar, 6 akun peran uji, dan 12 kunjungan/antrean demo sesuai spesifikasi PRD §6.3:

**PowerShell (Windows):**
```powershell
$env:SEED_ALLOW="1"; npm run db:seed
```

**Bash / Linux / macOS:**
```bash
SEED_ALLOW=1 npm run db:seed
```

> [!TIP]
> Skrip seed bersifat **idempoten sejati**: aman dijalankan berulang kali tanpa memicu duplikasi data kunjungan, jadwal, maupun lonjakan baris notifikasi.

---

## 👥 Akun Uji Coba Multi-Peran (Demo)

Seluruh akun uji telah didaftarkan pada Supabase Auth dan disinkronkan ke tabel `profiles`:

| Peran | Alamat Email | Kata Sandi | No. Rekam Medis / Identitas |
|---|---|---|---|
| **Admin** | `admin.klinik@gmail.com` | `Password123!` | Manajemen staf, master data, dan rekap |
| **Petugas** | `rina.petugas@gmail.com` | `Password123!` | Loket pendaftaran, check-in, dan antrean |
| **Dokter 1** | `dokter.reyhan@gmail.com` | `Password123!` | dr. Reyhan Adhitama (Poli Umum) |
| **Dokter 2** | `nadira.kirana@gmail.com` | `Password123!` | drg. Nadira Kirana (Poli Gigi) |
| **Pasien 1** | `ani.wulandari@gmail.com` | `Password123!` | Ani Wulandari (`RM-000001`) |
| **Pasien 2** | `bagas.saputra@gmail.com` | `Password123!` | Bagas Saputra (`RM-000002`) |

---

## 🖥️ Menjalankan Aplikasi

### 1. Menjalankan Server Web (Next.js)

**Mode Pengembangan:**
```bash
npm run dev
```
Akses aplikasi melalui browser di `http://localhost:3000`.

**Mode Produksi:**
```bash
npm run build
npm run start
```

### 2. Menjalankan Background Worker (Web Push)
Buka terminal terpisah untuk menjalankan consumer worker BullMQ yang memproses antrean notifikasi:
```bash
npm run worker
```

---

## 🧪 Eksekusi Pengujian Otomatis

Repositori dilengkapi dengan suite pengujian otomatis untuk memverifikasi integritas backend:
```powershell
# 1. Master Suite Pengujian Alur PRD §5 & Keamanan API
powershell -ExecutionPolicy Bypass -File scripts/uji-suite.ps1

# 2. Pembuktian Integritas Constraint Database (SQL ROLLBACK)
node --env-file=.env.local scripts/run-verifikasi-db.mjs # atau eksekusi scripts/verifikasi-db.sql di PostgreSQL client

# 3. Pengecekan Type Safety & Linting
npx tsc --noEmit
npm run lint
```

---

## 🌐 Panduan Deployment Ringkas

1. **Aplikasi Web (Next.js Frontend & API)**:
   - Hubungkan repositori Git ke [Vercel](https://vercel.com).
   - Masukkan environment variables: `DATABASE_URL` (gunakan transaction pooler Supabase port 6543 / 5432), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, dan `REDIS_URL`.
   - Vercel akan mengompilasi dan menyediakan URL HTTPS publik.
2. **Background Worker & Redis**:
   - Deploy direktori worker ke platform proses persisten seperti [Railway](https://railway.app) atau [Render](https://render.com) dengan perintah start `npm run worker`.
   - Gunakan [Upstash Redis](https://upstash.com) dengan protokol `rediss://` untuk antrean tugas.
3. **Database & Storage**:
   - Instance PostgreSQL dan bucket penyimpanan publik `foto-dokter` terkelola pada [Supabase](https://supabase.com).

---

## 📚 Tautan Dokumentasi Terkait

- [Arsitektur & Keputusan Desain](file:///D:/Materi%20Kuliah%20S.5/Pemrograman%20Web/sehatklinik/docs/ARSITEKTUR.md)
- [Diagram Hubungan Entitas (ERD)](file:///D:/Materi%20Kuliah%20S.5/Pemrograman%20Web/sehatklinik/docs/ERD.md)
- [Daftar Fitur & Panduan Uji Manual](file:///D:/Materi%20Kuliah%20S.5/Pemrograman%20Web/sehatklinik/docs/FITUR.md)
- [Bukti Verifikasi Sembilan Butir Evaluasi](file:///D:/Materi%20Kuliah%20S.5/Pemrograman%20Web/sehatklinik/docs/BUKTI_VERIFIKASI.md)
- [Panduan Deployment & Konfigurasi Cloud](file:///D:/Materi%20Kuliah%20S.5/Pemrograman%20Web/sehatklinik/docs/DEPLOYMENT.md)
