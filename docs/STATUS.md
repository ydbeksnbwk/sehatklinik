# Status Proyek Sistem Informasi Klinik Kesehatan (Tim 7)

Terakhir diperbarui: 18 November 2026 (Audit Kepatuhan Menyeluruh, Login Cepat Demo, Eliminasi Data Statis, & Pembuktian RLS)

---

## 1. Ringkasan Status per Tahap

| Tahap | Deskripsi | Status | Keterangan |
|---|---|---|---|
| **Langkah 0** | Audit, pembersihan Git, integrasi arahan dosen | **SELESAI** | Cabang `feat/tahap-1` aktif, aturan K1–K15 & konfirmasi dosen terintegrasi |
| **Tahap 1A** | Pulihkan backend inti: auth, transaksi Drizzle, aturan bisnis, Zod | **SELESAI** | 9 skenario uji mandiri via `scripts/uji-api.ps1` **PASS (100%)**, `npm run build` hijau |
| **Tahap 1B** | Sesi cookie httpOnly, logout, middleware Next.js | **SELESAI** | Cookie httpOnly, CSRF protection, redirect 307 ke /login, logout route teruji |
| **Tahap 1C** | Hubungkan frontend ke API, eliminasi Supabase browser | **SELESAI** | Supabase browser SDK dihapus (0 pemanggilan), data dokter/foto/layanan terintegrasi API |
| **Tahap 2** | Skema Web Push (migrasi SQL & schema Drizzle) | **SELESAI** | Sesuai PRD §9, tabel `push_subscriptions` dan relasi profiles terintegrasi |
| **Tahap 3** | Service Worker sw.js & Web Push VAPID API | **SELESAI** | Sesuai PRD §9, endpoint `/api/push/kunci` dan `/api/push/langganan` aktif |
| **Tahap 4** | Background Worker BullMQ + Redis | **SELESAI** | Sesuai PRD §9, pipeline antrean `notifikasi` outbox dan background processor |
| **Tahap 1D** | Endpoint admin & upload foto dokter Supabase Storage | **SELESAI** | CRUD `/api/admin/layanan`, `/api/admin/pengguna` (BR-11), profil klinik, rekap DB, foto dokter (magic bytes), `/api/petugas/pasien/[id]` terhubung UI |
| **Tahap 1E** | Rate limiting, Pino logger, format galat global | **SELESAI** | Pembungkus apiHandler global, Zod utang K7, rate limit Redis/memori fail-open, Pino redaksi rahasia, audit rahasia & ESLint non-interaktif |
| **Tahap 5** | Seed database, verifikasi demo, dokumentasi | **SELESAI** | Seed PRD §6.3 idempoten sejati, verifikasi SQL constraint, suite API 25/25 lulus, README, ARSITEKTUR, ERD, BUKTI_VERIFIKASI, FITUR |
| **Tahap 6** | Deployment & pengujian produksi | **SEBAGIAN (BAGIAN A SELESAI)** | Bagian A (Kesiapan kode, worker:prod, middleware x-forwarded-host, Redis fail-open, pembersihan outbox, DEPLOYMENT.md, uji-deploy.ps1, UJI_DEPLOY.md) selesai; Bagian B menunggu eksekusi deploy Vercel & worker oleh pengguna |
| **Audit Kepatuhan** | Eliminasi data statis, login cepat demo, audit RLS & rute API | **SELESAI** | 100% data live dari API/DB, login cepat 4 peran teruji, RLS 14 tabel (40 policy) terbukti transaksional, tsc/lint/build hijau |

---

## 2. Rincian Pemulihan Tahap 1C

### A. Penggabungan Data & Kelengkapan Katalog (`layanan` & `jadwal_praktik`)
- Melengkapi katalog `layanan` di database Supabase dengan layanan "Pemeriksaan Berkala" (durasi 45 menit) menggunakan klausul `ON CONFLICT DO NOTHING`.
- Menghubungkan relasi dokter umum ke layanan "Pemeriksaan Berkala" pada tabel `dokter_layanan`.
- Menjaga integritas data pengguna, dokter, dan URL foto dokter yang sudah ada di Supabase Storage.

### B. Helper Fetch Terpusat (`src/utils/api.ts`)
- Dibuat helper `fetchApi<T>` dengan opsi `credentials: 'same-origin'` untuk seluruh komunikasi client-to-server.
- Membungkus endpoint publik (`apiGetDokter`, `apiGetLayanan`, `apiGetJadwal`, `apiGetProfilKlinik`), auth (`apiGetMe`, `apiLogin`, `apiLogout`, `apiRegister`), operasional kunjungan (`apiGetKunjungan`, `apiTambahKunjungan`, `apiTransisiKunjungan`, `apiSimpanPemeriksaan`), dan data pasien (`apiGetPasien`, `apiTambahPasien`).

### C. Eliminasi Total Supabase SDK di Browser & Penyambungan UI (`src/context/ClinicContext.tsx`)
- Menghapus berkas `src/utils/supabase/client.ts`.
- Menghapus seluruh query `supabase.from`, `supabase.auth`, dan `supabase.channel` (Realtime) dari sisi client.
- Mengganti state awal `ClinicContext` agar memuat data katalog dan sesi secara dinamis melalui API backend.
- Menerapkan mekanisme polling antrean otomatis setiap 5 detik dengan listener `visibilitychange` (polling aktif hanya saat tab browser terlihat, sesuai K5 dan Dokumen Induk §8.5).
- Menyambungkan form pendaftaran kunjungan, antrean petugas/dokter, pemeriksaan medis, dan logout ke endpoint backend internal.

---

## 3. Bukti Pengujian Nyata Tahap 1C
1. **Data Dokter & Foto Supabase**:
   - `GET /api/public/dokter` mengembalikan data lengkap dokter beserta URL foto Supabase Storage publik (misal: `https://swrzfderhamcjawwkwkt.supabase.co/storage/v1/object/public/foto-dokter/reyhan.png`).
2. **Data Layanan**:
   - `GET /api/public/layanan` mengembalikan seluruh 6 layanan terdaftar (Pemeriksaan Umum, Kesehatan Gigi, Kesehatan Anak, Kebidanan & Kandungan, Konsultasi Gizi, Pemeriksaan Berkala).
3. **Eliminasi Supabase di Frontend**:
   - Pencarian `supabase` di seluruh file `.tsx` (`src/components`, `src/context`, `src/app`) menghasilkan **0 baris** (bersih total).
4. **Kompilasi Produksi Next.js**:
   - `npm run build` sukses 100% tanpa error tipe atau kompilasi (ukuran First Load JS turun dari 235 kB menjadi 166 kB).

---

## 4. Catatan Kesenjangan yang Terselesaikan (per 14 November 2026)

- **Endpoint koreksi data administratif pasien oleh petugas (`PATCH /api/petugas/pasien/[id]`) SELESAI.**
  - Kontrak API (§7) dan alur administrasi pasien telah terpenuhi.
  - Petugas dapat mengoreksi nama, NIK (16 digit angka unik), tanggal lahir, jenis kelamin, serta informasi kontak/alamat.
  - Pasien tetap berstatus baca-saja untuk NIK dan nama resmi, dan jika ada perubahan oleh petugas, data otomatis tersinkronisasi ke tabel `profiles` pasien.
  - Terproteksi `requireRole(request, ["petugas"])` (pasien/admin ditolak). Validasi masukan dengan Zod dan penegakan constraint unik DB (409 jika NIK duplikat). Terhubung ke UI di `ClinicWorkspace.tsx`.

---

## 5. Perbaikan Butir Pasien (per 12 November 2026)

Dikerjakan di cabang `feat/tahap-1`, satu commit per butir:

- **Butir 1 (pembatalan kunjungan bermasalah)** � commit `2729cad`: adapter `konversiKunjungan()` di `src/context/ClinicContext.tsx` diperbaiki membaca field datar `kunjunganId`/`statusAntrean`/`nomorAntrean`/`alasan` dari `GET /api/kunjungan` (sebelumnya membaca `id` dan `antrean` yang tidak ada, sehingga `Visit.id = undefined` dan POST transition gagal senyap). `syncVisitTransition` kini melempar galat (tidak ditelan), `transition()` menyegarkan data via `refreshKunjungan()` baru, galat menampilkan toast dan modal tetap terbuka dengan tombol aktif kembali.
- **Butir 2 (React duplicate key)** � commit `2729cad` (akar sama): key `patientCard` (`key={v.id}`) kini unik karena id = kunjunganId.
- **Butir 3 (Riwayat kosong/0 kunjungan)** � commit `2729cad` + `48dae79`: filter `["Selesai","Dibatalkan","Dilewati"].includes(v.queue)` kini cocok dengan data asli (sebelumnya semua baris "Menunggu"); tabel riwayat menampilkan alasan pembatalan/pelewatan di bawah badge status antrean.
- **Bukti API**: `POST /api/kunjungan/f5750233-2689-4dca-a64d-a1a9e3e307f0/transition` aksi `batal` ? 200 `{statusKunjungan:"batal", statusAntrean:"batal"}`; `GET /api/riwayat` ? 200 (12 baris, status batal + selesai + alasan). Skrip uji: `scripts/uji-pembatalan.ps1`.
- **Butir 5 (label hanya-baca)** � commit `1e72761`: label form Edit Profil tanpa keterangan "(hanya-baca � hubungi petugas untuk koreksi)"; ikon pensil (`Icon name="edit"`, path baru di `src/components/Icon.tsx`) hanya pada Alamat/Nomor telepon/Kontak darurat untuk peran Pasien; logika PATCH tidak berubah.
- **Butir 6 (kotak info staf di login)** � commit `5e0b4f6`: kotak "Staf (Petugas, Dokter, Admin) wajib login..." dihapus dari halaman Login (`PublicSite.tsx`); catatan pendaftaran pada halaman Daftar tetap.
- **Butir 7 (kartu "Akses sesuai peran")** � commit `f0ddfd3`: teks "Hanya data kunjungan dan riwayat milik Anda." dihapus; untuk Pasien paragraf disembunyikan penuh. Pencarian `git grep` tidak menemukan teks serupa di berkas frontend lain.
- **Butir 4 (persistensi)** � dibuktikan lewat API: status batal tersimpan di `kunjungan` dan `antrean` (kembali sama via GET setelah transaksi), `GET /api/kunjungan` pasca-reload menunjukkan status batal. Verifikasi kuota jadwal (SELECT `count(*) FILTER (WHERE status <> 'batal')`) menunggu hasil dari SQL Editor Supabase (agen tidak punya akses dashboard).
- **Verifikasi**: `npx tsc --noEmit` lulus; `npm run build` sukses (36/36 halaman). `npm run lint` tidak bisa dijalankan non-interaktif (belum ada config ESLint � `next lint` meminta pemilihan preset).

---

## 6. Perbaikan Butir Lanjutan (per 13 November 2026)

- **Kartu "Akses sesuai peran"** � commit `c934fc0`: kartu help-card (ikon perisai + judul + paragraf) dihapus dari sidebar; aturan CSS `.help-card/.help-symbol` di `index.css`, `design-system.css`, `cinematic.css` dihapus karena tidak terpakai lagi (`git grep help-card` kosong).
- **Flash Beranda** � commit `ee13f5c`: `role` state awal "Publik" membuat ClinicWorkspace merender PublicSite sebelum efek/`/api/auth/me` selesai. Kini selama `authChecked=false` komponen mengembalikan skeleton `ws-skeleton-grid` yang sudah ada, bukan PublicSite.
- **UUID di UI** � commit `bdd81a8`: tabel rekap/antrean, tiket "Nomor antrean Anda", dan kartu antrean berikutnya menampilkan `v.ref` (no_referensi); adapter `konversiKunjungan()` mengisi `ref` dari `k.noReferensi`; `submitBooking` mengisi `ref` dari respons POST. Masih dilaporkan (belum diubah): `receipt.id` di modal struk (baris ~1848) dan `<code>{j.id}</code>` di kartu job notifikasi (~3488).
- **Warna toast** � commit `2c101a8`: toast memakai `var(--sk-brand)` (navy tombol utama) dan `var(--sk-surface)` untuk teks/tombol, bukan hijau `#173c30`. Tidak ada varian toast terpisah; feedback galat memakai banner/modal merah yang sudah ada.
- **Tandai dibaca tidak bertahan** � commit `4ab78dc`: akar masalah `markAllNotificationsAsRead`/`markNotificationAsRead` hanya mengubah state lokal tanpa memanggil API. Kini memanggil `PATCH /api/notifikasi` (semua) dan `PATCH /api/notifikasi/[id]` (satu) via `apiTandaiSemuaNotifikasiDibaca`/`apiTandaiNotifikasiDibaca`; state berubah hanya setelah API sukses, gagal -> toast galat. Notifikasi lokal (id `notif-`/`reminder-`) tetap state-only. Polling 5 detik hanya memuat kunjungan, tidak menimpa notifikasi.
  - Bukti uji nyata (dev server sementara, lalu dihentikan): login ani.wulandari -> GET belumDibaca=17 -> PATCH semua 200 `{diperbarui:17}` -> GET belumDibaca=0 -> logout -> login ulang -> GET belumDibaca=0 (tersimpan di DB). PATCH satu item -> 200 isRead=true. PATCH tanpa sesi -> 401.
  - SELECT verifikasi pemilik: `select profile_id, is_read, count(*) from notifikasi group by 1,2 order by 1,2;`

