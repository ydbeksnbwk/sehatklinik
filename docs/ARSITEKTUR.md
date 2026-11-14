# Dokumen Arsitektur & Keputusan Desain Teknis
**Sistem Informasi Klinik Kesehatan (Klinik Tim 7)**  
*Acuan Teknis untuk Presentasi, Evaluasi Dosen, dan Pemeliharaan Sistem*

---

## 1. Lapisan Arsitektur Sistem (Three-Tier Architecture)

Arsitektur aplikasi dibangun dengan pemisahan tanggung jawab yang tegas antar-lapisan:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAPISAN PERAMBAN (CLIENT)                       │
│  - Next.js 15 App Router (React 19, TypeScript UI)                     │
│  - Polling Status Antrean 5 Detik (Visibility-Aware, Tanpa Realtime)   │
│  - Service Worker (sw.js) untuk Web Push Listener                      │
│  - Zero Direct Database Access (Tanpa SDK Supabase di Browser)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS + HttpOnly Cookies
┌───────────────────────────────────▼────────────────────────────────────┐
│                   LAPISAN BACKEND (NEXT.JS ROUTE HANDLERS)              │
│  - JavaScript Route Handlers (src/app/api/**/route.js)                 │
│  - Middleware Next.js (Guard Route & Proteksi Sesi 307 Redirect)       │
│  - Validasi Masukan Zod (Lapisan Kedua di Seluruh Endpoint)            │
│  - Otorisasi Server-Side (requireRole, dokterIdDari, Cek Kepemilikan)  │
│  - Atomic Multi-Step Transactions (Drizzle ORM + pg, FOR UPDATE)       │
│  - Global Error Handling & Pino Structured Logger (Sensitif Tersensor) │
│  - Sliding-Window Rate Limiting (Redis / In-Memory Fail-Open)          │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ Pooler SQL (TCP)               │ Enqueue Job (Redis)
┌───────────────────▼────────────────┐   ┌───────────▼───────────────────┐
│     LAPISAN DATABASE (POSTGRESQL)  │   │  BACKGROUND WORKER (BULLMQ)   │
│  - Schema & Constraints (Lapisan 3)│   │  - worker/index.js            │
│  - CHECK (NIK, Vital BR-18, Jam)   │   │  - Outbox Poller (30 detik)   │
│  - UNIQUE Partial Index            │   │  - web-push VAPID Dispatcher  │
│  - Exclusion Constraints           │   │  - Retry Backoff & 410 Cleanup│
│  - Outbox Table (notifikasi)       │   └───────────────────────────────┘
└────────────────────────────────────┘
```

---

## 2. Keputusan RLS dan Role Koneksi Database

### Penjelasan Jujur & Transparan
- **Role Koneksi Utama (`DATABASE_URL`)**: String koneksi backend menggunakan pengguna bawaan `postgres`. Dalam PostgreSQL, role `postgres` memiliki atribut `SUPERUSER` / `BYPASSRLS`, yang secara bawaan melewati evaluasi Row Level Security (RLS) PostgreSQL.
- **Mengapa Keputusan Ini Diambil?**:
  1. *Keandalan Transaksi Bisnis Multi-Langkah*: Pada alur pendaftaran kunjungan (BR-04), sistem wajib mengunci baris dokter (`FOR UPDATE`), membaca jadwal dokter, menghitung kuota, memeriksa duplikasi, dan meng-insert kunjungan serta antrean dalam satu transaksi atomik. Eksekusi transaksi multi-tabel ini memerlukan izin eksekusi terpadu di server.
  2. *Pencegahan Injeksi PostgREST*: Seluruh akses data browser diarahkan melalui Route Handler Next.js. Klien peramban sama sekali tidak memiliki akses langsung ke database (`supabase.from` dieliminasi total).
- **Penegakan Otorisasi di Server**:
  - Otorisasi ditegakkan secara absolut di lapisan server sebelum menyentuh database:
    - Fungsi `requireRole(request, ["dokter"])` memeriksa validitas sesi Supabase Auth dari cookie dan memverifikasi kolom `role` dari tabel `profiles` server.
    - Setiap akses data privat (profil pasien, kunjungan, riwayat rekam medis) diverifikasi terhadap kepemilikan sesi (`profile.id === targetProfileId` atau `kunjungan.dokterId === dokterIdDariSesi`).
- **Dukungan RLS Eksplisit (`src/lib/rls.js`)**:
  - Untuk rute baca data pribadi, disediakan modul `denganRls(profileId, callback)` yang mengeksekusi:
    ```sql
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', $1, true);
    ```
    di dalam blok transaksi, memastikan kompatibilitas penuh dengan kebijakan RLS Postgres yang telah didefinisikan pada migrasi `07_rls_grant_policy.sql`.

---

## 3. Alur Notifikasi Web Push & Background Worker

Arsitektur Web Push memisahkan proses transaksi bisnis klinik dari pengiriman notifikasi menggunakan **Pola Outbox**:

```
[Transaksi Bisnis] ──► (Commit DB) ──► INSERT notifikasi (push_status='menunggu')
                                                │
                                    ┌───────────┴───────────┐
                       (Redis Aktif)│                       │(Redis Down / Poller)
                                    ▼                       ▼
                            Enqueue BullMQ         Scanner Periodik (30s)
                                    │                       │
                                    └───────────┬───────────┘
                                                ▼
                                    Worker Consumer (BullMQ)
                                                │
                                      web-push (VAPID Signed)
                                                │
                            ┌───────────────────┴───────────────────┐
                    (HTTP 201)                              (HTTP 404 / 410)
                        ▼                                           ▼
             push_status = 'berhasil'                   Nonaktifkan Subscription
             push_diproses_at = now()                   push_status = 'gagal'
