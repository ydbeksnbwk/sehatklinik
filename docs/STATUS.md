# Status Proyek Sistem Informasi Klinik Kesehatan (Tim 7)

Terakhir diperbarui: 13 November 2026 (Verifikasi Backend Tahap 1C)

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
| **Tahap 5** | Seed database, verifikasi demo, dokumentasi | **BELUM** | - |
| **Tahap 6** | Deployment & pengujian produksi | **BELUM** | - |

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