---

## 7. Verifikasi Backend Tahap 1C (per 13 November 2026)

Metode: build produksi (`npm run build`, 36/36 halaman), server `npm run start` di port 3000 (bukan `npm run dev`), lalu skrip uji. Pada 13 November 2026 handler legacy dihapus (commit `d9d5d92`) dan fixture `scripts/uji-api.ps1` diperbaiki (commit `0c29ef9`). Bukti verifikasi 14 kasus tambahan ada di `scripts/uji-verifikasi-1c.ps1`.

### 7.1 Audit Route Handler (`src/app/api/**/route.js`)

| Route | Metode | requireRole | Cek kepemilikan | Drizzle | Zod |
|---|---|---|---|---|---|
| admin/dokter | GET, POST | admin | n/a | ya | tidak (validasi manual) |
| admin/dokter/[id] | PATCH | admin | n/a | ya | tidak (validasi manual) |
| admin/jadwal | POST | admin | n/a | ya | tidak (validasi manual) |
| admin/jadwal/[id] | PATCH | admin | n/a | ya | tidak (validasi manual) |
| auth/daftar | POST | publik (alias register) | n/a | ya | ya |
| auth/login | POST | publik (dikecualikan) | n/a | ya | tidak (validasi manual) |
| auth/logout | POST | publik | n/a | tidak | n/a |
| auth/me | GET | semua login | diri sendiri | ya | n/a |
| auth/register | POST | publik (dikecualikan) | n/a | ya | ya |
| health | GET | publik | n/a | `pool.query` | n/a |
| kunjungan | GET, POST | GET semua login; POST pasien, petugas | pasien=self; dokter hanya miliknya | ya | GET manual; POST ya |
| kunjungan/[id]/pemeriksaan | PUT | dokter | dokter pemilik | ya | ya |
| kunjungan/[id]/transition | POST | semua login; admin ditolak 403 | per aksi di `domain/transisi.js` | ya | ya |
| notifikasi | GET, PATCH | semua login | `profileId` = sesi | ya | n/a |
| notifikasi/[id] | PATCH | semua login | `id` + `profileId` | ya | UUID |
| pasien | GET, POST | GET petugas, admin; POST petugas | n/a | ya | GET manual; POST ya |
| profil | GET, PATCH/PUT | semua login | diri sendiri | ya | pasien ya; admin manual |
| public/dokter | GET | publik | n/a | ya | manual query |
| public/jadwal | GET | publik | n/a | ya | manual query |
| public/klinik | GET | publik | n/a | ya | n/a |
| public/layanan | GET | publik | n/a | ya | manual query |
| push/kunci | GET | publik (VAPID public key) | n/a | tidak | n/a |
| push/langganan | POST, DELETE | semua login | `profileId` = sesi | ya | ya |
| riwayat | GET | semua login | pasien self; dokter hanya pasien yang ia tangani | ya | manual query |

Kesimpulan audit: **tidak ada route bisnis yang lupa `requireRole` atau cek kepemilikan**. Route terbuka hanya `public/*`, `auth/login|register|daftar`, `auth/logout`, `health`, dan `push/kunci`. `health` (ping DB) dan `push/kunci` (kunci publik VAPID, memang harus dapat dibaca peramban) sengaja terbuka dan tidak membocorkan data pribadi.

### 7.2 Hasil statik (apa adanya)

- `git grep -n "createAdminClient" -- src/app/api` -> tidak ada hasil.
- `git grep -n -i "supabase" -- src/components src/context src/utils/api.ts` -> hanya 1 komentar di `src/utils/api.ts:3` ("menolak supabase-js di peramban"); tidak ada impor/pemanggilan.
- `Get-ChildItem src\app\api -Recurse -Filter route.ts` -> 0 berkas (semua Route Handler `.js`).
- `Select-String "localStorage|sessionStorage"` pada `src/**/*.ts(x)` -> 18 baris; semuanya kunci UI (`sehatklinik_flash`, `sehatklinik_welcome_sent`) dan pembersihan state lama (`sehatklinik_state_v1..v3`, `sehatklinik_current_user`). Tidak ada token/sesi yang disimpan di storage peramban.
- `git grep -n -E "supabase\.(from|rpc|channel)|createClient|Realtime" -- src/components src/context src/utils src/app/api` -> hanya `src/utils/supabase/admin.ts` dan `src/utils/supabase/server.ts` (khusus server, tidak diimpor komponen klien).

### 7.3 `scripts/uji-api.ps1` (server produksi)

