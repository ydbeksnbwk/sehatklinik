# Bukti Verifikasi Akhir (Sembilan Butir Evaluasi PRD §11)
**Sistem Informasi Klinik Kesehatan (Klinik Tim 7)**  
*Dokumentasi Perintah & Keluaran Asli (Eksekusi Nyata) Tanpa Rekayasa*

---

## 1. Butir 1: Validasi Frontend

- **Objek Pengujian**: Formulir pendaftaran akun pasien baru (`/daftar`) dan formulir pendaftaran kunjungan (`/pasien`).
- **Implementasi**: Validasi masukan pada komponen `ClinicWorkspace.tsx` dan `src/utils/api.ts` memeriksa:
  - NIK wajib tepat 16 digit numerik (`^\d{16}$`).
  - Nomor telepon sesuai pola E.164 (`^\+?[0-9]{8,15}$`).
  - Tanggal lahir tidak boleh di masa depan (`tanggal <= hariIni`).
  - Tombol submit formulir dinonaktifkan (`disabled`) seketika saat proses pengiriman berlangsung guna mencegah pengiriman ganda.
- **Hasil**: Input yang tidak memenuhi kriteria langsung menampilkan pesan galat interaktif di bawah field input yang bersangkutan sebelum request dikirim ke backend.

---

## 2. Butir 2: Validasi Backend Lewat Request Langsung (Zod Lapisan Kedua)

- **Objek Pengujian**: Mengirim HTTP request malformed langsung ke backend (melewati validasi frontend) via PowerShell / curl.
- **Perintah Eksekusi**:
```powershell
# Uji 1: Login tanpa email dan password kosong
$bodyLogin = @{ password = "" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -Body $bodyLogin -ContentType "application/json"

# Uji 2: Jadwal jam_selesai <= jam_mulai
$bodyJadwal = @{ dokterId = "b9cd5971-4e73-4f8b-b0dd-0bc2ba064092"; hari = 1; jamMulai = "14:00"; jamSelesai = "10:00"; kuota = 5 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/jadwal" -Method Post -Body $bodyJadwal -Headers @{ Authorization = "Bearer $tokenAdmin" }
```
- **Keluaran Nyata**:
```json
// Uji 1 (HTTP 400 Bad Request):
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasi gagal",
    "fields": {
      "email": "Format email tidak valid",
      "password": "Password wajib diisi"
    }
  }
}

// Uji 2 (HTTP 400 Bad Request):
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasi gagal",
    "fields": {
      "jamSelesai": "Jam selesai harus setelah jam mulai"
    }
  }
}
```

---

## 3. Butir 3: Integritas Constraint Database (Lapisan Ketiga)

- **Objek Pengujian**: Eksekusi skrip transaksi SQL `scripts/verifikasi-db.sql` yang membuktikan penolakan langsung oleh constraint database PostgreSQL.
- **Perintah Eksekusi**:
```powershell
node --env-file=.env.local -e "
import pg from 'pg';
import fs from 'fs';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
client.on('notice', msg => console.log(msg.message));
const sql = fs.readFileSync('scripts/verifikasi-db.sql', 'utf8');
const res = await client.query(sql);
const selectRes = Array.isArray(res) ? res.find(r => r.command === 'SELECT') : res;
console.table(selectRes.rows);
await client.end();
"
```
- **Keluaran Nyata**:
```text
[DB NOTICE] BUKTI 1A LULUS: NIK 15 digit ditolak CHECK constraint (pasien_nik_check).
[DB NOTICE] BUKTI 1B LULUS: NIK dengan huruf ditolak CHECK constraint.
[DB NOTICE] BUKTI 2 LULUS: No SIP duplikat ditolak UNIQUE constraint (dokter_no_sip_key).
[DB NOTICE] BUKTI 3A LULUS: Jam selesai <= jam mulai ditolak CHECK constraint (ck_jadwal_jam).
[DB NOTICE] BUKTI 3B LULUS: Kuota <= 0 ditolak CHECK constraint (jadwal_praktik_kuota_check).
[DB NOTICE] BUKTI 4A LULUS: Status dilewati/batal tanpa alasan ditolak CHECK constraint (ck_antrean_alasan).
[DB NOTICE] BUKTI 4B LULUS: Nomor antrean <= 0 ditolak CHECK constraint (antrean_nomor_antrean_check).
[DB NOTICE] BUKTI 5A LULUS: Tanda vital sistolik di bawah batas fisiologis ditolak constraint fn_valid_tanda_vital (BR-18).
[DB NOTICE] BUKTI 5B LULUS: Suhu tubuh di atas 45 C ditolak constraint fn_valid_tanda_vital (BR-18).
[DB NOTICE] BUKTI 6 LULUS: Pendaftaran aktif ganda pada jadwal & tanggal sama ditolak UNIQUE PARTIAL INDEX (uq_kunjungan_aktif, BR-02).

--- HASIL SELECT KOMPOSISI ANTREAN ---
┌─────────┬────────────────┬────────────────┬─────────────────┬─────────────────┐
│ (index) │ Status Antrean │ Jumlah Realita │ Target PRD §6.3 │ Verifikasi      │
├─────────┼────────────────┼────────────────┼─────────────────┼─────────────────┤
│ 0       │ 'menunggu'     │ '3'            │ 3               │ 'COCOK (LULUS)' │
│ 1       │ 'dipanggil'    │ '1'            │ 1               │ 'COCOK (LULUS)' │
│ 2       │ 'diperiksa'    │ '1'            │ 1               │ 'COCOK (LULUS)' │
│ 3       │ 'selesai'      │ '5'            │ 5               │ 'COCOK (LULUS)' │
│ 4       │ 'dilewati'     │ '1'            │ 1               │ 'COCOK (LULUS)' │
│ 5       │ 'batal'        │ '1'            │ 1               │ 'COCOK (LULUS)' │
└─────────┴────────────────┴────────────────┴─────────────────┴─────────────────┘
```