```

1. **Pemisahan Transaksi (Decoupled & Non-blocking)**:
   - Keberhasilan atau kegagalan pengiriman push notification tidak boleh membatalkan transaksi pendaftaran kunjungan (BR-04).
   - Pekerjaan enqueue BullMQ dieksekusi setelah transaksi database berhasil di-commit.
   - Bila Redis offline, web app tetap beroperasi normal (*fail-open*), dan poller background worker akan mengambil notifikasi berstatus `'menunggu'` dari database saat koneksi pulih.
2. **Kebijakan Percobaan Ulang (Retry Policy)**:
   - HTTP 201: Sukses terkirim, status diubah menjadi `'berhasil'`.
   - HTTP 404 / 410 (Endpoint Kadaluarsa): Subscription otomatis dinonaktifkan (`aktif = false`) pada tabel `push_subscriptions` tanpa percobaan ulang.
   - HTTP 429 / 5xx / Network Timeout: Percobaan ulang dengan *exponential backoff* hingga maksimal 5 kali. Jika kuota retry habis, status diubah menjadi `'gagal'` dengan rincian galat pada kolom `push_error`.
   - HTTP 400 / 401 / 403: Galat konfigurasi VAPID, dihentikan permanen tanpa retry dan dicatat pada log Pino.

---

## 4. Keamanan Sesi & Penanganan Autentikasi

1. **Penyimpanan Sesi Cookie HttpOnly**:
   - Autentikasi pengguna dikelola via Supabase Auth dari Route Handlers backend (`/api/auth/login`).
   - Token disimpan di dalam cookie `sb-access-token` dan `sb-refresh-token` dengan atribut keamanan:
     - `HttpOnly`: Mencegah pembacaan token melalui script JavaScript di browser (mitigasi XSS).
     - `SameSite=Lax`: Mencegah pengiriman cookie lintas situs pada permintaan lintas domain berbahaya (mitigasi CSRF).
     - `Secure`: Diharuskan di lingkungan produksi HTTPS.
     - `Path=/`: Tersedia di seluruh rute aplikasi.
2. **Pengecekan Header Origin**:
   - Seluruh endpoint mutasi state (POST, PUT, PATCH, DELETE) melakukan validasi header `Origin` atau `Referer` untuk memastikan permintaan berasal dari host aplikasi klinik yang sah.
3. **Middleware Guard (`src/middleware.ts`)**:
   - Permintaan ke halaman internal (`/dashboard`, `/pasien`, `/petugas`, `/dokter-dashboard`, `/admin`, `/profil`, `/kunjungan/[id]`, `/riwayat/[id]`) dicek sebelum halaman dirender. Bila tidak terdapat cookie sesi yang valid, middleware mengembalikan HTTP 307 Redirect ke halaman `/login`.

---

## 5. Rate Limiting Terdistribusi

- **Strategi**: *Sliding Window Counter* pada level IP klien untuk melindungi endpoint dari serangan *brute force* dan *denial of service*:
  - `POST /api/auth/login`: Maksimal 5 percobaan per 15 menit per IP.
  - `POST /api/auth/register`: Maksimal 3 pendaftaran per jam per IP.
  - `POST /api/kunjungan`: Maksimal 10 pendaftaran per menit per IP.
  - `POST /api/push/langganan`: Maksimal 15 pendaftaran langganan per menit per IP.
- **Fail-Open Mechanism**:
  - Bila Redis terkonfigurasi (`REDIS_URL`), rate limiting menggunakan perintah atomic sliding window Redis.
  - Bila Redis tidak tersedia, rate limiter otomatis beralih ke cache memori lokal dengan peringatan level `warn` pada Pino logger tanpa menggagalkan request bisnis pengguna.
- **Respons Standar**: Permintaan yang melebihi batas menerima HTTP 429 `{ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Terlalu banyak permintaan' } }` disertai header `Retry-After`.

---

## 6. Keterbatasan yang Diketahui (Known Technical Limitations)

Secara jujur dan transparan, berikut adalah batasan teknis yang ada pada implementasi saat ini:

1. **Penentuan Alamat IP Klien**:
   - Fungsi `ambilClientIp(request)` di `src/lib/rate-limit.js` membaca elemen pertama header `x-forwarded-for` (dengan fallback ke `x-real-ip` dan `cf-connecting-ip`).
   - Di lingkungan lokal tanpa reverse proxy terverifikasi, header ini dapat dimanipulasi oleh klien dengan menyuntikkan header buatan. Pada lingkungan produksi Vercel / Cloudflare, reverse proxy menimpa header tersebut dengan IP sah.
2. **Peringatan ESLint `react-hooks/exhaustive-deps` di Frontend**:
   - Terdapat 6 warning `react-hooks/exhaustive-deps` pada `ClinicContext.tsx` serta beberapa komponen visual antarmuka.
   - Dependensi tersebut sengaja tidak dimasukkan ke dalam array dependensi hook untuk menghindari siklus pemanggilan ulang (*infinite re-render loop*) dan menjaga sinkronisasi polling antrean tetap stabil.
3. **Pengujian Web Push Lintas Perangkat Fisik**:
   - Fitur Web Push VAPID dan Service Worker telah teruji secara deterministik pada browser berbasis Chromium (Google Chrome, Microsoft Edge) di desktop.
   - Pengujian belum mencakup variasi perangkat mobile iOS (Safari PWA iOS 16.4+) dan perangkat Android lawas yang menerapkan optimasi baterai agresif terhadap background worker.
4. **Penerapan Tipe Enum Transisi Operasional**:
   - Status antrean dan kunjungan didefinisikan melalui PostgreSQL custom type/CHECK constraint (`menunggu`, `dipanggil`, `diperiksa`, `selesai`, `dilewati`, `batal`).
   - Aturan alur transisi status dikendalikan oleh modul state machine backend (`src/lib/domain/transisi.js`) dan divalidasi oleh constraint integritas database pada lapisan ketiga.