| Kasus | Hasil |
|---|---|
| GET /api/kunjungan tanpa token -> 401 | PASS |
| Pasien check-in (transisi) -> 403 | PASS |
| Admin check-in (transisi) -> 403 | PASS |
| Pendaftaran duplikat -> 409 (BR-02) | PASS |
| Pendaftaran kuota penuh -> 409 (BR-01) | PASS |
| Nomor antrean dua pendaftaran tidak bertabrakan | PASS (#1 dan #2) |
| Pasien memakai ID kunjungan orang lain -> 403/404 | PASS (403) |
| NIK tidak 16 digit -> 400 | PASS |
| Tanda vital di luar rentang -> 400 (BR-18) | PASS |
| Pasien batal < 2 jam -> 409 (BR-08) | PASS (jadwal hari ini dicari dari kolom `hari`, bukan tanggal hardcode) |
| Pasien batal kunjungan masa depan -> 200, batal ulang -> 409 | PASS |
| Dokter lain mengisi pemeriksaan -> 403 (BR-10) | PASS |
| createAdminClient di route handler | PASS (0 hasil) |

Tidak ada PASS/FAIL yang bergantung pada fixture lama lagi: login dokter memakai `dokter.reyhan@gmail.com`, dan kasus BR-08 memilih jadwal yang hari praktiknya sama dengan hari ini lalu menghitung tanggal dari `jadwal_praktik.hari` (0=Minggu..6=Sabtu). Bila tidak ada jadwal yang mulai < 2 jam pada hari uji, skrip memakai tanggal terdekat sesuai hari jadwal dan mengharapkan status sesuai selisih jam (409 bila < 2 jam, 200 bila >= 2 jam), bukan SKIP.

### 7.4 `scripts/uji-pembatalan.ps1` (server produksi)

Skrip asli menyalakan `next dev` sendiri; sesuai larangan, blok `Start-Process ... next dev` dihapus pada salinan sementara dan permintaan diarahkan ke server produksi. Hasil:

- `[1] LOGIN PASIEN OK`.
- `[2] SEBELUM` kunjungan `f5750233-...` sudah `statusKunjungan=batal`, `statusAntrean=batal`, `alasan="Reproduksi butir 1 pembatalan"` (fixture lama sudah dibatalkan pada uji sebelumnya).
- `[3] POST /api/kunjungan/f5750233-.../transition` aksi batal -> **409** `STATUS_TIDAK_VALID` "Pembatalan oleh pasien hanya bisa saat antrean masih Menunggu" (benar; bukan 500).
- `[4] SESUDAH` data tidak berubah (tetap batal).
- `[5] GET /api/riwayat` -> **200**, memuat kunjungan tersebut dengan `status=batal`.

### 7.5 Kasus tambahan (`scripts/uji-verifikasi-1c.ps1`) - 14 LULUS, 0 GAGAL

1. GET /api/pasien tanpa login -> **401**.
2. GET /api/pasien oleh pasien -> **403**.
3. PATCH /api/profil `{nik}` -> **400**; `{role}` -> **400**; GET /api/profil sesudahnya menunjukkan NIK tidak berubah (3374019999000001).
4. Pasien membatalkan kunjungan milik pasien lain (ID nyata) -> **403**.
5. Pasien PATCH notifikasi milik akun petugas (ID nyata) -> **404**.
6. Admin check-in kunjungan nyata -> **403**.
7. Dokter (akun aktif) tanda vital di luar rentang -> **400**; dokter bukan pemilik kunjungan -> **403**.
8. Login 4 peran uji berhasil (tanpa mencetak token/cookie).

### 7.6 Handler legacy dihapus dan temuan yang tersisa

- **Dihapus** (commit `d9d5d92`): `PATCH /api/antrean/[id]` dan `PATCH /api/kunjungan/[id]`. Bukti tidak dipakai: `git grep -n "api/antrean" -- src scripts` hanya menemukan string di dalam handler itu sendiri, dan `git grep -n "api/kunjungan/" -- src scripts` hanya memuat `transition`, `pemeriksaan`, serta `/api/kunjungan` (tanpa `/[id]`). Frontend hanya memanggil `/api/kunjungan/${id}/transition` dan `/api/kunjungan/${id}/pemeriksaan`. Kedua handler lama mengizinkan `admin` (melanggar K12/K14), memakai validasi manual, dan `PATCH /api/kunjungan/[id]` tidak menerapkan BR-08/BR-15. Setelah dihapus, PATCH ke kedua URL menghasilkan **404** (berkas tidak ada; bukan 405 karena route dihapus).
- **Utang Zod (Tahap 1D/1E)**: Zod belum dipakai di `admin/dokter` (POST/PATCH), `admin/jadwal` (POST/PATCH), `auth/login`, dan cabang admin `PATCH /api/profil`; semuanya masih validasi manual. Melanggar K7 dan harus diseragamkan.
- **Data ganda**: ada dua baris `profiles` bernama "dr. Reyhan Adhitama" (`reyhan.adhitama@gmail.com`, tidak bisa login dengan password uji, dan `dokter.reyhan@gmail.com`). Perbaikan harus lewat seed atau migrasi Drizzle baru, bukan mengedit tabel langsung di SQL Editor Supabase. Skrip uji sudah diarahkan ke akun aktif.
- **Alur transisi lengkap tetap utuh** setelah penghapusan: `check-in` (petugas), `panggil`, `periksa`, simpan `pemeriksaan`, `selesai`, dan `batal` (petugas) semuanya **200** pada kunjungan nyata hari ini (lihat 7.8).

### 7.7 Belum teruji / belum ada

- `PATCH /api/petugas/pasien/[id]` (koreksi data pasien oleh petugas) **belum ada**; kontrak API dan teks "hubungi petugas untuk koreksi" di halaman profil belum punya endpoint.
- Web Push **belum ada**: `push_subscriptions` dan endpoint langganan sudah ada, tetapi worker/penjadwal, pengiriman `web-push`, retry, dan pemrosesan `pushStatus` belum dibuat.
- Zod untuk route admin dan login (lihat 7.6) belum dikerjakan; dijadwalkan Tahap 1D/1E.
- Halaman admin lanjutan (`/api/admin/layanan`, `/pengguna`, `/profil-klinik`, `/rekap`, `/pekerjaan-notifikasi`, unggah foto dokter) menyusul Tahap 1D.
- Uji beban/paralelisme nyata (dua request serentak) belum dijalankan; uji nomor antrean pada 7.3 berurutan, bukan paralel.
- RLS belum diuji dengan koneksi anon; aplikasi memakai `DATABASE_URL` role `postgres` yang melewati RLS (sesuai PRD §8), sehingga RLS baru menjadi lapisan cadangan.

### 7.8 Bukti alur transisi setelah penghapusan handler legacy

Kunjungan walk-in baru pada jadwal dr. Reyhan hari Jumat (tanggal dihitung dari hari jadwal), lalu transisi berurutan:

| Aksi | Pelaku | HTTP |
|---|---|---|
| Daftar walk-in (`POST /api/kunjungan`) | petugas | 200 |
| `checkin` | petugas | 200 |
| `panggil` | dokter pemilik | 200 |
| `periksa` | dokter pemilik | 200 |
| `PUT .../pemeriksaan` | dokter pemilik | 200 |
| `selesai` | dokter pemilik | 200 |
| `batal` (kunjungan walk-in kedua) | petugas | 200 |

`PATCH /api/antrean/00000000-...` dan `PATCH /api/kunjungan/00000000-...` -> **404** (sesi pasien valid; route sudah tidak ada). `scripts/uji-verifikasi-1c.ps1` -> **14 LULUS, 0 GAGAL**.

### 7.9 Verifikasi akhir

- `npx tsc --noEmit` -> lulus.
- `npm run build` (tanpa server dev, `NODE_OPTIONS=--max-old-space-size=4096`) -> sukses, 36/36 halaman.
- Commit: `d9d5d92` (hapus handler legacy), `0c29ef9` (perbaikan fixture `uji-api`). `scripts/uji-verifikasi-1c.ps1` sudah ter-commit sebelumnya (`02aaef2`).
- Catatan: `scripts/uji-pembatalan.ps1` memiliki perubahan lokal yang bukan berasal dari tugas ini (login hardcode menggantikan `$env:UJI_EMAIL`/`$env:UJI_PASSWORD`); tidak di-commit dan tidak diubah.

---

## 8. Kesiapan Deploy Vercel (per 13 November 2026)

### 8.1 Kondisi pool database sebelum dan sesudah

- Sebelum: `src/db/index.js` memakai `max: 5`, tanpa opsi khusus pooler. Tidak ada prepared statement bernama di kode aplikasi; `drizzle-orm/node-postgres` memanggil `client.query(text, params)` tanpa `name` (diperiksa di `node_modules/drizzle-orm/node-postgres/session.js`), sehingga cocok dengan transaction pooler Supabase.
- Sesudah (commit `ebea299`): `max: 3`. `DATABASE_URL` untuk Vercel wajib memakai pooler transaksi Supabase (port 6543), sedangkan worker memakai koneksi langsung (port 5432).
- `src/lib/rls.js`: `set_config('request.jwt.claims', ..., true)` dan `SET LOCAL ROLE authenticated/anon` hanya dieksekusi di dalam `db.transaction(...)`. `git grep -n "set_config|set local role|SET ROLE" -- src worker scripts` hanya menemukan tiga baris di `src/lib/rls.js`, semuanya di dalam transaksi.

### 8.2 Isolasi kode server dari komponen klien

- `git grep -n -l 'use client' -- src` -> 12 berkas: `src/app/{daftar,dashboard,login}/page.tsx`, `src/components/{BrandArtwork,CinematicArtwork,ClinicMap,ClinicWorkspace,GenderAvatar,Icon,NotificationDrawer,PublicSite}.tsx`, `src/context/ClinicContext.tsx`.
- `git grep -n '@\/lib\/supabase\|@\/utils\/supabase\|@\/db\|from "pg"\|from "drizzle-orm"' -- src/components src/context` -> **tidak ada hasil**. Tidak ada komponen klien/context yang mengimpor `db`, `pg`, `supabaseAdmin`, atau klien Supabase server.
- `git grep -n 'src/app/api' -- src/components src/context src/utils` -> tidak ada hasil.
- Variabel `NEXT_PUBLIC_*` yang dipakai: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Pemeriksaan nilai `.env.local` (tanpa mencetak nilai) menunjukkan **tidak ada** nilai `SUPABASE_SERVICE_ROLE_KEY` atau `VAPID_PRIVATE_KEY` yang dipasang ke nama `NEXT_PUBLIC_*`.

### 8.3 `.env.example`

Nama yang dipakai `process.env` di kode (grep) dan statusnya di `.env.example`:

| Nama | Ada di `.env.example` |
|---|---|
| `DATABASE_URL` | ya |
| `SUPABASE_SERVICE_ROLE_KEY` | ya |
| `NEXT_PUBLIC_SUPABASE_URL` | ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ya |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ya |
| `VAPID_PUBLIC_KEY` | ya (ditambahkan commit `707738f`) |
| `VAPID_PRIVATE_KEY` | ya |
| `VAPID_SUBJECT` | ya |
| `REDIS_URL` | ya |
| `NODE_ENV` | diisi otomatis oleh Next.js/Vercel; hanya catatan komentar, tidak diset manual |

Semua entri tanpa nilai asli. `NODE_ENV` sengaja tidak diberi baris `NODE_ENV=` karena Next.js menetapkannya sendiri saat build/start dan nilai kosong dapat memicu peringatan non-standar.

### 8.4 Build dan middleware

- `npx tsc --noEmit` -> lulus.
- `npm run build` tanpa dev server -> sukses 36/36 halaman, **tanpa peringatan variabel lingkungan hilang** (hanya peringatan internal webpack tentang serialisasi cache, bukan env).
- `src/middleware.ts` masih memiliki guard env (`if (supabaseUrl && supabaseKey)`) dan seluruh badan dibungkus `try/catch` yang mengembalikan `NextResponse.next()` saat gagal.

### 8.5 Berkas env yang terlacak

- `git ls-files | Select-String "\.env"` -> hanya `.env.example`.
- `.env.local`, `.next`, dan `node_modules` diabaikan: `.gitignore` baris `.env*.local`, `/.next/`, `/node_modules`; `git ls-files` untuk `.next/` dan `node_modules/` -> 0 berkas.

### 8.6 Variabel yang diisi di Vercel

Nama saja, tanpa nilai. Tandai **Sensitive** di dashboard Vercel untuk baris bertanda Ya.

| Variabel | Sensitive | Wajib di Vercel | Catatan |
|---|---|---|---|
| `DATABASE_URL` | Ya | ya | Pooler transaksi Supabase, port **6543** (`...pooler.supabase.com:6543/postgres`), bukan koneksi langsung |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | ya | Hanya server (Auth Admin) |
| `NEXT_PUBLIC_SUPABASE_URL` | Tidak | ya | URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tidak | ya | Kunci publik; dipakai `src/lib/supabase.js` dan fallback middleware |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Tidak | tidak (opsional) | Bila memakai key publishable baru; middleware memprioritaskannya |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Tidak | ya | Untuk langganan push di browser |
| `VAPID_PUBLIC_KEY` | Tidak | tidak (opsional) | `/api/push/kunci` memakai ini lebih dulu, fallback ke `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |

Variabel berikut **bukan untuk Vercel**, melainkan untuk worker (Railway/Render) dan Redis (Upstash):

| Variabel | Sensitive | Catatan |
|---|---|---|
| `DATABASE_URL` | Ya | Untuk worker pakai koneksi langsung Supabase (port 5432), bukan pooler 6543 |
| `REDIS_URL` | Ya | Upstash dengan skema `rediss://` |
| `VAPID_PRIVATE_KEY` | Ya | Hanya worker; jangan pernah di `NEXT_PUBLIC_*` |
| `VAPID_PUBLIC_KEY` | Tidak | Nilai sama dengan `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| `VAPID_SUBJECT` | Tidak | `mailto:` pengelola |

### 8.7 Catatan deploy

1. Isi env Vercel di atas untuk Production/Preview sesuai kebutuhan; jangan menaruh `VAPID_PRIVATE_KEY` atau `REDIS_URL` di Vercel bila worker tidak dijalankan di sana.
2. Deploy, lalu cek `GET /api/health` -> `{"data":{"database":"ok"}}`; login tiap peran dan buka `/kunjungan/[id]` serta `/riwayat/[id]` lewat URL HTTPS.
3. Worker dan push nyata tetap diuji terpisah setelah worker dideploy; sampai saat itu status Web Push masih seperti §7.7.
4. `DATABASE_URL` pooler transaksi tidak mendukung prepared statement bernama; kode aman karena semua query Drizzle memakai statement tanpa nama dan `SET LOCAL` hanya di dalam transaksi.

---

## 9. Audit & Perbaikan Web Push Notification dan Worker (per 14 November 2026)

Dikerjakan di cabang `feat/tahap-1` berdasarkan PRD §7.

### 9.1 Ringkasan Perbaikan per Butir

1. **Butir 1 - Worker (`worker/index.mjs`)**:
   - Migrasi ke ESM `.mjs` dan skrip `npm run worker` diperbarui (`node --env-file=.env.local worker/index.mjs`) untuk mengeliminasi peringatan `MODULE_TYPELESS_PACKAGE_JSON`. Tanpa menambah `"type": "module"` di `package.json`.
   - Logging terstruktur Pino dalam format JSON dengan redaksi ketat (password, token, authorization, cookie, private key, DATABASE_URL, REDIS_URL, p256dh, auth). Endpoint disamarkan (hanya host dan 8 karakter terakhir).
   - Interval pemindai (scanner) disetel ke 30 detik (`SCAN_INTERVAL_MS = 30000`) dan berjalan saat start up.
   - Klaim anti-ganda atomik di database: `UPDATE notifikasi SET push_diproses_at = NOW() WHERE id = $1 AND push_status = 'menunggu' RETURNING ...`.
   - Penanganan status PRD §7.4: 201 -> berhasil; 404/410 -> nonaktifkan subscription (`aktif = false`) tanpa retry; tanpa subscription aktif -> gagal; 429/5xx/timeout -> retry exponential backoff max 5x; 400/401/403 -> gagal permanen via `UnrecoverableError` dari BullMQ.
   - Validasi ketat kunci VAPID saat startup: berhenti dengan `process.exit(1)` bila kunci tidak lengkap.
   - Graceful shutdown SIGTERM/SIGINT: menutup worker BullMQ, queue, Redis, pool database, dan exit 0 rapi.
   - Pustaka `pino`, `bullmq`, `ioredis`, `web-push` lengkap di `dependencies` package.json.

2. **Butir 2 - Sisi Web (Enqueue & Langganan)**:
   - Modul `src/lib/push-queue.js`: Enqueue ke BullMQ setelah commit transaksi bisnis (`/api/kunjungan` pendaftaran dan `/api/kunjungan/[id]/transition` transisi antrean), dibungkus `try/catch`. Bila Redis mati/offline, transaksi bisnis tetap 100% sukses dan notifikasi menunggu di outbox ditanggung oleh scanner worker.
   - `GET /api/push/kunci`: hanya mengembalikan kunci publik VAPID tanpa membocorkan private key.
   - `POST /api/push/langganan`: validasi Zod, `requireRole` login, upsert terikat `profile_id`.
   - `DELETE /api/push/langganan`: validasi Zod, verifikasi kepemilikan. Bila endpoint tidak ditemukan atau milik akun lain, menghasilkan 404 Not Found (sesuai Aturan Keras 5).
   - `POST /api/auth/logout`: menonaktifkan seluruh subscription aktif milik pengguna (`aktif = false`) saat logout.

3. **Butir 3 - Tombol Aktifkan Notifikasi & Service Worker (`public/sw.js`)**:
   - `public/sw.js`: Event push membaca payload JSON (`judul`, `pesan`, `tautan` serta fallback `title`, `body`, `url`). Event `notificationclick` membuka atau memfokuskan tab dengan validasi path relatif ketat (mencegah open redirect).
   - Worker mengirim payload JSON berisikan `judul`, `pesan`, dan `tautan`.
   - Tombol "Aktifkan Notifikasi" tersedia untuk Pasien, Petugas, dan Dokter. Izin `requestPermission` hanya dipanggil setelah klik pengguna. Menangani status izin diberikan, diblokir/ditolak (dengan panduan membuka blokir), browser tidak mendukung, dan kegagalan subscription.

4. **Butir 4 - Halaman & Endpoint Pekerjaan Notifikasi**:
   - `GET /api/admin/pekerjaan-notifikasi`: Route Handler Next.js terproteksi `requireRole(request, ["admin", "petugas"])`. Pasien dan Dokter ditolak 403 Forbidden. Validasi query Zod (`page`, `pageSize`, `status`), join relasi nama penerima dari tabel `profiles`, dan pagination dengan metadata `{ page, pageSize, total, totalPages }`.
   - Frontend `ClinicWorkspace.tsx`: Halaman "Pekerjaan Notifikasi" terhubung langsung ke backend via `apiGetPekerjaanNotifikasi` (`src/utils/api.ts`). Dilengkapi loading skeleton, empty state, banner error, filter status, dan pagination bar.

5. **Butir 5 - Privasi Isi Notifikasi**:
   - Hasil audit `db/migrations/12_web_push_notifikasi.sql`: Tidak ditemukan keluhan, diagnosis, atau NIK di dalam pesan notifikasi. Seluruh pesan hanya memuat nomor antrean, nama dokter, dan tanggal/alasan pelewatan antrean.

### 9.2 Bukti Pengujian Nyata

- Skrip `scripts/uji-push.mjs` / `scripts/uji-push.ps1`:
  - (a) `GET /api/push/kunci` -> 200 OK, kunci publik tersedia, `VAPID_PRIVATE_KEY` tidak bocor.
  - (b) `POST /api/push/langganan` tanpa login -> 401 UNAUTHENTICATED.
  - (c) `DELETE /api/push/langganan` milik akun lain -> 404 NOT_FOUND. Menghapus milik sendiri -> 200 OK.
  - (d) `GET /api/admin/pekerjaan-notifikasi` -> Pasien 403 FORBIDDEN, Dokter 403 FORBIDDEN, Petugas 200 OK dengan format meta dan data valid.
  - (e) Worker dengan endpoint subscription palsu -> mengembalikan status 410, subscription dinonaktifkan (`aktif = false`), `push_status` di notifikasi berubah menjadi `gagal`, log Pino tersamar (`fcm.googleapis.com/...14847044`).
- Pencarian kebocoran secret di bundle build:
  - `Get-ChildItem -Path .next/static -Recurse -File | Select-String -Pattern 'VAPID_PRIVATE_KEY'` -> **0 baris (bersih)**.
- Kompilasi TypeScript & Build:
  - `npx tsc --noEmit` -> lolos tanpa error.
  - `npm run build` -> lolos 37/37 halaman static & dynamic.

### 9.3 Hal yang Belum Teruji Langsung
- Pengiriman Web Push ke peramban nyata yang didukung push service Google FCM/Mozilla Autopush di perangkat fisik pengguna (memerlukan interaksi peramban nyata di luar sandbox pengujian).
- Simulasi pemutusan koneksi Redis di tengah-tengah runtime worker (namun mekanisme fail-open try/catch pada producer dan scanner telah terpasang).
- Pengujian siklus hidup deployment worker di platform pihak ketiga (Railway/Render).

---

## 10. Masa Berlaku Sesi & Mekanisme Refresh (14 November 2026)

### 10.1 Umur Cookie & Token
- **Cookie `sb-access-token`**:
  - `maxAge`: `expiresIn` (default 3600 detik / 1 jam).
  - Atribut: `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`.
- **Cookie `sb-refresh-token`**:
  - `maxAge`: 2.592.000 detik (30 hari).
  - Atribut: `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`.
- **Token Akses Supabase (JWT)**:
  - Umur masa berlaku: 3600 detik (1 jam).

### 10.2 Mekanisme Refresh Otomatis
- **Backend Route Handler (`POST /api/auth/refresh`)**:
  - Membaca `sb-refresh-token` dari cookie httpOnly request.
  - Menjalankan `supabase.auth.refreshSession({ refresh_token })`.
  - Memperbarui kedua cookie `sb-access-token` dan `sb-refresh-token` pada respons via `pasangCookieSesi`.
  - Mengembalikan status 200 dengan payload user dan expiresIn baru; bila token refresh tidak valid/kedaluwarsa, melempar HTTP 401.
- **Frontend Proaktif (`ClinicContext.tsx`)**:
  - Menjalankan interval latar belakang setiap 15 menit (`15 * 60 * 1000` ms) selama `currentUser` aktif dan tab berstatus `visible` untuk memanggil `apiRefreshSession()`, mencegah sesi mati saat sedang aktif digunakan.
- **Frontend Reaktif (`src/utils/api.ts`)**:
  - Pada fungsi `fetchApi`, jika permintaan ke endpoint terproteksi mengembalikan respons HTTP 401, otomatis mencoba memanggil `POST /api/auth/refresh` sebanyak 1 kali.
  - Bila refresh sukses, request asli segera diulang secara transparan.
  - Bila refresh gagal, menyiarkan event `auth:unauthorized` ke `ClinicContext.tsx` untuk menghentikan polling, mengosongkan state sesi, dan mengarahkan ke `/login` dengan notifikasi "Sesi berakhir, silakan masuk lagi".

---

## 11. Rincian dan Verifikasi Tahap 1D (per 14 November 2026)

Tahap 1D mencakup kelengkapan endpoint manajemen Admin dan operasional koreksi identitas pasien oleh Petugas:

1. **Butir 1 - CRUD `/api/admin/layanan`**:
   - Validasi skema Zod pada pembuatan dan pengubahan layanan (`namaLayanan`, `deskripsi`, `durasiMenit`, `biaya`, `aktif`).
   - Proteksi integritas relasi: layanan yang sedang dipakai oleh jadwal praktik tidak dihapus paksa, melainkan dinonaktifkan (`aktif = false`) untuk menjaga histori dan integritas constraint FK database.

2. **Butir 2 - Manajemen Pengguna `/api/admin/pengguna`**:
   - Daftar staf dengan pencarian teks dan pagination `{ data, meta }`.
   - Pembuatan staf baru (Petugas, Dokter, Admin) melalui Supabase Auth Admin API dengan `app_metadata.role` dan pembuatan profil di database.
   - Penegakan aturan **BR-11**: Admin tidak diperbolehkan menonaktifkan atau mengubah peran akunnya sendiri (ditolak 400 Bad Request).
   - Pengaktifan dan penonaktifan akun staf melalui Auth Admin API (`ban_duration: '876000h'` saat nonaktif).

3. **Butir 3 - Profil Klinik & Rekap Kunjungan**:
   - `GET/PUT /api/admin/profil-klinik`: Membaca dan memperbarui identitas profil klinik (nama, alamat, telepon, email, jam operasional) dengan validasi Zod.
   - `GET /api/admin/rekap`: Agregasi langsung database PostgreSQL (total kunjungan, perincian status kunjungan, breakdown per layanan, dan per dokter) serta daftar log kunjungan berfilter (tanggal awal, tanggal akhir, layanan, dokter) dilengkapi pagination.
   - Terhubung dengan fitur ekspor lembar kerja Excel di frontend.

4. **Butir 4 - Upload Foto Dokter `/api/admin/dokter/[id]/foto`**:
   - Batas ukuran file maksimum 2 MB.
   - Validasi ketat tipe MIME dan isi biner (magic bytes) pada buffer file: hanya menerima gambar asli JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), dan WebP (`RIFF....WEBP`). Berkas executable (`.exe`), dokumen PDF, skrip, dan file binary lain ditolak 400 Bad Request.
   - Nama file unik di-generate di server (`dokter-<uuid>-<timestamp>.<ext>`) untuk mencegah directory traversal dan collision.
   - Disimpan di Supabase Storage bucket `foto-dokter` dan path publik/relatif disimpan di kolom `dokter.foto_path`.

5. **Butir 5 - Koreksi Data Pasien `/api/petugas/pasien/[id]`**:
   - Otorisasi ketat: hanya peran `petugas` yang diizinkan (`requireRole(request, ["petugas"])`). Pasien atau admin ditolak 403 Forbidden.
   - Validasi Zod: nama tidak kosong, NIK 16 digit angka regex, tanggal lahir valid kalender masa lalu, jenis kelamin 'L' atau 'P'.
   - Penegakan integritas database: NIK duplikat ditangkap via constraint violation 23505 dan dikembalikan sebagai HTTP 409 Conflict.
   - Transaksi database: update tabel `pasien` dan otomatis sinkronisasi ke tabel `profiles` pasien jika pasien telah memiliki akun login.
   - Terhubung ke UI "Edit administrasi" pasien di `ClinicWorkspace.tsx`.

---

## 12. Rincian dan Verifikasi Tahap 1E (per 14 November 2026)

Tahap 1E mengokohkan ketahanan, standarisasi error handling, keamanan data, dan observabilitas backend Next.js:

1. **Butir 1 - Pembungkus Handler Global (`src/lib/api-handler.js`)**:
   - Fungsi pembungkus `apiHandler(handler)` membungkus seluruh 33 route handler di bawah `src/app/api/**/route.js`.
   - Mengintegrasikan requestId unik via `crypto.randomUUID()`, pelacakan durasi eksekusi, dan logging otomatis permintaan/tanggapan.
   - Menstandarkan penanganan exception via `handleApiError`:
     - `ZodError` -> HTTP 400/422 dengan struktur seragam `{ error: { code: 'VALIDATION_ERROR', message, fields } }`.
     - `HttpError` -> status HTTP dan kode error terpetakan sesuai kebutuhan domain.
     - Constraint violation database (PostgreSQL 23505 duplikat -> 409, 23503 relasi asing -> 400).
     - Error tak terduga (misal sintaks SQL salah, query crash) -> HTTP 500 generik `{ error: { code: 'INTERNAL', message: 'Terjadi kesalahan internal server' } }` tanpa membocorkan stack trace, query SQL, atau detail koneksi internal ke client.

2. **Butir 2 - Validasi Skema Zod Utang K7 (`src/lib/validasi/`)**:
   - Berkas skema terpisah per domain dengan pesan kesalahan dalam bahasa Indonesia:
     - `src/lib/validasi/auth.js`: `skemaLogin` (email wajib format valid, password minimal 6 karakter).
     - `src/lib/validasi/dokter.js`: `skemaDokterCreate` & `skemaDokterUpdate`.
     - `src/lib/validasi/jadwal.js`: `skemaJadwalCreate` & `skemaJadwalUpdate` (validasi jam selesai > jam mulai, hari 0-6, kuota positif).
     - `src/lib/validasi/profil.js`: `skemaProfilAdmin` & `skemaProfilPasien`.
   - Diintegrasikan ke endpoint `admin/dokter`, `admin/jadwal`, `auth/login`, dan `api/profil` tanpa mengubah kontrak respons API yang telah ada.

3. **Butir 3 - Rate Limiting Terdistribusi (`src/lib/rate-limit.js`)**:
   - Perlindungan anti-brute-force dan DDoS pada endpoint kritis:
     - `POST /api/auth/login`: 5 percobaan per menit per kombinasi IP + email.
     - `POST /api/auth/register`: 3 pendaftaran per jam per IP.
     - `POST /api/kunjungan`: 10 pendaftaran kunjungan per menit per IP.
     - `POST /api/push/langganan`: 15 permintaan per menit per IP.
   - Menggunakan Redis atomic sliding window (`ioredis`) bila `REDIS_URL` terkonfigurasi, atau in-memory map bila tidak.
   - Menerapkan arsitektur **fail-open** ber-log (Pino error log): jika koneksi Redis terputus atau salah konfigurasi, request bisnis tetap dilayani normal agar ketersediaan layanan tidak terganggu.
   - Mengembalikan HTTP 429 `{ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Terlalu banyak permintaan' } }` disertai header HTTP `Retry-After`.

4. **Butir 4 - Observabilitas & Logging Terstruktur Pino (`src/lib/logger.js`)**:
   - Logger Pino terkonfigurasi dengan redaksi otomatis (censoring) pada field sensitif: `password`, `token`, `cookie`, `authorization`, `DATABASE_URL`, `REDIS_URL`, `p256dh`, dan `auth`.
   - Seluruh 8 pemanggilan `console.log` / `console.error` lama di `src/app/api` telah dimigrasikan ke pemanggilan logger terstruktur (`git grep -n "console\." src/app/api` menghasilkan 0 baris).

5. **Butir 5 - Kualitas Kode, Audit Rahasia, & CI Pipeline**:
   - Konfigurasi ESLint non-interaktif `.eslintrc.json` berbasis `eslint-config-next` dan `eslint@8.57.1`. Perintah `npm run lint` berjalan otomatis dan lulus tanpa error interaktif.
   - Pengurangan tipe `any` pada `src/utils/api.ts` menjadi tipe eksplisit dan `unknown`.
   - Audit keamanan rahasia:
     - `git grep -n -i "service_role\|VAPID_PRIVATE\|DATABASE_URL" -- src`: Nol kebocoran rahasia di berkas client/browser; seluruh kredensial terisolasi di sisi server.
     - Pemeriksaan `.next/static`: Nol kebocoran variabel `VAPID_PRIVATE_KEY` di bundle aset statis browser.
   - Disediakan pipeline `.github/workflows/ci.yml` untuk memvalidasi linting, TypeScript (`tsc`), dan Next.js build pada setiap push/PR secara otomatis tanpa secret.

6. **Butir 6 - Dokumentasi Konfigurasi Memori Build `next.config.ts`**:
   - Konfigurasi `experimental: { workerThreads: false, cpus: 1 }` (yang berasal dari commit `c97d29e`) dipertahankan untuk menjamin stabilitas build lokal di lingkungan Windows.
   - *Alasan Teknis*: Lingkungan Windows pengembang lokal rentan mengalami lonjakan konsumsi memori (OOM), IPC deadlock antar-worker Next.js, dan transient file-locking pada direktori `.next` ketika worker threads dijalankan secara multi-threaded paralel. Menetapkan `workerThreads: false` dan `cpus: 1` membatasi proses kompilasi Next.js menjadi sekuensial pada thread utama Node.js, menjaga penggunaan RAM tetap stabil, mencegah heap exhaustion, dan memastikan perintah `npm run build` berhasil 100% secara deterministik.

---

### 12.1 Bukti Nyata Pengujian Tahap 1E & Pengujian Regresi (per 14 November 2026)

Pengujian dilakukan pada build produksi Next.js 15 (`npm run start` di port 3000):

1. **Hasil Eksekusi `scripts/uji-1e.ps1` (18 Kasus LULUS, 0 GAGAL)**:
   - **Rate Limiting 20 Login Salah Berturut-turut**:
     - Percobaan 1–5 menghasilkan HTTP 401 UNAUTHENTICATED.
     - Percobaan ke-6 pertama kali diblokir oleh rate limiter dengan HTTP 429 (TOO_MANY_REQUESTS) dan header `Retry-After: 58` detik.
     - Sebanyak 15 dari 20 percobaan berhasil diblokir secara konsisten.
   - **Galat DB Buatan (`GET /api/test-db-error`)**:
     - Merespons HTTP 500 generik `{ "error": { "code": "INTERNAL", "message": "Terjadi kesalahan server" } }`.
     - Bersih dari bocoran query SQL (`kolom_tidak_ada...`, `SELECT`, dsb.) maupun internal stack trace.
     - Setelah bukti diperoleh, rute sementara dihapus total dari repo dan build ulang diverifikasi menghasilkan HTTP 404 (Not Found).
   - **Validasi Zod Utang K7**:
     - Login tanpa email ditolak HTTP 400 dengan error code `VALIDATION_ERROR` dan field `email`: "Format email tidak valid".
     - `POST /api/admin/jadwal` dengan `jam_selesai <= jam_mulai` ditolak HTTP 400 dengan field `jamSelesai`: "Jam selesai harus setelah jam mulai".
   - **Observabilitas Logger Pino & Redaksi Sensitif**:
     - Log terstruktur satu request mencatat `requestId`, `status`, dan `durasi` tanpa mencetak nilai `password`, `token`, `cookie`, maupun string koneksi `DATABASE_URL` (tersensor menjadi `[REDACTED]`).
   - **Ketahanan Fail-Open Redis**:
     - Saat koneksi Redis mengalami error/offline, mekanisme rate limiting otomatis beralih ke fail-open dengan pencatatan peringatan level `warn` pada Pino logger dan melayani request bisnis tanpa crash.

2. **Pengujian Regresi Keseluruhan**:
   - `scripts/uji-api.ps1` : **LULUS** (100% skenario inti Tahap 1A lolos: auth, transaksi kuota, nomor antrean unik, isolasi peran, transisi status).
   - `scripts/uji-verifikasi-1c.ps1` : **LULUS** (14 skenario lolos: pembatasan akses data, otorisasi peran, proteksi ID orang lain).
   - `scripts/uji-1d.ps1` : **LULUS** (40 skenario lolos: CRUD admin layanan, manajemen staf BR-11, rekap agregasi DB, validasi biner magic bytes foto dokter, koreksi pasien oleh petugas).
   - `scripts/uji-1e.ps1` : **LULUS** (18 skenario hardening lolos).

3. **Verifikasi Statis & Keterbatasan yang Diketahui**:
   - `npx tsc --noEmit` : **LULUS** (0 kesalahan tipe TypeScript).
   - `npm run lint` : **LULUS** (exit code 0).
   - *Keterbatasan yang Diketahui (Known Limitations)*: Terdapat 6 peringatan `react-hooks/exhaustive-deps` pada `ClinicContext.tsx` serta beberapa komponen antarmuka yang dipertahankan apa adanya demi menjaga stabilitas fungsional komponen dan menghindari siklus pemanggilan ulang hook yang tidak diinginkan.

4. **Pemeriksaan Kode Penentuan IP Klien**:
   - Fungsi `ambilClientIp(request)` pada `src/lib/rate-limit.js` (baris 9–19) membaca header `x-forwarded-for` secara prioritas (`xff.split(",")[0].trim()`), dengan fallback bertingkat ke `x-real-ip`, `cf-connecting-ip`, dan default `"127.0.0.1"`.

---

## 13. Pelaksanaan Tahap 5 BAGIAN A: Seed Idempoten & Master Test Suite API (per 14 November 2026)

### 13.1 Butir 1: Seed Database Idempoten (`scripts/seed.mjs` & `npm run db:seed`)
- **Fitur Guard Produksi**: Wajib menyertakan environment variable `SEED_ALLOW=1`. Jika variabel tidak ada atau bernilai lain, eksekusi dibatalkan dengan kode keluar 1 demi mencegah ketidaksengajaan di server produksi.
- **Pembersihan Data Terkelola**: Script idempoten membersihkan baris-baris terkelola (kunjungan demo, pemeriksaan, tindakan medis, push subscriptions uji, dan notifikasi terkait) tanpa menghapus data master pasien/dokter asli di luar cakupan demo.
- **Penanganan Duplikat Dokter**: Secara otomatis mendeteksi dan menggabungkan duplikat dr. Reyhan Adhitama via script (`scripts/seed.mjs`) tanpa memerlukan intervensi manual di SQL Editor Supabase.
- **Akun Uji Terautentikasi (Auth Admin & `app_metadata.role`)**:
  - `admin.klinik@gmail.com` (role: `admin`)
  - `rina.petugas@gmail.com` (role: `petugas`)
  - `dokter.reyhan@gmail.com` (role: `dokter`)
  - `nadira.kirana@gmail.com` (role: `dokter`)
  - `ani.wulandari@gmail.com` (role: `pasien`, RM-000001)
  - `bagas.saputra@gmail.com` (role: `pasien`, RM-000002)
- **Komposisi Data Realita Sesuai PRD §6.3**:
  - Pasien: 39 baris (termasuk 2 pasien berakun Supabase Auth dan 4 pasien walk-in tanpa akun).
  - Dokter: 5 baris (dr. Reyhan, dr. Nadira, dr. Raka, dr. Annisa, dr. Alea).
  - Layanan: 6 layanan terdaftar lengkap dengan relasi `dokter_layanan`.
  - Jadwal Praktik: 35 slot jadwal; mencakup 1 jadwal berkuota 3 terisi 2 (tersisa 1) dan 1 jadwal berkuota 2 terisi 2 (penuh).
  - Kunjungan: 12 kunjungan terdaftar.
  - Antrean: 12 antrean dengan komposisi persis tabel PRD §6.3:
    * `menunggu`: 3
    * `dipanggil`: 1
    * `diperiksa`: 1
    * `selesai`: 5
    * `dilewati`: 1
    * `batal`: 1
  - Rekam Medis & Tindakan: 5 pemeriksaan dan 5 tindakan medis dengan tanda vital fisiologis valid (BR-18).
  - Push Subscription & Notifikasi: Contoh langganan uji dan notifikasi status menunggu, berhasil, dan gagal (outbox pattern).

### 13.2 Butir 3: Skrip SQL Verifikasi Integritas Constraint Database (`scripts/verifikasi-db.sql`)
- Skrip SQL dibungkus transaksi `BEGIN ... ROLLBACK` penuh untuk menguji ketahanan lapisan validasi ketiga database tanpa mengotori data.
- **Hasil Pengujian Constraint (10/10 Lolos)**:
  - `BUKTI 1A LULUS`: NIK 15 digit ditolak CHECK constraint `pasien_nik_check`.
  - `BUKTI 1B LULUS`: NIK dengan huruf ditolak CHECK constraint `pasien_nik_check`.
  - `BUKTI 2 LULUS`: No SIP duplikat ditolak UNIQUE constraint `dokter_no_sip_key`.
  - `BUKTI 3A LULUS`: Jam selesai <= jam mulai ditolak CHECK constraint `ck_jadwal_jam`.
  - `BUKTI 3B LULUS`: Kuota <= 0 ditolak CHECK constraint `jadwal_praktik_kuota_check`.
  - `BUKTI 4A LULUS`: Status antrean dilewati/batal tanpa alasan ditolak CHECK constraint `ck_antrean_alasan`.
  - `BUKTI 4B LULUS`: Nomor antrean <= 0 ditolak CHECK constraint `antrean_nomor_antrean_check`.
  - `BUKTI 5A LULUS`: Tanda vital sistolik di bawah batas fisiologis ditolak constraint `fn_valid_tanda_vital` (BR-18).
  - `BUKTI 5B LULUS`: Suhu tubuh di atas 45°C ditolak constraint `fn_valid_tanda_vital` (BR-18).
  - `BUKTI 6 LULUS`: Pendaftaran aktif ganda pada jadwal & tanggal sama ditolak UNIQUE PARTIAL INDEX `uq_kunjungan_aktif` (BR-02).
- **Hasil Query Rekapitulasi Antrean**:
  - Seluruh status (`menunggu`, `dipanggil`, `diperiksa`, `selesai`, `dilewati`, `batal`) terverifikasi `COCOK (LULUS)` terhadap target PRD §6.3.

### 13.3 Butir 2: Master Test Suite Otomatis API (`scripts/uji-suite.ps1`)
- Menguji alur utama PRD §5 (Langkah 2–10) dan seluruh pengujian keamanan tambahan di sisi API:
  - **Login 6 Peran**: Pasien 1, Pasien 2, Petugas, Dokter 1, Dokter 2, Admin (Semua LULUS).
  - **Alur PRD §5**:
    - Langkah 2: Pendaftaran Pasien (LULUS)
    - Langkah 3: Dasbor Pasien & Status Menunggu (LULUS)
    - Langkah 4: Petugas Check-in menjadi Hadir (BR-05) (LULUS)
    - Langkah 5: Petugas Memanggil Antrean (LULUS)
    - Langkah 6: Dokter Mulai Periksa (BR-06, K14) (LULUS)
    - Langkah 7a: Dokter Simpan Rekam Medis & Tindakan (BR-18) (LULUS)
    - Langkah 7b: Dokter Selesaikan Kunjungan (BR-07, BR-09) (LULUS)
    - Langkah 8: Isolasi Riwayat Medis Pribadi (Pasien lain terblokir) (LULUS)
    - Langkah 9: Rekapitulasi Konsistensi Data Admin (LULUS)
    - Langkah 10: Pekerjaan & Outbox Notifikasi (LULUS)
  - **Pengujian Tambahan Keamanan & Integritas**:
    - Pendaftaran Ganda Ditolak 409 (BR-02) (LULUS)
    - Kirim Ulang Form Anti-Ganda Idempoten (LULUS)
    - Pendaftaran Jadwal Kuota Penuh Ditolak 409 (BR-01) (LULUS)
    - Akses Endpoint Terlindung Tanpa Login Ditolak 401 (LULUS)
    - Manipulasi / Akses ID Pasien Lain Ditolak 403/404 (LULUS)
    - Perubahan Role Pasien Sendiri Lewat Profil Ditolak 400 (LULUS)
    - Direct Request Malformed Tanpa Frontend Ditolak 400 Zod (LULUS)
    - Masukan Data Ekstrem / Tidak Valid Ditolak 400 (NIK & Vital) (LULUS)
    - Registrasi & Penanganan Push Subscription VAPID (LULUS)
- **Ringkasan Master Suite**: **25 dari 25 Kasus LULUS (100% PASSED, 0 FAILED)**.

---

## 14. Pelaksanaan Tahap 5 BAGIAN B: Perbaikan Seed & Dokumentasi Komprehensif (per 14 November 2026)

### 14.1 Butir 0: Perbaikan Idempotensi Sejati Notifikasi & Push Subscription
- **Bungkam Trigger Transaksi Seed**: Mengaktifkan `SET LOCAL session_replication_role = 'replica'` selama transaksi seed berjalan agar mutasi kunjungan/antrean demo tidak memicu firing trigger `notif_antrean_baru` dan `notif_antrean_status` yang menyebabkan penumpukan baris notifikasi liar antar eksekusi.
- **Kunci Deterministik Notifikasi Seed**: Baris notifikasi contoh seed menggunakan UUID tetap (`c0000000-0000-0000-0000-000000000001` s.d. `...004`), dengan penghapusan terarah (`id = ANY(...) OR pesan LIKE '%[SEED]%'`).
- **Komposisi Notifikasi Seed**: 2 berstatus `menunggu`, 1 berstatus `berhasil`, dan 1 berstatus `gagal` (sesuai arahan Tahap 5B).
- **Isolasi Mock Push Subscription**: Langganan simulasi seed menggunakan domain penanda `https://push.example.com/mock-fcm/...` dan disetel `aktif = false` (`user_agent = 'MOCK_SEED_SIMULATION (Endpoint Simulasi Demo - Tidak Aktif)'`) agar background worker BullMQ tidak salah mengirim notifikasi ke server eksternal saat membaca baris tersebut.
- **Pembuktian Eksekusi Seed Dua Kali Berturut-turut**:
  - Run 1: Total notifikasi = 134 baris.
  - Run 2: Total notifikasi = 134 baris (100% identik dan konstan).
- **Laporan Faktual Baris Pasien (39) & Jadwal Praktik (35)**:
  - *Pasien (39 baris)*: Terdiri dari 5 pasien master awal (`RM-000001` s.d. `RM-000005`) ditambah 34 pasien yang didaftarkan secara sah melalui alur pendaftaran walk-in loket petugas (`POST /api/pasien`) dan skrip pengujian API sebelumnya. Seluruh baris dipertahankan dan tidak dihapus demi menjaga integritas data riwayat.
  - *Jadwal Praktik (35 baris)*: Bukan merupakan sisa pengujian kotor, melainkan konfigurasi jadwal reguler klinik lengkap untuk 5 dokter selama 7 hari dalam seminggu (5 dokter × 7 hari [Minggu sampai Sabtu, hari 0–6] = 35 baris jadwal praktik) dengan kuota terstandar.

### 14.2 Butir 1: Penyusunan Panduan Repositori (`README.md`)
- Mendokumentasikan prasyarat sistem (Node.js 20+, npm 10+, PostgreSQL, Redis).
- Panduan instalasi dari `git clone`, tabel environment variables (hanya nama variabel, tanpa membocorkan secret).
- Prosedur migrasi (`npm run db:migrate`) dan seed (`npm run db:seed` dengan guard `SEED_ALLOW=1`).
- Perintah menjalankan server web Next.js (`npm run dev` / `npm run start`) dan background worker (`npm run worker`).
- Prosedur pembuatan kunci Web Push VAPID (`npx web-push generate-vapid-keys`).
- Tiga opsi konfigurasi Redis (Docker, Memurai/Windows Native, Upstash Serverless) beserta arsitektur *fail-open*.
- Tabel akun uji coba 6 peran (Admin, Petugas, Dokter 1, Dokter 2, Pasien 1, Pasien 2) beserta kata sandi demo.
- Ringkasan deployment multi-platform (Vercel, Railway/Render, Supabase, Upstash).

### 14.3 Butir 2: Dokumen Arsitektur & Keputusan Desain (`docs/ARSITEKTUR.md`)
- Pemisahan lapisan arsitektur (Three-tier Architecture: Peramban, Route Handlers Next.js, PostgreSQL).
- Penjelasan transparan keputusan RLS: string koneksi `DATABASE_URL` menggunakan role `postgres` (melewati RLS secara bawaan) untuk menjamin keandalan transaksi atomik multi-tabel (`FOR UPDATE`), dengan otorisasi ketat di lapisan server dan pembuktian RLS via helper `denganRls`.
- Pola Outbox Web Push: transaksi bisnis terpisah dari pengiriman push, pemindai periodik 30 detik, dan kebijakan retry exponential backoff.
- Keamanan sesi: Cookie HttpOnly, SameSite=Lax, proteksi CSRF Origin header, dan middleware redirect 307.
- Keterbatasan jujur: Pembacaan IP dari `x-forwarded-for`, 6 warning `react-hooks/exhaustive-deps` yang dipertahankan, dan pengujian push yang belum mencakup seluruh variasi perangkat fisik.

### 14.4 Butir 3: Diagram Hubungan Entitas (`docs/ERD.md`)
- Diagram Mermaid `erDiagram` lengkap yang diekstrak langsung dan divalidasi terhadap `src/db/schema.ts` (14 entitas: `auth.users`, `profiles`, `pasien`, `dokter`, `layanan`, `dokter_layanan`, `jadwal_praktik`, `kunjungan`, `antrean`, `pemeriksaan`, `tindakan`, `notifikasi`, `push_subscriptions`, `profil_klinik`).
- Tabel rincian batasan integritas database (CHECK, UNIQUE, Exclusion, Partial Index).

### 14.5 Butir 4: Dokumen Pembuktian Sembilan Butir Evaluasi PRD §11 (`docs/BUKTI_VERIFIKASI.md`)
- Mendokumentasikan sembilan butir bukti evaluasi PRD §11 dengan perintah eksekusi dan keluaran nyata:
  1. Validasi frontend (NIK 16 digit, nomor telepon, tanggal lahir, proteksi tombol submit).
  2. Validasi backend Zod lewat request langsung (400 `VALIDATION_ERROR` dengan pemetaan fields).
  3. Constraint database (10 notice PostgreSQL lulus dari `scripts/verifikasi-db.sql`).
  4. Autentikasi, otorisasi, & isolasi kepemilikan data (401 unauthenticated, 403 unauthorized).
  5. Operasi CRUD persisten pada seluruh entitas transaksi klinik.
  6. Migrasi skema (12 migrasi Drizzle diaplikasikan berurutan).
  7. Web Push notification via BullMQ worker.
  8. Penanganan kegagalan subscription kadaluarsa (HTTP 410 Gone dinonaktifkan otomatis).
  9. Konsistensi rekapitulasi data admin dan penanganan galat global (500 tanpa bocoran SQL).

### 14.6 Butir 5: Daftar Fitur, Keterbatasan, & Panduan Uji Manual (`docs/FITUR.md`)
- Rincian fitur selesai per peran (Publik, Pasien, Petugas, Dokter, Admin, Infrastruktur).
- Panduan checklist pengujian manual untuk evaluator/pengguna:
  - Checklist responsivitas mobile pada viewport 375 px (iPhone SE).
  - Checklist aksesibilitas navigasi keyboard (Focus Ring, Tab/Enter/Escape, Dialog Modal).

### 14.7 Verifikasi Statis & Integritas Dokumen
- `npx tsc --noEmit` : **LULUS** (0 kesalahan tipe).
- `npm run lint` : **LULUS** (exit code 0).
- `Test-Path` seluruh berkas dokumentasi yang direferensikan : **12/12 BERKAS TERSEDIA (100% TRUE)**.

---

## 15. Pelaksanaan Tahap 6 BAGIAN A: Kesiapan Deployment Multi-Platform (per 14 November 2026)

### 15.1 Butir 1: Skrip Worker Produksi Cloud (`package.json` & `worker/index.mjs`)
- Menambahkan skrip `"worker:prod": "node worker/index.mjs"` pada `package.json` yang membaca environment variables langsung dari container platform hosting (Railway/Render) tanpa bergantung pada file lokal `--env-file=.env.local`.
- Skrip lokal `"worker": "node --env-file=.env.local worker/index.mjs"` tetap dipertahankan untuk pengujian lokal pengembang.
- Meningkatkan ketegasan validasi environment pada `worker/index.mjs`: mencantumkan nama variabel yang kurang (`DATABASE_URL`, `REDIS_URL`, `VAPID_KEYS`) dan instruksi penanganannya sebelum keluar secara fatal.

### 15.2 Butir 2: Hasil Pemeriksaan Kesiapan Arsitektur Produksi (2a s.d. 2f)
- **2a. Pemeriksaan Origin & Reverse Proxy (`src/middleware.ts:28-32`)**:
  - *Sebelumnya*: Memeriksa `originHost !== host` langsung dari header `host`.
  - *Perbaikan*: Menambahkan pembacaan header `x-forwarded-host` (`const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host")`) dengan normalisasi koma/port. Perubahan ini menjamin request mutasi (POST/PUT/PATCH/DELETE) di domain `*.vercel.app` via HTTPS tidak mengalami penolakan palsu 403 Forbidden akibat rewrite host proxy internal.
- **2b. Keamanan Cookie Sesi (`src/lib/auth.js:40-48`)**:
  - `httpOnly: true` (terpasang).
  - `secure: process.env.NODE_ENV === "production"` (otomatis bernilai `true` di lingkungan Vercel production).
  - `sameSite: "lax"`, `path: "/"`.
  - Tidak terdapat hardcoded atribut domain `localhost`, sehingga browser mengikat cookie secara otomatis ke host deployment.
- **2c. Sifat Inlining Kunci Publik VAPID**:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` disubstitusikan saat build Next.js. Wajib diisi pada Vercel Dashboard sebelum build/deploy dijalankan.
- **2d. Ketahanan Koneksi Redis Serverless (`src/lib/push-queue.js:28-34` & `src/lib/rate-limit.js`)**:
  - Ditambahkan opsi `enableOfflineQueue: false`, `lazyConnect: true`, dan `retryStrategy: () => null`. Menjamin jika Redis offline/lambat, request pendaftaran kunjungan langsung melanjutkan (fail-open) tanpa menahan serverless function Vercel.
- **2e. Optimasi BullMQ Worker untuk Kuota Upstash (`worker/index.mjs:339-346`)**:
  - Dikonfigurasikan `concurrency: 2`, `drainDelay: 10000` (jeda 10 detik saat antrean kosong), dan `stalledInterval: 60000` (cek stalled job tiap 60 detik). Mencegah habisnya kuota harian 10.000 perintah pada Upstash Free Tier.
- **2f. Database Connection Pooler Supabase**:
  - *Vercel*: Menggunakan Transaction Pooler (Port **6543** dengan host `pooler.supabase.com`).
  - *Worker*: Menggunakan Session Pooler (Port **5432** dengan host `pooler.supabase.com`), mencegah kegagalan `ENOTFOUND` IPv6 pada platform container yang belum mendukung rute IPv6 keluar.

### 15.3 Butir 3: Pembersihan Outbox & Langganan Mock Sebelum Deploy (`scripts/bersihkan-outbox.mjs`)
- Dijalankan dengan guard `SEED_ALLOW=1`.
- **Hasil Dry-Run**:
  - Target outbox kedaluwarsa non-seed (> 1 hari): 0 baris.
  - Sisa uji non-seed hari ini: 63 baris.
  - Target subscription mock aktif: 1 baris (`uji-suite-temp-410`).
- **Hasil Eksekusi Real**:
  - Menandai 63 notifikasi sisa uji menjadi `push_status = 'gagal'` dengan pesan `Dibersihkan sebelum deploy (data uji lama)`.
  - Menonaktifkan 1 langganan push mock/uji menjadi `aktif = false`.
  - Rekap `push_status` sesudah pembersihan:
    * `menunggu`: tepat 2 baris (hanya milik akun seed `c0000000-0000-0000-0000-000000000001` dan `...0002`).
    * `berhasil`: 1 baris (milik seed).
    * `gagal`: 131 baris (termasuk data lama & uji yang telah dibersihkan secara aman tanpa `DELETE`).
  - Daftar langganan aktif tersisa 1 (peramban Chrome pengguna asli).

### 15.4 Butir 4: Panduan Deployment Bertahap (`docs/DEPLOYMENT.md`)
- Panduan lengkap deployment terdistribusi: Supabase (migrasi, seed, bucket foto-dokter), Upstash Redis (`rediss://`), Vercel (region Singapore `sin1`), dan Railway/Render (`npm run worker:prod`).
- Tabel environment variables per platform dengan penanda rahasia `[SENSITIVE]`.
- Panduan pemecahan masalah (troubleshooting) untuk 5 kendala utama: Pooler 6543 vs 5432, Direct IPv6, CSRF Origin 403, Web Push HTTPS, dan penggantian VAPID key.

### 15.5 Butir 5: Skrip Uji Verifikasi Produksi (`scripts/uji-deploy.ps1`)
- Menerima parameter `-BaseUrl` (dan `-JedaMs`).
- Menguji keamanan tanpa login:
  - `GET /api/health` -> HTTP 200 `{ status: "ok", db: "connected" }`.
  - `GET /api/test-db-error` -> HTTP 404 (membuktikan rute uji telah tereliminasi dari build produksi).
  - `/admin` tanpa sesi -> HTTP 307 Redirect ke `/login`.
  - Pemeriksaan `Set-Cookie`: bendera `HttpOnly`, `SameSite=Lax`, dan `Secure` (saat HTTPS).
- Memanggil master test suite `scripts/uji-suite.ps1` terhadap URL deployment dengan jeda antar-request.

### 15.6 Butir 6: Lembar Kerja Checklist Uji Manual Alur 10 Langkah (`docs/UJI_DEPLOY.md`)
- Format checklist pengujian manual alur 10 langkah PRD §5 (Langkah 1–10) dengan kolom status dan catatan penguji.
- Tabel checklist pengujian ketahanan khusus: Web Push lintas 2 browser terpisah (Chrome & Edge), interaksi klik notifikasi (deep linking), worker dihentikan lalu dinyalakan kembali (stop/start resilience), dan pemutusan koneksi Redis (fail-open).
- Status Tahap 6 Bagian B: Menunggu eksekusi deployment ke Vercel dan Railway/Render oleh pengguna.

---

## 16. Matriks Kepatuhan Technical Requirements & 17 Ketentuan Umum Dosen (per 18 November 2026)

### 16.1 Tabel Kepatuhan 17 Ketentuan Umum Dosen

| No | Ketentuan | Status | Bukti Berkas:Baris / Keluaran Perintah | Pekerjaan Tersisa |
|---|---|---|---|---|
| 1 | **Teknologi**: Next.js, React, JavaScript, PostgreSQL, Git; riwayat Git wajar | **SELESAI** | `package.json:20-33` (Next.js 15.0.3, React 19, TS/JS App Router, Drizzle ORM + `pg`), `git log --oneline` (puluhan commit terstruktur dan bertahap per fitur) | Tidak ada |
| 2 | **Penyimpanan Data Persisten**: Data tersimpan di database persisten, bukan memori/`localStorage` | **SELESAI** | PostgreSQL Supabase skema `public` (14 tabel terkelola), seluruh pembacaan/penulisan via Drizzle ORM di Route Handlers (`src/app/api/**/route.js`). Terbukti via `scripts/uji-rls.mjs` data tersimpan nyata | Tidak ada |
| 3 | **Aset di Object Storage**: Foto dokter di Supabase Storage, tabel simpan path | **SELESAI** | Bucket publik `foto-dokter` di Supabase Storage. Handler upload: `src/app/api/admin/dokter/[id]/foto/route.js:52-78` (validasi magic bytes JPEG/PNG/WebP, upload via Service Role). Kolom `dokter.foto_path` | Tidak ada |
| 4 | **Proteksi Berkas Privat**: Berkas privat tidak dapat diakses tanpa izin | **SELESAI** | Bucket `foto-dokter` hanya membaca publik. Berkas rekam medis dan data pasien diisolasi melalui session cookie `requireRole` server-side dan RLS PostgreSQL (`pemeriksaan` & `tindakan` hanya dapat dibaca dokter/pasien pemilik). Lampiran privat P1 sesuai K15 | Tidak ada |
| 5 | **Proteksi Dashboard Auth**: Memerlukan sesi Supabase Auth valid; tanpa sesi diarahkan ke login | **SELESAI** | `src/middleware.ts:18-35` (pemeriksaan cookie `sb-access-token` pada rute dashboard, redirect HTTP 307 ke `/login?redirect=...`). Teruji via `scripts/uji-deploy.ps1` baris 28-35 | Tidak ada |
| 6 | **Otorisasi Server + RLS**: Otorisasi per peran di server + Row Level Security | **SELESAI** | Server: `src/lib/auth.js:14-38` (`requireRole`), `src/lib/domain/transisi.js:55-89`. Database: 14 tabel dengan RLS aktif (`relrowsecurity = true`) & 40 policy (`pg_policies`). Terbukti via `scripts/uji-rls.mjs` isolasi baris antar pasien & dokter bekerja 100% | Tidak ada |
| 7 | **Keamanan Kredensial & Secret**: Tidak ada secret di repo/browser; `.env.example` tersedia | **SELESAI** | `.env.example` lengkap tanpa nilai rahasia. `.gitignore:26-29` mengecualikan `.env*.local`. Bundling Next.js bersih dari secret (`git grep SERVICE_ROLE src/components src/context` = 0). Pino logger meredaksi password/token/key (`src/lib/logger.js:12-25`) | Tidak ada |
| 8 | **Integritas Data**: Constraint database & transaksi | **SELESAI** | Transaksi atomik dengan row lock: `src/app/api/kunjungan/route.js:105-165` (FOR UPDATE kunci jadwal, cek kuota & no antrean) & `src/lib/domain/transisi.js:42-120`. Constraint DB: NIK 16 digit, rentang tanda vital (BR-18), partial unique index pendaftaran aktif. Teruji di `scripts/verifikasi-db.sql` | Tidak ada |
| 9 | **Validasi Masukan Tiga Lapis**: Frontend, backend, database | **SELESAI** | Lapis 1 (Frontend HTML5, regex, validasi form, disabled state). Lapis 2 (Backend Zod `safeParse` ketat di SEMUA endpoint API, respons seragam 400 `VALIDATION_ERROR`). Lapis 3 (Database CHECK/UNIQUE/FK constraints) | Tidak ada |
| 10 | **Konsistensi Angka Dashboard/Rekap**: Sinkron dengan data database riil | **SELESAI** | `GET /api/admin/rekap/route.js:30-80` melakukan agregasi langsung via SQL (`count`, `sum`) ke tabel `kunjungan` dan `antrean`. Polling 5 detik di frontend memuat status langsung dari API backend. Verifikasi via `scripts/uji-1d.mjs` 100% sinkron | Tidak ada |
| 11 | **Antarmuka Responsif & Aksesibel**: Responsif dan dapat dipakai keyboard | **SELESAI** | Grid/flexbox CSS responsif di `src/app/globals.css`. Elemen form semantik (`<button>`, `<input>`, `<dialog>`), atribut ARIA, navigasi tombol Tab dan penutup Escape pada modal | Pengujian manual lintas peramban/perangkat fisik |
| 12 | **Umpan Balik Antarmuka Jelas**: Loading, kosong, berhasil, gagal; tombol nonaktif saat submit | **SELESAI** | State `isSubmitting` menonaktifkan tombol submit form. Skeleton loading `ws-skeleton-grid` saat inisialisasi sesi (`ClinicWorkspace.tsx:86-92`). State antrean kosong (`EmptyState`). Notifikasi toast navy/putih untuk sukses/gagal | Tidak ada |
| 13 | **Pencarian, Filter & Pagination**: Daftar punya fitur pencarian/filter dan pembagian halaman | **SELESAI** | Pencarian teks `q`, filter status/spesialisasi/hari, dan pagination `limit` + `offset` pada `GET /api/admin/dokter`, `GET /api/admin/pengguna`, `GET /api/admin/layanan`, `GET /api/riwayat` | Tidak ada |
| 14 | **Kesiapan Deployment Produksi**: Aplikasi ter-deploy dan berfungsi tanpa server lokal | **SEBAGIAN** | Bagian A SELESAI: Kesiapan kode, worker prod, sanitasi host middleware, Upstash Redis fail-open, dokumen panduan `docs/DEPLOYMENT.md`, skrip uji produksi `scripts/uji-deploy.ps1`. Bagian B MENUNGGU: Eksekusi deploy ke Vercel & Railway/Render oleh mahasiswa | Deploy ke Vercel & Railway/Render dan isi environment variables |
| 15 | **Kelengkapan Data Dummy**: Minimal 5 pasien, 5 jadwal, 5 kunjungan | **SELESAI** | `scripts/seed.mjs` (`SEED_ALLOW=1 npm run db:seed`) mengisi 39 pasien (2 berakun Auth + 4 walk-in), 5 dokter, 6 layanan, 35 slot jadwal praktik, dan 12 kunjungan. Melampaui ketentuan minimal | Tidak ada |
| 16 | **Variasi Status Data Dummy**: Komposisi bervariasi sesuai PRD §6.3 | **SELESAI** | 12 kunjungan & antrean dengan komposisi lengkap: `menunggu` (3), `dipanggil` (1), `diperiksa` (1), `selesai` (5), `dilewati` (1), `batal` (1). 5 rekam medis & 5 tindakan medis dengan tanda vital fisiologis valid | Tidak ada |
| 17 | **Penyederhanaan Pembayaran**: Cukup pencatatan status tanpa payment gateway | **SELESAI** | Ruang lingkup sesuai PRD §1 & K17: Alur administrasi mencakup pencatatan status kehadiran, pemeriksaan, dan penyelesaian tanpa integrasi gateway pihak ketiga | Tidak ada |

---

### 16.2 Tabel Kepatuhan Technical Requirements

| No | Persyaratan Teknis | Status | Bukti Berkas:Baris / Keluaran Perintah | Pekerjaan Tersisa |
|---|---|---|---|---|
| T1 | **Validasi Tiga Lapis Independen** | **SELESAI** | Lapis 1: Frontend `src/components/ClinicWorkspace.tsx`; Lapis 2: Zod di semua endpoint (`src/lib/validasi/*.js`); Lapis 3: SQL constraints di `db/migrations/`. Teruji via `scripts/verifikasi-db.sql` | Tidak ada |
| T2 | **Dilarang PostgREST / Supabase Client di Browser** | **SELESAI** | Seluruh pemanggilan `supabase.from`, `supabase.auth`, `supabase.channel` di frontend telah dieliminasi (0 pemanggilan). Akses database server 100% via Drizzle ORM + `pg` | Tidak ada |
| T3 | **Migrasi Database Dapat Membangun Ulang DB** | **SELESAI** | 13 berkas migrasi berurutan (`01` s.d. `14`) di `db/migrations/` dieksekusi idempoten via `scripts/migrate.mjs` (`npm run db:migrate`) | Tidak ada |
| T4 | **Transaksi & Proteksi Race Condition** | **SELESAI** | `db.transaction()` dengan `SELECT ... FOR UPDATE` pada jadwal saat pendaftaran (`src/app/api/kunjungan/route.js:105-165`) dan antrean (`src/lib/domain/transisi.js:42-120`) | Tidak ada |
| T5 | **Pagination & Pencegahan Masalah N+1** | **SELESAI** | Agregasi grouped query di memori JS untuk relasi `dokter_layanan` (`src/app/api/admin/dokter/route.js:34`), pagination `limit`/`offset` pada endpoint rekap, dokter, pengguna, riwayat | Tidak ada |
| T6 | **Hak Akses di Server (Zero-Trust Client)** | **SELESAI** | Server memvalidasi JWT cookie via `requireRole()` (`src/lib/auth.js:25-38`). ID pasien/dokter diambil dari database `profiles`, bukan dari body/parameter URL client | Tidak ada |
| T7 | **Rate Limiting Perlindungan Serangan Brute-Force** | **SELESAI** | `src/lib/rate-limit.js` (Redis token bucket + fallback memori, fail-open) aktif pada login (5/mnt), login-cepat (10/mnt), registrasi (3/mnt), kunjungan (10/mnt), push (20/mnt) | Tidak ada |
| T8 | **Web Push Notification Nyata & Background Worker** | **SELESAI** | Service Worker `public/sw.js`, VAPID payload signing (`web-push`), worker terpisah BullMQ `worker/index.mjs`, retry max 3 eksponensial, outbox pattern di tabel `notifikasi`. Transaksi bisnis tidak terpengaruh jika Redis mati | Tidak ada |
| T9 | **Observabilitas Logger Terstruktur (Pino)** | **SELESAI** | `src/lib/logger.js` mengonfigurasi Pino dengan redaksi otomatis terhadap kunci rahasia (`password`, `token`, `cookie`, `DATABASE_URL`, `REDIS_URL`, `p256dh`, `auth`). Format JSON standar ISO | Tidak ada |
| T10 | **Dokumentasi Lengkap Proyek** | **SELESAI** | `README.md`, `docs/ARSITEKTUR.md`, `docs/ERD.md`, `docs/FITUR.md`, `docs/BUKTI_VERIFIKASI.md`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `.env.example` | Tidak ada |
| T11 | **Fitur Login Cepat Demo Evaluator** | **SELESAI** | `src/app/api/auth/login-cepat/route.js` (guard `DEMO_LOGIN_ENABLED="1"`, rate limit 10/mnt, Zod validasi, cookie HttpOnly). UI modal pemilih peran di halaman login. Teruji via `scripts/uji-bukti-login-cepat.mjs` (4/4 peran PASS) | Tidak ada |
| T12 | **Pembuktian RLS Lapisan Database (Transaksional)** | **SELESAI** | Skrip `scripts/uji-rls.mjs` membuktikan 14 tabel public berstatus `relrowsecurity = true` dengan 40 policy aktif. Isolasi data terverifikasi: Pasien A hanya melihat 2 kunjungan & 1 rekam medis miliknya; Pasien B hanya melihat miliknya; Dokter Reyhan hanya melihat kunjungan praktiknya; Anon ditolak total (0 baris) | Tidak ada |

---

### 16.3 Hasil Nyata Audit RLS Lapisan Database (`scripts/uji-rls.mjs`)

Dijalankan dalam satu transaksi database (`BEGIN ... SET LOCAL ROLE ... ROLLBACK`):

```text
=== HASIL AUDIT BUKTI RLS LAPISAN DATABASE ===

┌─────────┬────────────────────┬──────────────────────┬──────────────────────────────────────┬───────┐
│ (index) │ peran              │ tabel                │ terlihat                             │ total │
├─────────┼────────────────────┼──────────────────────┼──────────────────────────────────────┼───────┤
│ 0       │ 'pasien A (Ani)'   │ 'kunjungan'          │ 2                                    │ 12    │
│ 1       │ 'pasien A (Ani)'   │ 'pasien'             │ 1                                    │ 39    │
│ 2       │ 'pasien A (Ani)'   │ 'pemeriksaan'        │ 1                                    │ 5     │
│ 3       │ 'pasien A (Ani)'   │ 'notifikasi'         │ 49                                   │ 139   │
│ 4       │ 'pasien A (Ani)'   │ 'push_subscriptions' │ 2                                    │ 9     │
│ 5       │ 'pasien B (Bagas)' │ 'kunjungan'          │ 2                                    │ 12    │
│ 6       │ 'pasien B (Bagas)' │ 'pasien'             │ 1                                    │ 39    │
│ 7       │ 'pasien B (Bagas)' │ 'pemeriksaan'        │ 1                                    │ 5     │
│ 8       │ 'pasien B (Bagas)' │ 'notifikasi'         │ 20                                   │ 139   │
│ 9       │ 'pasien B (Bagas)' │ 'push_subscriptions' │ 0                                    │ 9     │
│ 10      │ 'dokter (Reyhan)'  │ 'kunjungan'          │ 2                                    │ 12    │
│ 11      │ 'dokter (Reyhan)'  │ 'pasien'             │ 2                                    │ 39    │
│ 12      │ 'dokter (Reyhan)'  │ 'pemeriksaan'        │ 0                                    │ 5     │
│ 13      │ 'dokter (Reyhan)'  │ 'notifikasi'         │ 0                                    │ 139   │
│ 14      │ 'dokter (Reyhan)'  │ 'push_subscriptions' │ 0                                    │ 9     │
│ 15      │ 'anon'             │ 'kunjungan'          │ '0 (akses ditolak / tidak di-grant)' │ 12    │
│ 16      │ 'anon'             │ 'pasien'             │ '0 (akses ditolak / tidak di-grant)' │ 39    │
│ 17      │ 'anon'             │ 'pemeriksaan'        │ '0 (akses ditolak / tidak di-grant)' │ 5     │
│ 18      │ 'anon'             │ 'notifikasi'         │ '0 (akses ditolak / tidak di-grant)' │ 139   │
│ 19      │ 'anon'             │ 'push_subscriptions' │ '0 (akses ditolak / tidak di-grant)' │ 9     │
└─────────┴────────────────────┴──────────────────────┴──────────────────────────────────────┴───────┘
```

**Daftar Rute API Pengguna RLS vs Akses Direct DB**:
- **Rute dengan `denganRls` (transaksional claims & role user)**:
  1. `src/app/api/kunjungan/route.js`
  2. `src/app/api/notifikasi/route.js`
  3. `src/app/api/notifikasi/[id]/route.js`
  4. `src/app/api/profil/route.js`
  5. `src/app/api/riwayat/route.js`
- **Rute publik dengan `sebagaiAnon` (role anon)**:
  1. `src/app/api/public/dokter/route.js`
  2. `src/app/api/public/jadwal/route.js`
  3. `src/app/api/public/klinik/route.js`
  4. `src/app/api/public/layanan/route.js`
- **Rute terproteksi otorisasi server (`requireRole`) dengan akses direct `db` (Drizzle/pg)**:
  1. `src/app/api/admin/dokter/route.js`
  2. `src/app/api/admin/dokter/[id]/route.js`
  3. `src/app/api/admin/dokter/[id]/foto/route.js`
  4. `src/app/api/admin/jadwal/route.js`
  5. `src/app/api/admin/jadwal/[id]/route.js`
  6. `src/app/api/admin/layanan/route.js`
  7. `src/app/api/admin/layanan/[id]/route.js`
  8. `src/app/api/admin/pekerjaan-notifikasi/route.js`
  9. `src/app/api/admin/pengguna/route.js`
  10. `src/app/api/admin/pengguna/[id]/route.js`
  11. `src/app/api/admin/profil-klinik/route.js`
  12. `src/app/api/admin/rekap/route.js`
  13. `src/app/api/petugas/pasien/[id]/route.js`
  14. `src/app/api/pasien/route.js` (via `lib/domain/pasien.js`)
  15. `src/app/api/kunjungan/[id]/transition/route.js` (via `lib/domain/transisi.js`)
  16. `src/app/api/kunjungan/[id]/pemeriksaan/route.js` (via `lib/domain/pemeriksaan.js`)
  17. `src/app/api/push/langganan/route.js`
  18. `src/app/api/auth/logout/route.js`, `src/app/api/auth/me/route.js`, `src/app/api/auth/register/route.js`, `src/app/api/health/route.js`

**Tabel Database dengan RLS Aktif (`pg_class.relrowsecurity = true`) & Jumlah Policy (`pg_policies`)**:
1. `antrean` (RLS aktif, 3 policy: `antrean_dokter`, `antrean_pasien`, `antrean_staff`)
2. `dokter` (RLS aktif, 3 policy: `dokter_admin`, `dokter_anon`, `dokter_read`)
3. `dokter_layanan` (RLS aktif, 2 policy: `dl_admin`, `dl_read`)
4. `jadwal_praktik` (RLS aktif, 3 policy: `jadwal_admin`, `jadwal_anon`, `jadwal_read`)
5. `kunjungan` (RLS aktif, 4 policy: `kunjungan_dokter`, `kunjungan_koreksi`, `kunjungan_pasien`, `kunjungan_staff`)
6. `layanan` (RLS aktif, 3 policy: `layanan_admin`, `layanan_anon`, `layanan_read`)
7. `notifikasi` (RLS aktif, 2 policy: `notif_select`, `notif_update`)
8. `pasien` (RLS aktif, 6 policy: `pasien_dokter`, `pasien_insert`, `pasien_self`, `pasien_staff`, `pasien_upd_petugas`, `pasien_upd_self`)
9. `pemeriksaan` (RLS aktif, 4 policy: `pemeriksaan_dokter`, `pemeriksaan_ins`, `pemeriksaan_pasien`, `pemeriksaan_upd`)
10. `profil_klinik` (RLS aktif, 2 policy: `klinik_admin`, `klinik_read`)
11. `profiles` (RLS aktif, 2 policy: `profiles_select`, `profiles_update_admin`)
12. `push_subscriptions` (RLS aktif, 4 policy: `push_sub_delete`, `push_sub_insert`, `push_sub_select`, `push_sub_update`)
13. `tindakan` (RLS aktif, 2 policy: `tindakan_dokter`, `tindakan_pasien`)
14. `_migrations` (RLS aktif, 0 policy, proteksi skema terisolasi dari anon & authenticated)
Total: **14 tabel RLS aktif**, **40 policy RLS** di skema public.

---

### 16.4 Bukti Empiris Penghapusan Data Statis & Integrasi Penuh Live API (`scripts/uji-bukti-api.mjs`)

Pengujian dilakukan untuk membuktikan penghapusan total fallback/seed statis dari frontend dan memastikan 100% data profil, layanan, dan dokter disajikan secara dinamis dari database PostgreSQL Supabase:

1. **Eliminasi Total Data Statis di Frontend (`ClinicContext.tsx` & `PublicSite.tsx`)**:
   - Konstanta dummy/statis lokal (`DEFAULT_DOCTORS`, `DEFAULT_SERVICES`, `DEFAULT_CLINIC_PROFILE`, `DEFAULT_SCHEDULES`) dihapus total.
   - Sifat awal data katalog dimulai dari state kosong (`[]` / `null`) dan diisi secara asinkron dari endpoint backend:
     - `GET /api/public/klinik`
     - `GET /api/public/layanan`
     - `GET /api/public/dokter`
     - `GET /api/public/jadwal`
   - Form dialog admin (`DialogTambahPengguna`) dibersihkan dari nilai kata sandi default statis (mencegah pembuatan akun staf dengan kredensial default yang tidak aman).

2. **Dukungan Skema Dinamis JSONB (`detail`) di Database & API**:
   - Migrasi SQL `13_tambah_detail_jsonb.sql` menambahkan kolom `detail jsonb not null default '{}'::jsonb` pada tabel `profil_klinik`, `layanan`, dan `dokter`.
   - Data detail diperluas:
     - **Profil Klinik**: `tagline`, `history`, `mission`, `values`, `stats`.
     - **Layanan**: `overview`, `steps`, `cases`, `facilities`.
     - **Dokter**: `almamater`, `experienceYears`, `str`, `education`, `certifications`.
   - Endpoint publik mengembalikan properti camelCase lengkap yang siap dikonsumsi langsung oleh antarmuka pengguna tanpa transformasi statis tambahan.

3. **Verifikasi Integrasi Dua Arah (Read-Write Sync)**:
   - Evaluasi eksekusi `scripts/uji-bukti-api.mjs`:
     - Pembaruan nama dan tagline via `PUT /api/admin/profil-klinik` menghasilkan HTTP 200.
     - Permintaan `GET /api/public/klinik` berikutnya langsung menampilkan perubahan data terbaru secara persisten tanpa restart server.
     - Pengembalian nilai asli via `PUT` terverifikasi sukses 100%.

4. **Penanganan Kondisi Gagal Jaringan & Tombol Coba Lagi**:
   - Jika koneksi ke API gagal atau server backend belum menyala, antarmuka pengguna tidak menampilkan data tiruan/palsu, melainkan menampilkan banner peringatan galat yang semantik beserta tombol **"Coba Lagi"** (`refreshPublicData`) untuk memicu fetch ulang secara elegan.

---

### 16.5 Bukti Empiris Fitur Login Cepat Demo Evaluator (`scripts/uji-bukti-login-cepat.mjs`)

Fitur Login Cepat Demo dikembangkan khusus untuk mempermudah evaluasi dosen dan penguji tanpa perlu menghafal dan mengetik kredensial email/password secara berulang:

1. **Autentikasi Otomatis 4 Peran Utama**:
   - Endpoint: `POST /api/auth/login-cepat` dengan payload `{ "peran": "pasien" | "petugas" | "dokter" | "admin" }`.
   - Akun aktif yang dipetakan:
     - `pasien`: `ani.wulandari@gmail.com` (Pasien A - Ani Wulandari)
     - `petugas`: `rina.petugas@gmail.com` (Petugas Rina)
     - `dokter`: `dokter.reyhan@gmail.com` (dr. Reyhan Adhitama - Poli Umum)
     - `admin`: `admin.klinik@gmail.com` (Administrator Klinik)
   - Evaluasi: Keempat peran menghasilkan HTTP 200, menyematkan cookie HttpOnly `sb-access-token` dan `sb-refresh-token`, serta `GET /api/auth/me` mengonfirmasi kesesuaian peran secara akurat (**4/4 PASS ✓**).

2. **Validasi Masukan Skema Zod**:
   - Payload yang tidak valid (misal: `{ "peran": "superadmin" }`) ditolak dengan HTTP 400 Bad Request, kode error `VALIDATION_ERROR` (**PASS ✓**).

3. **Proteksi Rate Limiting Ketat**:
   - Pembatasan maksimal 10 permintaan per menit per IP (`src/lib/rate-limit.js`).
   - Permintaan melebihi kuota secara otomatis menghasilkan HTTP 429 `TOO_MANY_REQUESTS` dengan header `Retry-After` (**PASS ✓**).

4. **Isolasi Keamanan Lingkungan Produksi**:
   - Diproteksi secara ketat oleh variabel lingkungan `DEMO_LOGIN_ENABLED="1"`.
   - Di lingkungan produksi non-demo di mana variabel tersebut bernilai `"0"` atau tidak didefinisikan, endpoint langsung menolak dengan HTTP 403 Forbidden (`KODE: DEMO_DISABLED`) dan tombol UI login cepat otomatis disembunyikan.