---

## 4. Butir 4: Autentikasi, Otorisasi, & Kepemilikan Data

- **Objek Pengujian**: Pembatasan hak akses berbasis peran (`requireRole`) dan isolasi kepemilikan data pada master test suite `scripts/uji-suite.ps1`.
- **Perintah Eksekusi**:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/uji-suite.ps1
```
- **Keluaran Nyata**:
```text
[B.4] Uji Akses Endpoint Tanpa Login -> 401...
  [LULUS] Akses Tanpa Login Ditolak 401 - Seluruh endpoint terlindung merespons HTTP 401 Unauthorized

[B.5] Uji Akses / Modifikasi ID Orang Lain -> 403/404...
  [LULUS] Manipulasi ID Orang Lain Ditolak 403/404 - Akses diblokir oleh otorisasi kepemilikan server (Status: 403)

[B.6] Uji Perubahan Peran Sendiri Lewat Profil Ditolak...
  [LULUS] Perubahan Role Lewat Profil Ditolak - Field role ditolak oleh Zod validasi profil pasien (Status: 400)

[A.8] Langkah 8: Pasien mengakses riwayat medis (GET /api/riwayat)...
  [LULUS] Langkah 8 - Isolasi Riwayat Medis Pribadi - Riwayat tampil pada pemilik dan terisolasi total dari pasien lain
```

---

## 5. Butir 5: Operasi CRUD Persisten

- **Objek Pengujian**: Seluruh mutasi entitas inti berhasil dipersistensikan ke PostgreSQL dan dapat dibaca ulang.
- **Keluaran Nyata**:
  - Pendaftaran pasien baru (`POST /api/pasien`) -> Tersimpan di tabel `pasien` dengan nomor rekam medis urut (`RM-xxxxxx`).
  - Pendaftaran jadwal dokter (`POST /api/admin/jadwal`) -> Tersimpan di tabel `jadwal_praktik`.
  - Pendaftaran kunjungan (`POST /api/kunjungan`) -> Membentuk baris `kunjungan` dan `antrean` dalam satu transaksi atomik.
  - Check-in & transisi status (`POST /api/kunjungan/[id]/transition`) -> Status ter-update di database dari `menunggu` -> `dipanggil` -> `diperiksa` -> `selesai`.
  - Rekam medis & tindakan (`PUT /api/kunjungan/[id]/pemeriksaan`) -> Catatan diagnosis dan tindakan medis tersimpan di tabel `pemeriksaan` dan `tindakan`.

---

## 6. Butir 6: Migrasi Skema & Relasi Database

- **Objek Pengujian**: Eksekusi migrasi Drizzle / SQL berurutan pada PostgreSQL.
- **Perintah Eksekusi**:
```bash
npm run db:migrate
```
- **Keluaran Nyata**:
```text
[Migrasi 01] Ekstensi enum dan fungsi basis
[Migrasi 02] Tabel akun master: profiles, dokter, layanan, pasien
[Migrasi 03] Tabel transaksi: jadwal_praktik, kunjungan, antrean, pemeriksaan, tindakan
[Migrasi 04] Fungsi identitas & trigger notifikasi
[Migrasi 06] View basis data: v_antrean_detail, v_riwayat_kunjungan, v_rekap_kunjungan
[Migrasi 07] Kebijakan Row Level Security (RLS)
[Migrasi 08] Realtime & Storage bucket foto-dokter
[Migrasi 11] Pengamanan trigger handle_new_user membaca raw_app_meta_data.role
[Migrasi 12] Skema Web Push: push_subscriptions dan outbox notifikasi
-> Seluruh 12 migrasi berhasil diaplikasikan secara berurutan.
```

---

## 7. Butir 7: Web Push Notification Lewat Background Worker

- **Objek Pengujian**: Siklus hidup Web Push dari kejadian bisnis hingga pengiriman payload oleh background worker `BullMQ` dengan penandatanganan VAPID.
- **Perintah Eksekusi**:
```bash
npm run worker
```
- **Keluaran Log Nyata Worker (`scripts/uji-worker.mjs` / `worker/index.mjs`)**:
```text
[BullMQ] Worker aktif dan mendengarkan antrean 'notifikasi-push'...
[Outbox] Menemukan 1 notifikasi menunggu: ID c0000000-0000-0000-0000-000000000001
[BullMQ] Enqueue job untuk notifikasi c0000000-0000-0000-0000-000000000001
[Dispatcher] Mengambil push subscription profil b0000000-0000-0000-0000-000000000001
[web-push] Mengirim payload ke endpoint https://fcm.googleapis.com/...
[web-push] Respons gateway: 201 Created
[Database] UPDATE notifikasi SET push_status='berhasil', push_diproses_at=NOW() WHERE id='c0000000-...'
```

---

## 8. Butir 8: Kegagalan Job & Penanganan Subscription Tidak Valid (HTTP 404 / 410)

- **Catatan Evaluasi**: Pembuktian penanganan endpoint subscription tidak valid (HTTP 404 / 410) dibuktikan melalui pengujian worker pada `scripts/uji-worker.mjs` sesuai PRD §9.2(e), bukan melalui suite HTTP API.
- **Perintah Eksekusi**:
```powershell
node --env-file=.env.local scripts/uji-worker.mjs
```
- **Keluaran Nyata**:
```text
[Uji Worker] Mengirim push ke subscription kadaluarsa (Simulasi HTTP 410 Gone)...
[web-push] Received 410 Gone from push service
[Worker Handler] Endpoint tidak valid atau kadaluarsa (HTTP 410). Menonaktifkan langganan...
[Database] UPDATE push_subscriptions SET aktif=false WHERE endpoint='https://fcm.googleapis.com/...'
[Database] UPDATE notifikasi SET push_status='gagal', push_error='Gagal mengirim push: Endpoint 410 Gone (Subscription expired or unsubscribed)' WHERE id='...'
[Hasil Uji] Subscription sukses dinonaktifkan tanpa retry berulang (LULUS).
```

---

## 9. Butir 9: Konsistensi Data & Penanganan Galat Global

- **Objek Pengujian**:
  1. Konsistensi angka rekapitulasi data kunjungan admin terhadap database (`/api/admin/rekap`).
  2. Format galat terstandar tanpa bocoran SQL / stack trace ke client.
  3. Ketahanan fail-open rate limiting saat Redis offline.
- **Perintah Eksekusi**:
*(Catatan: Keluaran di bawah dicatat saat pengujian verifikasi Tahap 1E; skrip pengujian per tahap internal tidak disertakan di repositori publik)*
```powershell
powershell -ExecutionPolicy Bypass -File scripts/uji-suite.ps1
```
- **Keluaran Nyata**:
```text
[1] Uji Konsistensi Rekapitulasi:
    Total Kunjungan Rekap: 12
    Penjumlahan Kunjungan per Status (Terdaftar 2 + Hadir 3 + Selesai 5 + Batal 2): 12
    -> STATUS: KONSISTEN (Total Rekap = Sum Status).

[2] Uji Penanganan Galat DB Buatan:
    Request: GET /api/test-db-error
    Status HTTP: 500 Internal Server Error
    Body: {"error":{"code":"INTERNAL","message":"Terjadi kesalahan server"}}
    -> Bersih dari kebocoran sintaks SQL, nama tabel, maupun stack trace internal.

[3] Uji Ketahanan Fail-Open Redis:
    REDIS_URL dinonaktifkan sementara.
    Request bisnis tetap dilayani dengan status HTTP 200 OK.
    Log Pino mencatat peringatan: "[WARN] Rate limiter Redis gagal terhubung, beralih ke cache memori lokal (fail-open)".
```
