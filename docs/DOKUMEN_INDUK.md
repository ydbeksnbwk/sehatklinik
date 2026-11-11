# Dokumen Induk Proyek — Sistem Informasi Klinik Kesehatan (Tim 7)

**Versi:** 1.1 · **Tanggal:** 4 November 2026 · **Status:** acuan tunggal pengerjaan hingga demo dan penilaian

Dokumen ini menggabungkan **seluruh** ketentuan dosen, perencanaan tim (spesifikasi kebutuhan, kebutuhan produk, ERD, use case, sequence diagram, user flow), dan kondisi implementasi saat ini ke dalam satu berkas. Semua aturan dituliskan lengkap di sini, sehingga tidak perlu membuka dokumen lain untuk memahami apa yang harus dibangun dan apa yang sudah selesai.

---

## Daftar Isi

1. Ringkasan dan keputusan yang mengikat
2. Pendahuluan: tujuan, masalah, ruang lingkup, definisi
3. Ketentuan dosen untuk Tim 7 (diuraikan lengkap)
4. Aktor, use case, dan cerita pengguna
5. Kebutuhan fungsional rinci
6. Alur pengguna dan sequence diagram
7. Web Push Notification dan background worker
8. Arsitektur sistem final
9. Perancangan database
10. Kebutuhan non-fungsional dan keamanan
11. Antarmuka pengguna dan katalog API
12. Status implementasi dan analisis kesenjangan
13. Roadmap, risiko, dan checklist
14. Panduan teknis: menjalankan, struktur repository, kesalahan umum
15. Strategi pengujian dan bukti verifikasi
16. Keputusan tim dan pertanyaan terbuka
17. Lampiran: matriks keterlacakan
18. Panduan pengerjaan dengan agy: persiapan, gerbang tahap, dan prompt siap tempel

---

## 1. Ringkasan dan keputusan yang mengikat

### 1.1 Apa yang dibangun

Aplikasi web klinik rawat jalan. Calon pasien melihat informasi klinik tanpa login. Pasien mendaftar akun, memilih jadwal dokter, mendapat nomor antrean, memantau status antrean, menerima notifikasi, dan melihat riwayat kunjungan pribadi. Petugas pendaftaran mendaftarkan pasien walk-in, mengonfirmasi kedatangan (check-in), dan mengelola antrean. Dokter memanggil pasien, memeriksa, mencatat hasil pemeriksaan dan tindakan, lalu menyelesaikan kunjungan. Admin mengelola dokter, layanan, jadwal praktik, pengguna, profil klinik, dan rekap kunjungan.

### 1.2 Urutan otoritas bila ada pertentangan

1. **Ketentuan dosen** (halaman dan dashboard, hak akses, fungsional, 17 ketentuan umum, dan ketentuan teknis). Ini yang dinilai.
2. Keputusan tim yang tercatat di bagian 16.
3. Perencanaan tim terdahulu (draf spesifikasi, kebutuhan produk, diagram).
4. Kondisi kode saat ini.

### 1.3 Pertentangan yang ditemukan dan keputusan akhirnya

Perencanaan tim terdahulu ditulis dalam beberapa versi yang tidak sepenuhnya sejalan dengan ketentuan dosen. Tabel berikut menetapkan satu jawaban untuk setiap pertentangan. **Keputusan ini mengikat seluruh isi dokumen.**

| No | Topik | Yang tertulis di perencanaan lama | Ketentuan dosen | **Keputusan akhir** |
|---|---|---|---|---|
| K1 | Autentikasi | Sesi buatan sendiri, kata sandi di-hash dengan Argon2id atau bcrypt, tabel `sesi` | Supabase Auth wajib. Dashboard memerlukan sesi Supabase Auth yang valid. | **Supabase Auth.** Login lewat endpoint backend milik kita yang memanggil Supabase Auth. Tabel `sesi` dan kolom `password_hash` tidak dibuat, karena hash kata sandi dikelola Supabase. |
| K2 | Akses database | Prisma | Prisma, Drizzle, atau `pg` boleh | **Drizzle ORM** (sudah dipakai). |
| K3 | Penyimpanan berkas | Cloudflare R2, S3, atau MinIO | Supabase Storage atau Cloudflare R2 | **Supabase Storage.** Foto dokter diunggah ke sana. Tabel hanya menyimpan path. |
| K4 | Notifikasi | Draf kebutuhan produk dan use case menandainya opsional dan hanya di dalam aplikasi | Web Push nyata dengan background worker adalah **wajib** | **Web Push wajib.** Notifikasi di dalam aplikasi (tabel `notifikasi`) tetap ada dan menjadi sumber kejadian untuk Web Push. |
| K5 | Pembaruan status antrean | Supabase Realtime dari browser (pada sequence diagram) | Backend wajib dibuat sendiri. Layanan lain tidak boleh menggantikan backend. | **Polling berkala atau Server-Sent Events ke API milik kita.** Browser tidak memakai Supabase Realtime, `supabase.from`, atau `supabase.rpc` untuk data. |
| K6 | Hosting | Aplikasi di Vercel | Worker harus proses terpisah dengan antrean persisten | **Aplikasi web di Vercel. Worker dan Redis di layanan lain** (misalnya Railway atau Render untuk worker, Upstash untuk Redis). Vercel tidak menjalankan proses yang hidup terus. |
| K7 | Validasi server | Zod | Zod atau setara | **Zod** di semua endpoint (saat ini masih validasi manual, harus diganti). |
| K8 | Bahasa | JavaScript, TypeScript untuk tipe | JavaScript pada satu bagian, TypeScript pada bagian lain | **JavaScript** untuk kode API. Berkas skema hasil Drizzle (`schema.ts`) dibiarkan TypeScript. Keduanya diterima. |
| K9 | Pemilik logika bisnis | Route Handler dan Server Action | Backend sendiri dengan Next.js dan JavaScript | **Backend JavaScript memegang seluruh logika bisnis.** Fungsi database `fn_...` yang sudah ada tidak dipanggil aplikasi. Database bertindak sebagai lapisan validasi ketiga yang independen. |
| K10 | NIK saat registrasi | Opsional | Tidak diatur | **Wajib**, 16 digit, unik. |
| K11 | Pembatalan oleh pasien | Sebelum dipanggil, tanpa batas waktu | Tidak diatur | **Selama antrean masih berstatus Menunggu, dan paling lambat 2 jam sebelum jam mulai praktik.** Angka 2 jam adalah usulan yang dapat diganti satu konstanta. Petugas dapat membatalkan kapan saja selama antrean belum diperiksa. |
| K12 | Siapa yang boleh check-in dan daftarkan walk-in | Petugas | Petugas pendaftaran mengelola pendaftaran dan antrean. Admin mengelola akun, layanan, jadwal, rekap. | **Hanya petugas.** Admin tidak melakukan check-in, pendaftaran walk-in, atau pembatalan kunjungan. |
| K13 | Tabel pendukung notifikasi | `push_subscriptions`, `notifikasi_job`, kolom `idempotency_key` | Subscription harus disimpan di PostgreSQL. Retry terbatas dan pencegahan kirim ganda wajib. | **`push_subscriptions` wajib dibuat.** Status pengiriman ditambahkan sebagai kolom pada tabel `notifikasi` yang sudah ada (lihat bagian 7.6). `idempotency_key` opsional, karena kunjungan ganda sudah ditolak oleh unique index. |
| K14 | Siapa yang memanggil antrean | Petugas (kebutuhan) dan dokter (use case) | Petugas: antrean. Dokter: antrean, hasil pemeriksaan. | **Petugas dan dokter** keduanya boleh memanggil dan melewati. **Hanya dokter** yang memulai pemeriksaan. |
| K15 | Tabel opsional pada ERD | `lampiran_pemeriksaan`, `log_aktivitas` | Tidak diwajibkan | **Ditunda (prioritas rendah).** Dikerjakan hanya setelah seluruh kebutuhan wajib lulus uji. |

---

## 2. Pendahuluan

### 2.1 Tujuan sistem

1. **Mendigitalisasi layanan klinik.** Menampilkan profil klinik, layanan, dokter, jadwal praktik, lokasi, dan jam operasional secara terbuka, sehingga calon pasien memperoleh informasi akurat tanpa datang atau menelepon.
2. **Mempermudah akses pasien.** Pasien mendaftar kunjungan, memperoleh nomor antrean, memantau status antrean, melihat riwayat kunjungan pribadi, dan menerima notifikasi.
3. **Meningkatkan efisiensi pelayanan.** Mengurangi antrean fisik dan pencatatan manual di loket dengan pendaftaran daring dan pengelolaan antrean terpusat.
4. **Mengelola data secara akurat dan aman.** Mencatat data pasien, hasil pemeriksaan, dan tindakan secara terstruktur, merekap kunjungan otomatis, dengan hak akses sesuai peran.
5. **Memberi informasi tepat waktu.** Mengirim notifikasi Web Push kepada pasien dan petugas pada kejadian penting, seperti pendaftaran berhasil dan antrean dipanggil.

### 2.2 Masalah yang diselesaikan

- Pasien harus datang atau menelepon hanya untuk mengetahui jadwal dokter, layanan, dan jam buka.
- Pendaftaran dan nomor antrean memakai kertas di loket, sehingga terjadi antrean fisik, salah catat, dan kunjungan ganda.
- Kuota dokter sulit dikendalikan karena pendaftaran tidak terpusat.
- Catatan pemeriksaan dan riwayat pasien tersebar di buku atau berkas, sulit ditelusuri, dan rawan bocor atau hilang.
- Pengelola klinik tidak memiliki rekap kunjungan yang cepat dan akurat.

### 2.3 Sasaran dan bukan sasaran

| Kode | Sasaran |
|---|---|
| G1 | Informasi klinik terbuka dan mutakhir tanpa login |
| G2 | Pasien dapat mendaftar kunjungan daring dan memantau status antrean |
| G3 | Petugas bekerja lebih cepat lewat check-in dan pengelolaan antrean terpusat |
| G4 | Dokter mencatat pemeriksaan dan tindakan secara terstruktur dan rahasia |
| G5 | Admin mengendalikan data master, pengguna, dan rekap |
| G6 | Pembatasan akses data per peran dijamin sampai level database |
| G7 | Notifikasi Web Push nyata dan andal pada kejadian penting |

**Bukan sasaran:** modul farmasi dan stok obat, penagihan dan pembayaran, asuransi dan BPJS, laboratorium dan radiologi, integrasi sistem eksternal nasional, aplikasi mobile native, multi-cabang, serta data pasien nyata. Seluruh data pengembangan dan pengujian adalah data simulasi dengan identitas fiktif.

### 2.4 Ruang lingkup

- **Aktor:** pengunjung (publik), pasien, petugas pendaftaran, dokter, admin.
- **Halaman publik** tanpa login: profil klinik, layanan, dokter, jadwal praktik, lokasi (peta), jam operasional, dan tombol pendaftaran kunjungan.
- **Teknologi:** Next.js dan React dengan JavaScript, backend dari Next.js Route Handlers, PostgreSQL Supabase, Drizzle ORM, Supabase Auth, Supabase Storage, Zod, Web Push (Service Worker, VAPID, `web-push`), BullMQ dengan Redis, Pino untuk log, Git dan GitHub, Vercel untuk hosting.
- **Perangkat:** responsif di desktop, tablet, dan ponsel melalui browser.
- **Konektivitas:** hanya mode online. Web Push dapat diterima saat halaman tidak dibuka, selama izin diberikan dan browser mendukung.
- **Metode kerja:** seluruh anggota tim terlibat dari analisis sampai deployment dengan GitHub sebagai repository bersama.

### 2.5 Batasan

- Pembayaran tidak dibangun. Data pasien adalah data simulasi.
- Pasien walk-in tidak memiliki akun sehingga tidak menerima notifikasi.
- Pada iOS, Web Push hanya berfungsi untuk web app yang ditambahkan ke Home Screen (iOS 16.4 ke atas).
- Sistem tidak berfungsi offline.
- Fitur opsional hanya dikerjakan setelah seluruh kebutuhan wajib lulus pengujian.

### 2.6 Definisi dan istilah

| Istilah | Arti |
|---|---|
| Pasien | Orang yang memperoleh layanan di klinik. Dapat memiliki akun (mendaftar daring) atau hanya tercatat oleh petugas tanpa akun (pasien walk-in). |
| Pasien walk-in | Pasien yang datang langsung dan didaftarkan petugas. Tersimpan sebagai data pasien tanpa akun, tidak login, dan tidak menerima notifikasi. |
| Petugas | Staf klinik di bagian pendaftaran, antrean, dan administrasi. |
| Dokter | Tenaga medis yang memeriksa dan melakukan tindakan. |
| Admin | Pengelola sistem dengan hak penuh atas data master dan pengguna. |
| Kunjungan | Satu kali pelayanan pasien pada tanggal, dokter, jadwal, dan layanan tertentu. |
| Status kunjungan | Terdaftar, Hadir, Selesai, Dibatalkan. |
| Nomor antrean | Nomor urut unik per dokter dan per tanggal, diberikan sistem setelah pendaftaran berhasil. |
| Status antrean | Menunggu, Dipanggil, Sedang Diperiksa, Selesai, Dilewati, Dibatalkan. |
| Jadwal praktik | Hari dan jam praktik dokter beserta kuota per sesi. |
| Kuota | Batas jumlah kunjungan aktif (tidak dibatalkan) pada satu jadwal di satu tanggal. Sisa kuota = kuota dikurangi kunjungan aktif. |
| Check-in | Konfirmasi kehadiran pasien oleh petugas saat tiba. |
| Rekam medis atau pemeriksaan | Catatan hasil pemeriksaan dan tindakan, bersifat rahasia dan hanya diakses pihak berwenang. |
| Tindakan | Prosedur medis yang dilakukan dokter selama kunjungan. |
| Rekap kunjungan | Ringkasan jumlah kunjungan per periode, dokter, layanan, dan status. |
| Route Handler / Server Action | Mekanisme Next.js untuk membuat endpoint dan logika di sisi server. |
| RLS (Row Level Security) | Aturan database yang menyaring baris yang boleh dibaca atau ditulis tiap pengguna. |
| Web Push | Pengiriman notifikasi ke browser lewat push service, meski halaman tidak dibuka. |
| VAPID | Pasangan kunci publik dan privat yang mengidentifikasi server pengirim. Kunci privat hanya di server. |
| Service Worker | Skrip browser yang menangani event `push` dan `notificationclick`. |
| Push subscription | Endpoint dan kunci enkripsi milik satu browser atau perangkat. |
| Background worker | Proses terpisah yang mengambil pekerjaan dari antrean dan mengirim notifikasi secara asinkron. |
| Antrean pekerjaan | Antrean persisten (BullMQ dengan Redis) yang menampung pekerjaan pengiriman notifikasi. |
| Outbox | Pola menyimpan pekerjaan notifikasi di tabel database dalam transaksi yang sama dengan perubahan bisnis, agar tidak hilang bila antrean tidak terjangkau. |
| Idempotency key | Token unik per pengiriman formulir untuk mencegah data ganda. |

---

## 3. Ketentuan dosen untuk Tim 7 (diuraikan lengkap)

Bagian ini memuat seluruh ketentuan yang dinilai dosen, dituliskan utuh. Ketentuan yang berlaku untuk semua tim ditulis di sini sebagai bagian dari Tim 7.

### 3.1 Halaman utama dan dashboard

**Halaman utama (tanpa login) wajib menampilkan:**

- profil klinik
- layanan
- dokter
- jadwal praktik
- lokasi
- jam operasional
- tombol pendaftaran kunjungan

**Dashboard (setelah login) wajib memuat menu dan fitur berikut:**

| Peran | Menu dan fitur wajib |
|---|---|
| Pasien | Profil, pendaftaran kunjungan, nomor antrean, status dan riwayat kunjungan pribadi |
| Petugas | Pendaftaran, antrean, administrasi |
| Dokter | Antrean, hasil pemeriksaan, tindakan |
| Admin | Dokter, layanan, jadwal, pengguna, rekap kunjungan |

### 3.2 Role dan hak akses wajib

- **Pasien:** mengelola profil dan melihat kunjungan sendiri.
- **Petugas pendaftaran:** mengelola pendaftaran dan antrean.
- **Dokter:** mengakses pasien yang ditangani dan mencatat pemeriksaan.
- **Admin:** mengelola akun, layanan, jadwal, dan rekap operasional.

### 3.3 Kebutuhan fungsional wajib dan alur uji minimum

**Fungsional wajib:** kelola dokter, layanan, dan jadwal; daftar kunjungan; nomor antrean per dokter dan tanggal; batasi kuota; panggil antrean; catat pemeriksaan dan tindakan; selesaikan kunjungan.

**Alur minimum yang harus berhasil diuji:**

> Pasien memilih jadwal → memperoleh antrean → petugas memproses kedatangan → dokter mencatat pemeriksaan → kunjungan selesai → riwayat tersedia sesuai hak akses.

### 3.4 Data dummy minimum

Minimal **5 pasien, 5 jadwal praktik, dan 5 kunjungan** dengan variasi status. Kunjungan yang sudah diperiksa memiliki catatan pemeriksaan contoh. Rincian komposisi data dummy ada di bagian 9.8.

### 3.5 Tujuh belas ketentuan umum beserta bukti pengujiannya

| No | Aspek | Ketentuan wajib | Bukti yang diminta saat pengujian |
|---|---|---|---|
| 1 | Teknologi dan alur kerja | Next.js. Alur: code editor → GitHub → Vercel ↔ Supabase. Database memakai Supabase, dan Supabase Auth untuk autentikasi. | Repository GitHub tersedia. URL Vercel dapat dibuka dan terhubung ke Supabase. |
| 2 | Penyimpanan data | Seluruh data bisnis pengguna tersimpan di database Supabase. Array statis atau localStorage bukan penyimpanan utama. | Data tetap tersedia setelah refresh, logout lalu login, dan dari perangkat lain oleh pengguna yang berhak. |
| 3 | Penyimpanan aset | Foto, dokumen, dan unggahan disimpan di Supabase Storage atau Cloudflare R2 (opsional). Dilarang menyimpan berkas sebagai Base64 di tabel. | Tabel menyimpan nama, path atau object key, atau URL. Berkas fisik ada di penyimpanan aset. |
| 4 | Privasi aset | Berkas pribadi hanya dapat diakses pemilik dan role berwenang. Aset katalog publik dapat diakses sesuai kebutuhan. | Pengguna tanpa hak tidak dapat membuka dokumen privat. |
| 5 | Autentikasi | Dashboard memerlukan sesi Supabase Auth yang valid. Role tidak dapat diubah sendiri lewat formulir profil biasa. | Login dan logout berjalan. Pengunjung tanpa login diarahkan ke halaman login. |
| 6 | Otorisasi data | Hak akses diperiksa pada pemrosesan permintaan dan database. Row Level Security diterapkan sesuai role dan kepemilikan. Menyembunyikan menu saja tidak cukup. | Mengganti ID pada URL atau permintaan tidak memberi akses ke data pengguna lain. |
| 7 | Kredensial aplikasi | Memakai environment variables. Password database dan kunci berprivilege seperti `service_role` tidak masuk repository atau kode browser. | Repository dan kode sisi browser bebas dari kredensial berprivilege. |
| 8 | Integritas data | Relasi tabel memakai kunci yang sesuai. Nilai wajib, kode unik, kuota, dan benturan jadwal divalidasi pada pemrosesan dan database. | Data tidak valid ditolak. Pengiriman ulang tidak menimbulkan transaksi ganda yang melanggar aturan. |
| 9 | Validasi masukan | Field wajib, format, rentang angka, tanggal, serta jenis dan ukuran berkas diperiksa, dan tetap diperiksa di sisi pemrosesan. | Input kosong, angka negatif, tanggal tidak sesuai, atau berkas tidak valid ditolak dengan pesan jelas. |
| 10 | Konsistensi dashboard | Ringkasan, status, dan rekap dihitung dari data database sesuai hak akses. | Perubahan transaksi tercermin konsisten pada daftar dan ringkasan. |
| 11 | Antarmuka responsif | Halaman utama, formulir, tabel, dan dashboard dapat dipakai di desktop dan ponsel. | Navigasi, tombol, formulir, dan informasi penting terbaca dan dapat dipakai pada keduanya. |
| 12 | Umpan balik sistem | Menampilkan kondisi memuat, data kosong, berhasil, dan gagal. Mencegah klik berulang selama pengiriman. | Hasil tindakan diketahui pengguna. Tidak ada halaman kosong tanpa keterangan. |
| 13 | Pengelolaan daftar | Pencarian atau filter yang relevan. Daftar panjang memakai pagination atau pemuatan bertahap. | Hasil pencarian atau filter sesuai data tersimpan. |
| 14 | Deployment | Fitur di URL Vercel berfungsi seperti lokal: login, database, unggah, dan membuka ulang URL detail. | Pengujian langsung pada URL deployment tanpa server lokal. |
| 15 | Data dummy | Minimal 5 data pada setiap tabel bisnis utama yang relevan, termasuk transaksi. Tabel referensi berkategori terbatas mengikuti kebutuhan. | Daftar, detail, relasi, filter, dan ringkasan dapat diuji. Aplikasi tidak kosong. |
| 16 | Variasi pengujian | Data dummy mencakup beberapa status proses. Setiap role punya akun uji. Identitas memakai data fiktif. | Penguji dapat mencoba semua role dan beberapa tahap proses. |
| 17 | Batas pelaksanaan | Pembayaran cukup berupa pencatatan dan konfirmasi status. Data pasien memakai data simulasi. | Seluruh alur wajib berjalan dari antarmuka sampai database tanpa keharusan pembayaran atau data operasional nyata. |

### 3.6 Ketentuan teknis yang berlaku untuk semua proyek

#### a. Teknologi wajib

- Frontend dan backend: Next.js, React, dan JavaScript.
- Database: PostgreSQL.
- Backend API: Next.js Route Handlers atau Server Actions.
- Akses database: Prisma, Drizzle, atau `pg`.
- Validasi: Zod atau pustaka setara.
- Version control: Git.
- Web Push: Service Worker, VAPID, dan pustaka `web-push`.
- Background worker: proses terpisah dengan antrean pekerjaan persisten, misalnya BullMQ dengan Redis atau solusi setara.
- **Larangan:** PostgREST atau layanan lain tidak boleh menggantikan backend. Backend wajib dibuat sendiri dengan JavaScript dan Next.js.

#### b. Validasi tiga lapisan (wajib dapat didemonstrasikan independen)

1. **Frontend:** field wajib, format, panjang, rentang nilai, dan pesan error yang jelas.
2. **Backend:** validasi request, aturan bisnis, relasi data, autentikasi, otorisasi, kepemilikan data, dan transisi status.
3. **Database:** `PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`, `UNIQUE`, dan `CHECK`.

Validasi frontend tidak menggantikan backend, dan validasi backend tidak menggantikan constraint database.

#### c. Database dan integritas data

- Tabel, relasi, dan tipe data sesuai kebutuhan bisnis.
- Tersedia migration files agar database dapat dibuat ulang dari kondisi awal.
- Seed data boleh untuk inisialisasi, tetapi tidak boleh menggantikan fitur yang seharusnya memakai data persisten.
- Operasi multi-langkah memakai transaksi.
- Pertimbangkan race condition pada reservasi, kuota, saldo, dan transaksi.
- Query terparameterisasi, pagination untuk dataset besar, indeks sesuai kebutuhan query.
- Hindari N+1 query, pengambilan data berlebihan, dan duplikasi data.

#### d. Autentikasi dan keamanan

- Pemeriksaan hak akses dilakukan di server.
- Jangan mempercayai role, harga, saldo, status, atau identitas pemilik yang dikirim client.
- Secret, kredensial database, token, dan private key tidak terekspos ke browser atau repository.
- Gunakan query terparameterisasi atau ORM yang aman.
- Rate limiting pada endpoint yang rentan disalahgunakan.
- Operasi sensitif memeriksa kepemilikan data dan hak akses.
- Respons error tidak membocorkan informasi internal yang sensitif.

#### e. Web Push dan background worker (wajib)

Web Push harus nyata, bukan toast atau alert.

- **Browser:** Service Worker menangani event `push` dan `notificationclick`. Izin diminta lewat interaksi pengguna. Notifikasi mengarahkan ke halaman yang relevan. Kondisi izin ditolak, browser tidak mendukung, dan subscription tidak valid ditangani.
- **Backend dan worker:** VAPID dan `web-push`. Subscription disimpan di PostgreSQL dan dihubungkan dengan pengguna. Kunci privat VAPID hanya di server. Worker memproses pengiriman secara asinkron dengan antrean persisten. Ada retry terbatas, penanganan kegagalan, dan pencegahan kirim ganda. Worker dapat dijalankan terpisah dan cara menjalankannya dijelaskan. Kegagalan notifikasi tidak boleh membatalkan transaksi bisnis yang sudah tersimpan.
- Notifikasi harus terhubung dengan minimal satu kejadian bisnis yang relevan.
- **Alur minimum:** kejadian bisnis → database → antrean → background worker → Web Push → Service Worker → notifikasi di browser.

#### f. Unggah berkas dan object storage

Wajib bila tema punya fitur unggah. Berkas disimpan di object storage, sedangkan PostgreSQL menyimpan metadata dan referensi. Ukuran, tipe, dan hak akses divalidasi di server. Berkas privat dilindungi. Kredensial storage tidak diekspos ke client. Presigned URL boleh bila dibuat aman oleh backend.

#### g. Error handling dan observability

- Catat error penting, durasi operasi, dan status pekerjaan worker.
- Log terstruktur (Pino atau Winston) dengan konteks cukup untuk diagnosis.
- Jangan mencatat password, token, private key, atau data sensitif yang tidak perlu.
- Kegagalan worker tidak boleh terjadi diam-diam.
- Tim harus dapat menunjukkan cara menemukan error dan memeriksa pekerjaan yang gagal.
- Error monitoring (Sentry atau setara) dan tracing lengkap adalah anjuran, bukan keharusan.

#### h. Performa dan kualitas kode

- Gunakan tipe dengan baik dan hindari `any` tanpa alasan jelas bila memakai TypeScript.
- Hindari hardcode atau data dummy sebagai pengganti fitur.
- Pagination dan filter sesuai kebutuhan, hindari query berulang.
- Caching dipakai sadar dengan mempertimbangkan konsistensi data.
- Hindari abstraksi, pustaka, dan arsitektur yang tidak bermanfaat nyata.
- UI memiliki state loading, kosong, berhasil, dan error. Tampilan responsif dan alur utama dapat dipakai dengan keyboard.
- Anjuran: ESLint, pemeriksaan tipe, dan CI/CD dengan GitHub Actions.

#### i. Deployment dan dokumentasi

Repository wajib menyediakan: kode sumber dengan riwayat Git yang wajar, petunjuk instalasi dan menjalankan aplikasi, `.env.example` tanpa secret asli, migration files dan petunjuk inisialisasi database, ERD atau dokumentasi skema, dokumentasi arsitektur (frontend, backend, database, worker), petunjuk konfigurasi VAPID dan menjalankan worker, serta daftar fitur yang selesai dan keterbatasan. Aplikasi dan worker harus dapat dijalankan dari dokumentasi pada lingkungan baru. Deployment Web Push wajib HTTPS, kecuali lingkungan lokal yang memenuhi secure context.

#### j. Bukti verifikasi (sembilan butir)

1. Validasi input di frontend.
2. Validasi backend lewat request langsung tanpa frontend.
3. Constraint database terhadap data tidak valid.
4. Pemeriksaan autentikasi, otorisasi, dan kepemilikan data.
5. Operasi CRUD dengan data persisten.
6. Migrasi dan relasi database.
7. Pengiriman Web Push lewat background worker.
8. Penanganan kegagalan job dan subscription tidak valid.
9. Konsistensi data dan penanganan error.

Screenshot UI saja tidak cukup. Tim harus mampu menjelaskan implementasi dan keputusan teknis.

#### k. Ketentuan umum teknis

Teknologi tambahan boleh selama tidak menggantikan kompetensi inti. Contoh teknologi bersifat rekomendasi kecuali dinyatakan wajib. Alternatif boleh bila fungsi, keamanan, dan kriteria teknisnya setara. Penyimpangan dari ketentuan wajib harus disetujui pengajar. Bila requirement ambigu atau bertentangan, minta klarifikasi sebelum menentukan implementasi.

**Prinsip utama:** aplikasi benar-benar berfungsi, memakai data persisten, aman, dapat dijelaskan implementasinya, dan memenuhi standar full-stack. Tampilan yang bagus saja tidak cukup.

---

## 4. Aktor, use case, dan cerita pengguna

### 4.1 Aktor dan persona

Pasien adalah spesialisasi dari Pengunjung: semua yang bisa dilakukan pengunjung juga bisa dilakukan pasien.

| Aktor | Karakter | Kebutuhan utama | Batas akses |
|---|---|---|---|
| Pengunjung | Calon pasien, belum login | Melihat profil, layanan, dokter, jadwal, lokasi, jam operasional. Mendaftar akun. | Hanya baca data publik, registrasi, dan login |
| Pasien | Rentang usia dan literasi digital beragam, antarmuka harus sederhana | Daftar kunjungan cepat, tahu nomor dan status antrean, menerima notifikasi, melihat riwayat | Hanya data miliknya |
| Petugas pendaftaran | Staf loket, terbiasa komputer atau tablet | Mendaftarkan pasien walk-in, check-in, mengelola antrean tanpa salah | Pasien, kunjungan, antrean. **Tidak** membaca atau mengubah pemeriksaan dan tindakan. Tidak mengelola data master. |
| Dokter | Tenaga medis, penggunaan komputer dasar | Antrean pribadi, mencatat pemeriksaan dan tindakan dengan cepat | Kunjungan, antrean, pemeriksaan, dan tindakan miliknya. Riwayat terbatas pada kunjungan yang ia tangani sendiri. |
| Admin | Manajer atau pengelola klinik | Mengelola dokter, layanan, jadwal, akun, profil klinik, rekap, dan memantau pekerjaan notifikasi | Data master, pengguna, rekap. **Tidak** membaca isi pemeriksaan kecuali kebijakan klinik menetapkan lain. |

Akun petugas, dokter, dan admin hanya dibuat oleh admin. Pasien mendaftar sendiri. Peran tidak dapat dipilih atau diubah oleh pengguna lewat formulir registrasi maupun profil.

### 4.2 Use case dan hubungannya

Diagram use case memuat 29 use case yang dikelompokkan per aktor.

**Pengunjung dan Pasien**
- Melihat informasi klinik (profil, layanan, dokter, jadwal, lokasi, jam operasional)
- Registrasi akun pasien
- Login dan logout (Supabase Auth), dipakai semua aktor berakun
- Kelola profil
- Mendaftar kunjungan
- Melihat nomor dan status antrean
- Membatalkan kunjungan
- Melihat riwayat kunjungan pribadi
- Menerima notifikasi antrean (Web Push)

**Petugas pendaftaran**
- Mencari atau mendaftarkan pasien baru
- Mendaftarkan kunjungan walk-in
- Konfirmasi kehadiran (check-in)
- Mengelola antrean (panggil, lewati, batalkan)
- Administrasi kunjungan (koreksi data)

**Dokter**
- Melihat antrean pasien miliknya
- Memanggil pasien dan memulai pemeriksaan
- Mencatat hasil pemeriksaan
- Mencatat tindakan (extend dari mencatat hasil pemeriksaan)
- Menyelesaikan kunjungan
- Melihat riwayat pasien yang ditangani

**Admin**
- Kelola data dokter
- Kelola layanan
- Kelola jadwal praktik
- Kelola pengguna dan peran
- Kelola profil klinik
- Melihat rekap kunjungan
- Ekspor rekap PDF atau Excel (extend dari melihat rekap, prioritas rendah)

**Hubungan antar use case**
- Mendaftar kunjungan **include** Validasi kuota dan cegah daftar ganda, dan **include** Terbitkan nomor antrean per dokter dan tanggal.
- Mendaftarkan kunjungan walk-in **include** kedua use case yang sama. Artinya aturan kuota, anti-ganda, dan penomoran antrean untuk walk-in identik dengan pendaftaran daring.
- Mencatat tindakan **extend** Mencatat hasil pemeriksaan: tindakan bersifat tambahan. Satu pemeriksaan dapat memiliki beberapa tindakan, atau tidak sama sekali.

### 4.3 Cerita pengguna dan kriteria penerimaan

Prioritas: **P0** wajib, **P1** opsional.

#### Pengunjung dan pasien

| ID | Cerita | P |
|---|---|---|
| US-01 | Sebagai pengunjung, saya ingin melihat profil klinik, layanan, dokter, jadwal praktik, lokasi, dan jam operasional agar tahu klinik sesuai kebutuhan. | P0 |
| US-02 | Sebagai pengunjung, saya ingin membuat akun pasien agar dapat mendaftar kunjungan. | P0 |
| US-03 | Sebagai pengguna, saya ingin login dan logout dengan aman. | P0 |
| US-04 | Sebagai pasien, saya ingin mengelola profil saya. | P0 |
| US-05 | Sebagai pasien, saya ingin mendaftar kunjungan pada dokter, tanggal, dan sesi yang tersedia. | P0 |
| US-06 | Sebagai pasien, saya ingin melihat nomor dan status antrean saya. | P0 |
| US-07 | Sebagai pasien, saya ingin membatalkan kunjungan sebelum dipanggil. | P0 |
| US-08 | Sebagai pasien, saya ingin melihat riwayat kunjungan dan ringkasan hasil pemeriksaan milik saya. | P0 |
| US-09 | Sebagai pasien, saya ingin menerima notifikasi antrean (Web Push). | P0 |

Kriteria penerimaan:

- **US-01:** halaman dapat dibuka tanpa login. Data berasal dari database. Hanya dokter dan layanan berstatus aktif yang tampil. Tombol Daftar Kunjungan mengarahkan pengunjung belum login ke login atau registrasi.
- **US-02:** email unik. Format telepon dan kekuatan kata sandi divalidasi. Akun otomatis berperan pasien. Peran tidak dapat dipilih pengguna.
- **US-03:** pengunjung tanpa sesi yang membuka dashboard diarahkan ke halaman login. Setelah login, pengguna diarahkan ke dashboard sesuai peran.
- **US-04:** pasien hanya dapat mengubah alamat, telepon, dan kontak darurat. Nama, NIK, tanggal lahir, dan jenis kelamin hanya dapat dikoreksi petugas.
- **US-05:** hanya dokter, jadwal, dan sesi yang punya sisa kuota yang dapat dipilih. Kuota penuh ditolak dengan pesan jelas. Pendaftaran ganda pada dokter, jadwal, dan tanggal yang sama ditolak. Kunjungan terbentuk berstatus Terdaftar dengan nomor antrean unik per dokter per tanggal. Bukti pendaftaran ditampilkan. Kirim ulang formulir tidak membuat kunjungan ganda.
- **US-06:** nomor antrean aktif dan status tampil di dasbor. Perubahan status oleh petugas atau dokter tampil tanpa muat ulang halaman.
- **US-07:** pembatalan hanya bisa selama antrean berstatus Menunggu dan paling lambat 2 jam sebelum jam mulai praktik. Kuota jadwal tersedia kembali setelah batal.
- **US-08:** pasien hanya melihat kunjungannya sendiri. Hasil pemeriksaan tampil hanya-baca. Mengganti ID di URL tidak membuka data orang lain.
- **US-09:** pasien dapat mengaktifkan notifikasi lewat tombol. Pasien menerima Web Push saat pendaftaran berhasil, antrean dipanggil, dan kunjungan dibatalkan petugas.

#### Petugas pendaftaran

| ID | Cerita | P |
|---|---|---|
| US-10 | Sebagai petugas, saya ingin mencari atau mendaftarkan pasien baru (boleh tanpa akun). | P0 |
| US-11 | Sebagai petugas, saya ingin mendaftarkan kunjungan walk-in. | P0 |
| US-12 | Sebagai petugas, saya ingin mengonfirmasi kehadiran pasien (check-in). | P0 |
| US-13 | Sebagai petugas, saya ingin memanggil, melewati, atau membatalkan antrean. | P0 |
| US-14 | Sebagai petugas, saya ingin mengoreksi data administratif kunjungan dan pasien. | P0 |
| US-15 | Sebagai petugas, saya ingin menerima notifikasi pendaftaran daring baru dan melihat rekap administrasi harian. | P0 / P1 |

Kriteria penerimaan:

- **US-10:** pencarian berdasarkan nama, nomor rekam medis, NIK, atau telepon. Pasien walk-in tersimpan tanpa akun. Nomor rekam medis unik.
- **US-11:** aturan kuota, anti-ganda, dan penomoran identik dengan pendaftaran daring. Sumber kunjungan `walk_in`.
- **US-12:** status kunjungan menjadi Hadir. Antrean hanya dapat dipanggil setelah check-in.
- **US-13:** urutan status Menunggu, Dipanggil, Sedang Diperiksa, Selesai. Pasien yang tidak hadir saat dipanggil ditandai Dilewati. Pelewatan dan pembatalan wajib mencatat alasan. Pembatalan mengembalikan kuota.
- Petugas tidak dapat membaca atau mengubah pemeriksaan dan tindakan.

#### Dokter

| ID | Cerita | P |
|---|---|---|
| US-16 | Sebagai dokter, saya ingin melihat antrean pasien milik saya. | P0 |
| US-17 | Sebagai dokter, saya ingin memanggil pasien dan memulai pemeriksaan. | P0 |
| US-18 | Sebagai dokter, saya ingin mencatat hasil pemeriksaan. | P0 |
| US-19 | Sebagai dokter, saya ingin mencatat tindakan medis pada pemeriksaan. | P0 |
| US-20 | Sebagai dokter, saya ingin menyelesaikan kunjungan. | P0 |
| US-21 | Sebagai dokter, saya ingin melihat riwayat pasien yang pernah saya tangani. | P0 |

Kriteria penerimaan:

- **US-16 dan US-17:** hanya kunjungan dan antrean milik dokter tersebut yang terlihat. Status berpindah ke Dipanggil lalu Sedang Diperiksa.
- **US-18:** mencakup anamnesis, tanda vital (rentang nilai divalidasi), diagnosis, dan catatan. Tersimpan beserta waktu dan identitas dokter.
- **US-19:** satu pemeriksaan dapat memiliki beberapa tindakan, masing-masing dengan nama, keterangan, dan saran.
- **US-20:** kunjungan dan antrean menjadi Selesai. Penyelesaian ditolak bila belum ada catatan pemeriksaan.
- **US-21:** riwayat dibatasi pada kunjungan yang ditangani dokter itu sendiri.

#### Admin

| ID | Cerita | P |
|---|---|---|
| US-22 | Sebagai admin, saya ingin mengelola data dokter. | P0 |
| US-23 | Sebagai admin, saya ingin mengelola layanan. | P0 |
| US-24 | Sebagai admin, saya ingin mengelola jadwal praktik dan kuota. | P0 |
| US-25 | Sebagai admin, saya ingin membuat akun petugas dan dokter, menetapkan peran, dan menonaktifkan akun. | P0 |
| US-26 | Sebagai admin, saya ingin mengelola profil klinik. | P0 |
| US-27 | Sebagai admin, saya ingin melihat rekap kunjungan per periode, dokter, layanan, dan status. | P0 |
| US-28 | Sebagai admin, saya ingin memantau pekerjaan notifikasi dan penyebab kegagalannya. | P0 |
| US-29 | Sebagai admin, saya ingin mengekspor rekap ke PDF atau Excel. | P1 |
| US-30 | Sebagai admin, saya ingin melihat log aktivitas. | P1 |

Kriteria penerimaan:

- **US-22:** nama, spesialisasi, nomor izin praktik (unik), foto (diunggah ke Supabase Storage), deskripsi, dan layanan yang dilayani.
- **US-24:** jadwal yang bentrok untuk dokter yang sama ditolak. Kuota lebih dari 0. Jam selesai setelah jam mulai.
- **US-25:** akun hanya dibuat admin lewat pemrosesan sisi server. Kunci `service_role` tidak pernah di browser. Akun nonaktif tidak dapat login.
- **US-27:** angka rekap dihitung dari database dan konsisten dengan daftar kunjungan.
- **US-28:** daftar menampilkan status menunggu, berhasil, gagal, jumlah percobaan, dan penyebab kegagalan.
- Admin tidak membaca isi pemeriksaan.

---

## 5. Kebutuhan fungsional rinci

### 5.1 Aturan bisnis inti

| Kode | Aturan |
|---|---|
| BR-01 | Kuota adalah batas kunjungan aktif (tidak dibatalkan) pada satu jadwal di satu tanggal. Sisa kuota = kuota dikurangi kunjungan aktif. |
| BR-02 | Satu pasien tidak boleh punya lebih dari satu kunjungan aktif pada jadwal dan tanggal yang sama. |
| BR-03 | Nomor antrean unik per dokter dan tanggal, dibuat otomatis oleh sistem, tidak dapat ditentukan pengguna. |
| BR-04 | Pengecekan kuota dan pengambilan nomor antrean dilakukan dalam satu transaksi dengan penguncian baris agar dua pendaftar serentak tidak melampaui kuota atau mendapat nomor sama. |
| BR-05 | Antrean hanya dapat dipanggil setelah check-in (status kunjungan Hadir). |
| BR-06 | Status antrean berjalan berurutan: Menunggu → Dipanggil → Sedang Diperiksa → Selesai. Menunggu dapat langsung ke Dibatalkan. Dipanggil dapat ke Dilewati atau Dibatalkan. |
| BR-07 | Status kunjungan berjalan: Terdaftar → Hadir → Selesai. Terdaftar atau Hadir dapat ke Dibatalkan. |
| BR-08 | Pasien hanya dapat membatalkan kunjungan selama antrean Menunggu dan paling lambat 2 jam sebelum jam mulai praktik. |
| BR-09 | Kunjungan tidak dapat diselesaikan sebelum ada catatan pemeriksaan. |
| BR-10 | Pemeriksaan hanya dapat disimpan saat antrean berstatus Sedang Diperiksa, dan hanya oleh dokter pemilik kunjungan. |
| BR-11 | Peran dan status aktif hanya dapat diubah admin. Admin tidak dapat mengubah peran atau status akunnya sendiri. |
| BR-12 | Pasien walk-in boleh tanpa akun. Pasien berakun terhubung ke profil lewat `profile_id`. |
| BR-13 | Tanggal kunjungan harus sesuai hari praktik jadwal (0 = Minggu sampai 6 = Sabtu), tidak boleh di masa lalu, dan pada hari ini harus sebelum jam selesai praktik. |
| BR-14 | Dokter harus aktif dan harus melayani layanan yang dipilih. |
| BR-15 | Pelewatan dan pembatalan antrean wajib memuat alasan. |
| BR-16 | Dokter yang dinonaktifkan tidak tampil di halaman publik dan tidak dapat dipilih. Akun loginnya ikut nonaktif. |
| BR-17 | Nomor rekam medis, nomor referensi kunjungan, nomor izin praktik, dan NIK bersifat unik. |
| BR-18 | Tanda vital hanya boleh memuat kunci `sistolik` (50-300), `diastolik` (30-200), `suhu` (30-45), `berat_badan` (1-500), `tinggi_badan` (20-250), seluruhnya angka. |

### 5.2 Nilai referensi

| Objek | Nilai |
|---|---|
| Peran | pasien, petugas, dokter, admin |
| Sumber kunjungan | online, walk_in |
| Status kunjungan | terdaftar, hadir, selesai, batal |
| Status antrean | menunggu, dipanggil, diperiksa, selesai, dilewati, batal |
| Hari praktik | 0 Minggu, 1 Senin, 2 Selasa, 3 Rabu, 4 Kamis, 5 Jumat, 6 Sabtu |

### 5.3 Input per aktor

**Pasien**
- Registrasi: nama lengkap, NIK (wajib, 16 digit), tanggal lahir, jenis kelamin (L atau P), nomor telepon aktif, email, kata sandi (minimal 8 karakter).
- Login: email dan kata sandi.
- Ubah profil: alamat, telepon, kontak darurat.
- Pendaftaran kunjungan: layanan, dokter, tanggal, sesi jadwal, keluhan utama (1 sampai 500 karakter).
- Pembatalan kunjungan beserta alasan.
- Izin notifikasi: hanya diminta setelah pasien menekan tombol Aktifkan Notifikasi.

**Petugas**
- Pasien baru (boleh tanpa akun) atau pencarian pasien lama.
- Pendaftaran walk-in pada dokter dan sesi tertentu.
- Perubahan status antrean beserta alasan pelewatan atau pembatalan.
- Check-in dan koreksi data administratif.
- Izin notifikasi pada perangkat petugas untuk pendaftaran daring baru.

**Dokter**
- Anamnesis, tanda vital (tekanan darah, suhu, berat badan, tinggi badan), diagnosis, catatan.
- Tindakan: nama tindakan, keterangan, saran atau instruksi lanjutan.
- Perubahan status antrean: memanggil, memulai pemeriksaan, menyelesaikan.

**Admin**
- Dokter: nama, spesialisasi, nomor izin praktik, foto, deskripsi, layanan yang dilayani.
- Layanan: nama, deskripsi, estimasi durasi (menit).
- Jadwal praktik: dokter, hari, jam mulai, jam selesai, kuota per sesi.
- Pengguna: pembuatan akun, penetapan peran (petugas, dokter, admin), kata sandi awal, aktif atau nonaktif.
- Profil klinik: nama, deskripsi, alamat, koordinat, kontak, jam operasional.
- Parameter rekap: periode, dokter, layanan.

### 5.4 Proses utama

**Autentikasi**
1. Registrasi divalidasi (email unik, format telepon, kekuatan kata sandi, NIK).
2. Akun dibuat di Supabase Auth. Profil berperan pasien dan data pasien terbentuk otomatis lewat trigger database.
3. Login diverifikasi Supabase Auth. Backend membaca profil, memeriksa status aktif, lalu mengembalikan token dan peran. Frontend mengarahkan ke dashboard sesuai peran. Pengunjung tanpa sesi yang membuka dashboard diarahkan ke login.
4. Rate limiting berlaku pada login, registrasi, pendaftaran kunjungan, dan langganan push.

**Penyajian informasi publik.** Profil klinik, layanan aktif, dokter aktif, jadwal aktif, lokasi, dan jam operasional dibaca dari database tanpa login. Tombol pendaftaran mengarahkan pengunjung belum login ke login atau registrasi.

**Pendaftaran kunjungan**
1. Sistem menampilkan dokter dan sesi dengan sisa kuota.
2. Dalam satu transaksi: periksa jadwal aktif, kecocokan hari, dokter aktif, layanan yang dilayani dokter, kunjungan ganda, dan kuota dengan penguncian baris.
3. Buat kunjungan berstatus Terdaftar dan nomor antrean berikutnya untuk dokter dan tanggal itu.
4. Kembalikan bukti pendaftaran: nomor referensi, nomor antrean, dokter, layanan, tanggal, dan sesi.
5. Dalam transaksi yang sama, database mencatat notifikasi konfirmasi dan pemberitahuan pendaftaran baru untuk petugas.

**Antrean dan administrasi**
1. Daftar antrean per dokter dan tanggal tampil untuk petugas dan dokter, dan diperbarui lewat polling atau Server-Sent Events.
2. Petugas check-in: status kunjungan menjadi Hadir.
3. Memanggil: antrean Menunggu menjadi Dipanggil, hanya bila pasien sudah Hadir.
4. Memeriksa: dokter mengubah Dipanggil menjadi Sedang Diperiksa.
5. Melewati: Dipanggil menjadi Dilewati dengan alasan.
6. Membatalkan: antrean dan kunjungan menjadi Dibatalkan dengan alasan, kuota kembali.

**Pemeriksaan dan tindakan.** Hanya dokter pemilik kunjungan yang dapat menyimpan pemeriksaan dan tindakan. Penyimpanan, perubahan status kunjungan menjadi Selesai, dan perubahan status antrean menjadi Selesai terjadi dalam satu transaksi. Penyimpanan ditolak bila antrean tidak berstatus Sedang Diperiksa atau tanda vital di luar rentang.

**Riwayat dan rekap.** Riwayat dibatasi per peran: pasien miliknya sendiri, dokter pasien yang ia tangani. Rekap dihitung dari database per hari, minggu, bulan, dokter, layanan, dan status.

**Pengelolaan data master dan pengguna.** Data divalidasi sebelum disimpan, termasuk pencegahan jadwal bentrok. Foto dokter divalidasi jenis (JPG, PNG, WebP) dan ukuran (misalnya maksimum 2 MB) di server, lalu disimpan ke Supabase Storage. Akun staf dibuat di server dengan kunci `service_role`.

### 5.5 Output per aktor

- **Pengunjung dan pasien:** halaman informasi klinik, pesan keberhasilan atau kegagalan, bukti pendaftaran, status antrean beserta nomor yang sedang dilayani dan jumlah antrean di depan, notifikasi Web Push, riwayat kunjungan pribadi dengan ringkasan hasil.
- **Petugas:** daftar antrean harian per dokter dan sesi dengan status dan keluhan utama, hasil pencarian pasien, notifikasi pendaftaran baru, daftar pekerjaan notifikasi.
- **Dokter:** daftar antrean pribadi (menunggu, diperiksa, selesai), ringkasan riwayat pasien yang ditangani, catatan pemeriksaan dan tindakan.
- **Admin:** dashboard data master dan pengguna, rekap kunjungan (tabel dan grafik), daftar pekerjaan notifikasi dengan penyebab gagal.

### 5.6 Alur uji minimum (sepuluh langkah)

Harus dapat dijalankan dari antarmuka sampai database pada URL deployment, dengan akun uji tiap peran dan worker berjalan sebagai proses terpisah.

| Langkah | Aktor | Tindakan | Hasil yang diharapkan |
|---|---|---|---|
| 1 | Pasien | Menekan Aktifkan Notifikasi dan memberi izin | Subscription tersimpan di `push_subscriptions` dan terhubung ke pasien |
| 2 | Pasien | Login, memilih layanan, dokter, tanggal dan sesi, lalu mengirim pendaftaran | Kunjungan Terdaftar, nomor antrean unik tampil. Notifikasi diproses worker dan muncul di browser pasien dan petugas. |
| 3 | Pasien | Membuka dasbor | Nomor antrean aktif dan status Menunggu terlihat |
| 4 | Petugas | Membuka antrean hari itu dan check-in | Status kunjungan Hadir |
| 5 | Petugas | Memanggil antrean pasien | Status Dipanggil, tampil di dasbor pasien tanpa muat ulang. Pasien menerima Web Push, klik membuka dasbor antrean. |
| 6 | Dokter | Membuka antrean pribadi dan memulai pemeriksaan | Status Sedang Diperiksa. Hanya pasien dokter itu yang terlihat. |
| 7 | Dokter | Mengisi pemeriksaan dan tindakan, menyimpan, menyelesaikan | Antrean dan kunjungan Selesai, catatan tersimpan |
| 8 | Pasien | Membuka riwayat | Kunjungan dan ringkasan tampil. Pasien lain tidak dapat melihat. |
| 9 | Admin | Membuka rekap kunjungan | Jumlah konsisten dengan daftar kunjungan |
| 10 | Admin atau petugas | Membuka daftar pekerjaan notifikasi | Pekerjaan berhasil dan gagal tampil beserta jumlah percobaan dan penyebab kegagalan |

**Pengujian tambahan pada alur ini**
- Pendaftaran pada jadwal berkuota penuh ditolak dengan pesan jelas.
- Pendaftaran ganda pada dokter, jadwal, dan tanggal yang sama ditolak.
- Pengiriman ulang formulir tidak menghasilkan kunjungan ganda.
- Pengunjung belum login yang membuka dashboard diarahkan ke login.
- Mengganti ID pada URL atau permintaan tidak memberi akses ke data pengguna lain.
- Pengguna biasa tidak dapat mengubah perannya lewat formulir profil.
- Data tetap ada setelah refresh, logout lalu login, dan akses dari perangkat lain.
- Permintaan langsung ke endpoint tanpa frontend (curl atau Postman) ditolak bila tidak valid.
- Data tidak valid ditolak constraint database, dan tiga lapisan validasi dapat didemonstrasikan independen.
- Subscription tidak valid (404 atau 410) dinonaktifkan dan pekerjaan gagal tercatat tanpa menghentikan worker.
- Worker dapat dihentikan lalu dijalankan kembali tanpa kehilangan pekerjaan.
- Kegagalan push, termasuk saat Redis tidak tersedia, tidak membatalkan kunjungan yang sudah tersimpan.

### 5.7 Kebutuhan wajib dan opsional

**Wajib (P0)**
1. Halaman publik lengkap.
2. Registrasi, login, logout, dan profil pasien.
3. Pendaftaran kunjungan daring dan walk-in, dengan kuota, anti-ganda, dan nomor antrean per dokter per tanggal.
4. Pembatalan oleh pasien dan petugas.
5. Check-in, memanggil, melewati, dan membatalkan antrean.
6. Pemeriksaan dan tindakan oleh dokter, penyelesaian kunjungan.
7. Riwayat kunjungan sesuai hak akses.
8. Pengelolaan dokter, layanan, jadwal, pengguna, profil klinik, termasuk unggah foto dokter.
9. Rekap kunjungan dari database.
10. Web Push nyata dengan Service Worker, VAPID, worker, dan antrean persisten, terhubung ke empat kejadian bisnis (bagian 7).
11. Validasi tiga lapis, pencarian atau filter, pagination, dan umpan balik di seluruh antarmuka.
12. Rate limiting, logging terstruktur, penelusuran error termasuk pada worker.
13. Migration files, seed, dan dokumentasi lengkap.

**Opsional (P1, setelah semua P0 lulus uji)**
- Notifikasi giliran hampir tiba dan pengingat H-1 (pemicu giliran hampir tiba sudah ada di database).
- Ekspor rekap PDF atau Excel.
- Log aktivitas dan audit.
- Lampiran berkas privat pada pemeriksaan.
- Rekap administrasi harian petugas.
- ESLint, pemeriksaan tipe, dan CI/CD.
- Tracing OpenTelemetry dan dashboard metrik.

---

## 6. Alur pengguna dan sequence diagram

### 6.1 Alur pengguna (user flow) per aktor

#### Alur pasien

1. **Mulai.** Pasien melihat informasi klinik.
2. Keputusan: ingin mendaftar kunjungan? Bila tidak, selesai.
3. Bila ya, keputusan: sudah punya akun? Bila belum, pasien mengisi formulir registrasi lalu sistem memproses registrasi pasien. Setelah itu pasien masuk ke langkah login. Bila sudah punya akun, langsung ke login.
4. Pasien memasukkan email dan kata sandi. Sistem memvalidasi login. Bila gagal, tampil pesan gagal dan kembali ke input kredensial. Bila berhasil, tampil dashboard pasien.
5. Pasien memilih layanan, dokter, tanggal, jadwal, dan mengisi keluhan. Sistem memvalidasi kuota dan pendaftaran ganda.
6. Keputusan: kuota tersedia dan tidak duplikat? Bila tidak, tampil pesan kesalahan dan pasien memilih ulang. Bila ya, sistem menyimpan kunjungan dan membuat nomor antrean, lalu menampilkan bukti pendaftaran dan nomor antrean.
7. Pasien melihat status antrean. Keputusan: ingin membatalkan sebelum dipanggil? Bila tidak, pasien menunggu check-in dan panggilan. Bila ya, keputusan: konfirmasi pembatalan? Bila tidak, kembali ke status antrean. Bila ya, sistem memperbarui status menjadi batal dan menampilkan riwayat kunjungan.
8. **Selesai.**

#### Alur petugas pendaftaran

1. Petugas memasukkan kredensial. Sistem memvalidasi login dan role. Bila gagal, tampil pesan gagal. Bila berhasil, tampil dashboard petugas.
2. Keputusan: jenis proses?
   - **Online:** petugas membuka daftar kunjungan, lalu memilih pasien dan memverifikasi kehadiran.
   - **Walk-in:** petugas mencari pasien berdasarkan nama atau nomor. Keputusan: pasien ditemukan? Bila ya, memilih data pasien. Bila tidak, mengisi formulir pasien baru, sistem menyimpan data pasien, lalu memilih data pasien. Petugas memilih layanan, dokter, jadwal, dan mengisi keluhan. Sistem memvalidasi kuota dan kunjungan ganda. Bila tidak valid, tampil pesan kesalahan dan petugas mengulang pilihan. Bila valid, sistem menyimpan kunjungan dan nomor antrean, lalu masuk ke verifikasi kehadiran.
3. Keputusan: pasien hadir? Bila tidak, tampil antrean yang belum check-in dan kembali ke dashboard. Bila ya, sistem memperbarui kunjungan menjadi hadir dan menampilkan dashboard antrean.
4. Keputusan: pilih tindakan antrean.
   - **Panggil:** status menjadi dipanggil.
   - **Lewati:** petugas memasukkan alasan, status menjadi dilewati.
   - **Batalkan:** petugas memasukkan alasan, status menjadi batal.
5. Sistem menampilkan status terbaru, lalu kembali ke dashboard petugas.

#### Alur dokter

1. Dokter memasukkan kredensial. Sistem memvalidasi login dan role. Bila berhasil, tampil antrean pribadi.
2. Dokter memilih pasien dari antrean. Keputusan: pasien sesuai kewenangan dan siap diperiksa? Bila tidak, tampil informasi atau penolakan akses dan kembali ke antrean pribadi. Bila ya, sistem memulai pemeriksaan dan memperbarui status antrean.
3. Dokter mengisi anamnesis, tanda vital, diagnosis, dan catatan, lalu mengisi tindakan, keterangan, dan saran.
4. Sistem memvalidasi dan menyimpan pemeriksaan serta tindakan. Bila gagal, tampil pesan kesalahan dan dokter memperbaiki isian.
5. Keputusan: selesaikan kunjungan? Bila tidak, dokter kembali ke pengisian. Bila ya, sistem mengubah status kunjungan dan antrean menjadi selesai dan menampilkan konfirmasi serta detail pemeriksaan.
6. **Selesai.**

#### Alur admin

1. Admin memasukkan kredensial. Sistem memvalidasi login dan role. Bila berhasil, tampil dashboard admin.
2. Keputusan: memilih menu pengelolaan.
   - **Dokter, layanan, jadwal (dokter, hari, jam, kuota), pengguna (akun, role, status aktif), profil klinik (profil, lokasi, jam operasional):** admin mengisi atau mengubah data. Sistem memvalidasi data. Bila tidak valid, tampil pesan validasi dan kembali ke menu. Bila valid, sistem menyimpan perubahan ke database dan menampilkan pesan berhasil.
   - **Rekap kunjungan:** admin memilih periode, dokter, layanan, dan status. Sistem memproses agregasi data kunjungan dan menampilkan grafik dan tabel rekap. Keputusan: perlu ekspor laporan? Bila ya, sistem menyiapkan ekspor PDF atau Excel dan admin mengunduh laporan (prioritas rendah).
   - **Keluar:** selesai.

### 6.2 Sequence diagram

Lima sequence diagram menggambarkan interaksi antara pengguna, antarmuka, server Next.js, Supabase Auth, dan PostgreSQL. **Catatan penyesuaian:** diagram asli menampilkan Supabase Realtime dan akses langsung dari browser ke Supabase Auth. Sesuai keputusan K5 dan K9, pembaruan status dilakukan lewat polling atau Server-Sent Events ke API kita, dan login melewati endpoint backend kita.

#### Diagram 1 — Registrasi dan login

Peserta: Pengunjung atau pasien, frontend, server Next.js, Supabase Auth, PostgreSQL.

1. (opsional, bila belum punya akun) Pengunjung membuka halaman registrasi dan frontend menampilkan formulir.
2. Pengunjung mengisi nama, email, telepon, dan kata sandi. Frontend mengirim data ke server.
3. Server memvalidasi input.
   - **Tidak valid:** server mengirim pesan validasi, frontend menampilkan pesan kesalahan.
   - **Valid:** server meminta Supabase Auth membuat akun pasien. Supabase mengembalikan ID pengguna. Profil dengan role pasien dibuat di PostgreSQL (lewat trigger database). Server mengembalikan hasil registrasi berhasil dan frontend menampilkan konfirmasi.
4. Pengguna membuka halaman login dan memasukkan email dan kata sandi.
5. Kredensial divalidasi oleh Supabase Auth, melalui endpoint login backend.
   - **Berhasil:** frontend mengakses dashboard dengan sesi. Server membaca role dan status aktif dari PostgreSQL, menerima data profil, lalu frontend diarahkan ke dashboard sesuai role.
   - **Gagal:** frontend menampilkan pesan login gagal.

#### Diagram 2 — Pendaftaran kunjungan pasien

Peserta: Pasien, frontend, server, PostgreSQL.

1. Pasien membuka formulir pendaftaran. Frontend meminta layanan, dokter, dan jadwal aktif. Database mengirim data pilihan dan informasi kuota, lalu frontend menampilkannya.
2. Pasien memilih dokter, jadwal, dan mengisi keluhan, lalu menekan Daftar.
3. Frontend mengirim permintaan beserta sesi. Server memeriksa autentikasi dan memvalidasi input.
4. Server memproses pendaftaran dalam satu transaksi. Database memeriksa jadwal, kuota, dan kunjungan aktif ganda.
   - **Kuota penuh atau duplikat:** pendaftaran ditolak, server mengirim pesan kegagalan, frontend menampilkan alasan dan meminta pilihan lain.
   - **Valid:** database menyimpan kunjungan berstatus Terdaftar, membuat antrean dengan nomor unik per dokter dan tanggal, lalu mengembalikan data kunjungan dan antrean. Server mengirim bukti pendaftaran dan frontend menampilkan nomor antrean dan detail kunjungan.

#### Diagram 3 — Check-in dan pengelolaan antrean oleh petugas

Peserta: Petugas, frontend petugas, server, PostgreSQL, dasbor pasien, dasbor dokter.

1. Petugas membuka dashboard antrean. Frontend meminta antrean sesuai tanggal dan filter. Database mengembalikan daftar antrean dan frontend menampilkan pasien dan status antrean.
2. **Check-in:** petugas mengonfirmasi kehadiran. Server memvalidasi dan mengubah status kunjungan menjadi Hadir.
3. **Memanggil:** petugas menekan Panggil. Server memeriksa kehadiran dan status antrean.
   - **Belum check-in atau status tidak valid:** server menolak dan frontend menampilkan pesan.
   - **Siap dipanggil:** status antrean menjadi Dipanggil.
4. **Melewati:** petugas memilih Lewati dan memasukkan alasan. Status menjadi Dilewati beserta alasan.
5. **Membatalkan:** petugas memilih Batalkan dan memasukkan alasan. Server memvalidasi dan membatalkan kunjungan, status pembatalan tersimpan.
6. Setelah setiap perubahan, tampilan antrean di dasbor pasien dan dasbor dokter diperbarui. Pada diagram asli ini lewat Supabase Realtime. **Pada implementasi kita lewat polling atau Server-Sent Events ke API.**

#### Diagram 4 — Pemeriksaan pasien oleh dokter

Peserta: Dokter, frontend dokter, server, PostgreSQL.

1. Dokter membuka dashboard. Frontend meminta antrean milik dokter. Database mengembalikan antrean sesuai hak akses.
2. Dokter memilih pasien dan memulai pemeriksaan. Frontend mengirim ID kunjungan. Server memvalidasi dokter, kunjungan, dan status.
   - **Tidak berwenang atau status tidak sesuai:** akses atau perubahan ditolak, tampil penolakan.
   - **Dapat dimulai:** status antrean menjadi Sedang Diperiksa dan frontend menampilkan formulir pemeriksaan.
3. Dokter mengisi anamnesis dan tanda vital, diagnosis dan catatan, lalu menambahkan tindakan dan saran, kemudian menekan Simpan.
4. Server memvalidasi input, memverifikasi hak akses dokter, lalu menyimpan pemeriksaan dan tindakan.
   - **Gagal:** server mengembalikan error, frontend menampilkan pesan dan mempertahankan input.
   - **Berhasil:** konfirmasi penyimpanan tampil.
5. Dokter menekan Selesaikan Kunjungan. Server memastikan pemeriksaan sudah tersimpan.
   - **Belum tersimpan:** penyelesaian ditolak, dokter diminta melengkapi pemeriksaan.
   - **Sudah tersimpan:** kunjungan dan antrean menjadi Selesai. Frontend menampilkan ringkasan pemeriksaan.

#### Diagram 5 — Pengelolaan data master dan rekap oleh admin

Peserta: Admin, frontend admin, server, Supabase Auth, PostgreSQL.

1. Admin membuka dashboard. Frontend meminta validasi sesi. Server memeriksa role dan status aktif ke PostgreSQL.
   - **Tidak berwenang:** dashboard ditolak dan tampil pesan akses ditolak.
   - **Berwenang:** tampil menu pengelolaan.
2. Admin memilih menu dan mengirim perubahan beserta data formulir. Server memvalidasi bahwa role adalah admin dan isi data valid. Pilihan:
   - **Dokter:** membuat atau mengubah data dokter.
   - **Layanan:** membuat atau mengubah layanan.
   - **Jadwal:** memvalidasi dan menyimpan jadwal praktik (menolak yang bentrok).
   - **Pengguna:** membuat atau mengelola akun lewat server memakai Supabase Auth, lalu menyimpan atau memperbarui profil dan role.
   - **Profil klinik:** memperbarui profil dan lokasi klinik.
3. Server mengembalikan pesan berhasil atau gagal dan frontend memperbarui tampilan.
4. (opsional) **Rekap:** admin memilih periode, dokter, layanan, dan status. Server meminta agregasi data kunjungan. Database menghitung ringkasan dan mengembalikan hasil agregasi. Frontend menampilkan grafik dan tabel rekap.

---

## 7. Web Push Notification dan background worker

Bagian ini adalah kebutuhan wajib dan yang paling besar yang belum dikerjakan. Spesifikasinya disesuaikan dengan database yang sudah ada.

### 7.1 Alur menyeluruh

```text
Kejadian bisnis (daftar, panggil, batal)
   -> transaksi PostgreSQL: perubahan bisnis + baris notifikasi (trigger yang sudah ada)
   -> pemindai/antrean: pekerjaan dimasukkan ke BullMQ (Redis) dengan jobId = id notifikasi
   -> background worker (proses terpisah) membaca push_subscriptions penerima
   -> pustaka web-push + VAPID mengirim ke push service browser
   -> Service Worker menerima event push dan menampilkan notifikasi
   -> notificationclick membuka halaman yang relevan
```

Kegagalan pengiriman **tidak pernah** membatalkan atau me-rollback transaksi bisnis, karena pengantrean dan pengiriman terjadi setelah transaksi bisnis tersimpan.

### 7.2 Langganan (subscription)

1. Pengguna menekan tombol **Aktifkan Notifikasi**. Izin tidak boleh diminta otomatis saat halaman dimuat.
2. Browser meminta izin. Bila diberikan, Service Worker (`/sw.js`) didaftarkan dan `pushManager.subscribe` dipanggil dengan kunci publik VAPID.
3. Frontend mengirim subscription ke backend. Backend menyimpannya di tabel `push_subscriptions` dan menghubungkannya dengan pengguna. Bila endpoint yang sama sudah ada, datanya dipindahkan ke pengguna yang sedang login (upsert).
4. Saat logout, subscription pada perangkat itu dinonaktifkan.
5. Satu pengguna dapat memiliki banyak subscription (satu per perangkat).

### 7.3 Kejadian bisnis pemicu

Database sudah membuat baris notifikasi untuk kejadian berikut lewat trigger pada tabel `antrean`. Keempat kejadian wajib terpenuhi.

| Kode kejadian | Pemicu | Penerima | Isi singkat | Tujuan klik | Kunci anti-ganda |
|---|---|---|---|---|---|
| KUNJUNGAN_TERDAFTAR | Pendaftaran berhasil | Pasien | Nomor antrean dan tanggal | Dasbor pasien | `terdaftar:{kunjungan_id}` |
| PENDAFTARAN_BARU | Pasien mendaftar daring | Semua petugas aktif | Pendaftaran baru, nomor antrean, tanggal | Dasbor antrean petugas | `baru:{kunjungan_id}:{petugas_id}` |
| ANTREAN_DIPANGGIL | Status antrean menjadi Dipanggil | Pasien | Giliran Anda sudah dipanggil | Dasbor pasien | `dipanggil:{antrean_id}` |
| KUNJUNGAN_DIBATALKAN | Antrean atau kunjungan dibatalkan | Pasien | Kunjungan dibatalkan beserta nomor antrean | Riwayat kunjungan | `batal:{kunjungan_id}` |

Kejadian tambahan yang sudah dihasilkan trigger: antrean dilewati (beserta alasan) dan **giliran hampir tiba** (dikirim ke pasien berikutnya saat seseorang dipanggil). Kejadian tambahan ini opsional untuk Web Push.

**Isi notifikasi hanya memuat nomor antrean, nama dokter, dan tanggal.** Keluhan dan diagnosis tidak boleh dimasukkan karena notifikasi dapat tampil di layar kunci.

### 7.4 Penyimpanan pekerjaan (outbox) dan pengantrean

- Baris `notifikasi` dibuat oleh trigger **dalam transaksi yang sama** dengan perubahan antrean. Ini berfungsi sebagai outbox, sehingga pekerjaan tidak hilang walau Redis mati.
- `id` notifikasi dipakai sebagai `jobId` BullMQ, sehingga satu notifikasi tidak pernah menjadi dua pekerjaan.
- Pemindai di worker berjalan saat start dan setiap 30 detik: mengambil baris notifikasi berstatus menunggu lalu memasukkannya ke antrean. Karena `jobId` sama, memasukkan ulang tidak membuat pekerjaan ganda.
- Opsional untuk mengurangi jeda: trigger memanggil `pg_notify`, worker mendengarkan lewat koneksi session atau direct. Pemindai tetap berjalan sebagai cadangan.

### 7.5 Pengiriman dan penanganan hasil

Worker mengambil pekerjaan, membaca semua subscription aktif milik penerima, dan mengirim memakai `web-push` dengan VAPID.

| Respons push service | Tindakan |
|---|---|
| 201 (diterima) | Status pekerjaan berhasil, waktu proses dicatat. |
| 404 atau 410 | Subscription tidak valid: dinonaktifkan dan tidak di-retry. Bila semua subscription penerima tidak aktif, pekerjaan ditandai gagal dengan alasan tidak ada subscription aktif. |
| 429, 5xx, atau timeout | Retry dengan exponential backoff, maksimal lima percobaan. |
| 400, 401, atau 403 | Tidak di-retry. Ditandai gagal dan dicatat sebagai error (biasanya kunci VAPID salah). |
| Percobaan habis | Ditandai gagal, kolom error terisi, tampil pada daftar penelusuran. |

**Kondisi khusus**
- **Izin ditolak:** tombol berubah menjadi keterangan cara mengaktifkan izin lewat pengaturan browser. Aplikasi tetap berfungsi penuh.
- **Browser tidak mendukung** Service Worker atau Push API: tombol disembunyikan dan diganti pesan informatif.
- **Penerima tanpa subscription** (misalnya pasien walk-in atau yang belum mengaktifkan): tetap menghasilkan pekerjaan berstatus gagal dengan alasan jelas, bukan kegagalan diam-diam.

### 7.6 Perubahan database yang dibutuhkan

**Tabel baru `push_subscriptions`**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid, PK | |
| profile_id | uuid, FK ke `profiles`, ON DELETE CASCADE | Pemilik |
| endpoint | text, UNIQUE, NOT NULL | Endpoint push service |
| p256dh | text, NOT NULL | Kunci publik enkripsi |
| auth | text, NOT NULL | Rahasia autentikasi |
| user_agent | text | Informasi perangkat |
| aktif | boolean, NOT NULL, default true | |
| created_at | timestamptz, default now() | |
| last_success_at | timestamptz | Pengiriman sukses terakhir |

Indeks pada `profile_id`. Pemilik hanya dapat membaca, menambah, dan menghapus miliknya (RLS).

**Kolom tambahan pada `notifikasi`** (menggantikan tabel pekerjaan terpisah)

| Kolom | Tipe | Keterangan |
|---|---|---|
| jenis_kejadian | text, CHECK salah satu dari empat kode wajib atau kode opsional | Diisi oleh fungsi trigger |
| tautan | text | Halaman tujuan saat notifikasi diklik |
| push_status | text, CHECK in (menunggu, berhasil, gagal), default menunggu | Status pekerjaan |
| push_percobaan | int, CHECK >= 0, default 0 | Jumlah percobaan |
| push_error | text | Penyebab gagal |
| push_diproses_at | timestamptz | Waktu selesai diproses |

Indeks pada `(push_status, created_at)` untuk pemindaian dan daftar pekerjaan gagal.

### 7.7 Komponen yang harus dibuat

| Komponen | Isi |
|---|---|
| `public/sw.js` | Menangani event `push` (menampilkan notifikasi) dan `notificationclick` (membuka atau memfokuskan halaman tujuan). |
| Endpoint | `GET /api/push/kunci` (kunci publik VAPID), `POST /api/push/langganan` (upsert), `DELETE /api/push/langganan` (nonaktifkan), `GET /api/admin/pekerjaan-notifikasi` (daftar dan filter status). |
| `worker/index.js` | Pemindai, pemroses antrean, pengiriman, pembaruan status, log Pino. Dijalankan terpisah dengan `npm run worker`. |
| Variabel lingkungan | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `REDIS_URL`, `DATABASE_URL` (koneksi session atau direct untuk worker). Kunci dibuat dengan `npx web-push generate-vapid-keys`. Kunci privat tidak boleh ke browser atau repository. |
| Dokumentasi | Cara membuat kunci VAPID, mengisi variabel, menjalankan Redis, dan menjalankan worker. |

### 7.8 Bukti yang harus bisa ditunjukkan

1. Subscription tersimpan setelah pasien memberi izin.
2. Pendaftaran kunjungan menghasilkan notifikasi di browser pasien dan petugas lewat worker.
3. Memanggil antrean menghasilkan notifikasi ke pasien, dan klik membuka dasbor.
4. Subscription dengan endpoint palsu dikembalikan 404 atau 410, lalu dinonaktifkan.
5. Pekerjaan gagal tampil di daftar beserta penyebab dan jumlah percobaan.
6. Worker dihentikan lalu dijalankan lagi: pekerjaan yang menunggu tetap terkirim, tanpa kirim ganda.
7. Redis dimatikan sebentar: pendaftaran kunjungan tetap berhasil dan notifikasi terkirim setelah Redis pulih.

---

## 8. Arsitektur sistem final

### 8.1 Gambaran

```text
Browser (Pasien/Petugas/Dokter/Admin)
   │  HTTPS (hanya bicara ke backend kita)
   ▼
Next.js di Vercel
   ├─ middleware        : cek sesi sebelum /dashboard, arahkan ke /login
   ├─ halaman React     : publik + dashboard per peran (JavaScript, Tailwind)
   └─ Route Handlers    : Zod → otorisasi → aturan bisnis → transaksi Drizzle
         │                   │                    │
         ▼                   ▼                    ▼
   Supabase Auth      PostgreSQL (Supabase)   Supabase Storage
   (verifikasi kata   tabel, constraint,      (foto dokter; hanya
    sandi, token)     RLS, trigger, outbox     path di tabel)
                            │
                            │ baris notifikasi (outbox) dibuat trigger
                            ▼
        Worker (Railway/Render, proses terpisah)
          ├─ pemindai tiap 30 detik ──► BullMQ (Redis di Upstash)
          └─ processor ──► web-push + VAPID ──► push service ──► Service Worker ──► notifikasi di browser
```

### 8.2 Tanggung jawab per lapisan

| Lapisan | Tanggung jawab | Tidak boleh |
|---|---|---|
| Frontend | Tampilan, validasi awal (format, wajib, rentang), state loading/kosong/berhasil/gagal, polling atau SSE ke API kita | Memanggil `supabase.from`, `supabase.rpc`, Realtime untuk data. Menyimpan secret. Menjadi satu-satunya validasi. |
| Backend (Route Handlers) | Autentikasi, otorisasi, kepemilikan data, Zod, aturan bisnis BR-01..BR-18, transaksi, rate limiting, logging | Memercayai role, id pemilik, atau status dari client. Membocorkan stack trace atau SQL. |
| Database | PK, FK, NOT NULL, UNIQUE, CHECK, exclusion constraint, RLS, trigger notifikasi, indeks | Menjadi tempat logika bisnis yang dipanggil aplikasi (fungsi `fn_...` tidak dipanggil, K9). |
| Worker | Memindai outbox, mengantrekan, mengirim push, retry, mencatat hasil | Membatalkan transaksi bisnis. Gagal diam-diam. |
| Supabase Auth | Menyimpan hash kata sandi, menerbitkan token | Dipanggil langsung dari browser untuk data bisnis. |
| Supabase Storage | Menyimpan berkas fisik | Menyimpan Base64 di tabel. Kunci `service_role` di browser. |

### 8.3 Autentikasi dan sesi (K1)

1. `POST /api/auth/registrasi`: validasi Zod, buat akun lewat Supabase Auth (server), trigger database membuat `profiles` (peran pasien) dan `pasien`.
2. `POST /api/auth/login`: backend memanggil Supabase Auth, membaca `profiles`, menolak bila `status_aktif = false`, lalu menaruh token pada cookie `httpOnly`, `Secure`, `SameSite=Lax`.
3. `POST /api/auth/logout`: hapus cookie dan nonaktifkan push subscription perangkat itu.
4. Middleware membaca cookie. Tanpa sesi valid, `/dashboard/*` diarahkan ke `/login`. Pemeriksaan peran tetap diulang di setiap Route Handler.
5. Akun staf dibuat admin lewat `POST /api/admin/pengguna` memakai `service_role` di server.

### 8.4 Pola umum Route Handler

```text
1. rate limit (bila endpoint rentan)
2. ambil sesi → 401 bila tidak ada
3. cek peran → 403 bila tidak berhak
4. parse body/query dengan Zod → 400 + pesan Indonesia per field
5. cek kepemilikan/kewenangan data → 403/404 (jangan bocorkan keberadaan data orang lain)
6. jalankan aturan bisnis dalam transaksi Drizzle → 409/422 untuk pelanggaran aturan
7. log Pino (id, durasi, hasil; tanpa data sensitif) → respons JSON seragam
```

Bentuk respons seragam: sukses `{ ok: true, data }`, gagal `{ ok: false, kode, pesan, galat? }`. Error tak terduga hanya mengembalikan pesan umum, detail masuk log.

### 8.5 Pembaruan status antrean (K5)

Dasbor pasien, petugas, dan dokter memakai polling 5 detik ke `GET /api/antrean/...` (atau SSE bila waktu cukup). Polling dihentikan saat tab tidak terlihat. Data antrean tidak di-cache lama.

### 8.6 Hosting dan lingkungan (K6)

| Komponen | Tempat | Catatan |
|---|---|---|
| Aplikasi Next.js | Vercel | HTTPS otomatis, env di dashboard Vercel |
| Worker | Railway atau Render | Proses hidup terus, `npm run worker` |
| Redis | Upstash | `REDIS_URL` dengan TLS (`rediss://`) |
| PostgreSQL, Auth, Storage | Supabase | Worker memakai koneksi session/direct, bukan transaction pooler, bila memakai `LISTEN` |

---

## 9. Perancangan database

### 9.1 Daftar tabel (selaras ERD)

| Tabel | Fungsi | Kolom kunci | Status |
|---|---|---|---|
| `auth.users` | Akun dan hash kata sandi (dikelola Supabase) | id, email | Supabase |
| `profiles` | Profil dan peran | id (= auth.users.id), nama, telepon, role, status_aktif | Wajib |
| `pasien` | Data pasien termasuk walk-in | id, profile_id (boleh null), no_rekam_medis, nama, nik, tanggal_lahir, jenis_kelamin, alamat, telepon, kontak_darurat | Wajib |
| `dokter` | Data dokter | id, profile_id, nama, spesialisasi, no_sip, foto_path, deskripsi, aktif | Wajib |
| `layanan` | Layanan klinik | id, nama_layanan, deskripsi, durasi_menit, aktif | Wajib |
| `dokter_layanan` | Relasi dokter dan layanan | dokter_id, layanan_id (PK gabungan) | Wajib |
| `jadwal_praktik` | Hari, jam, kuota | id, dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif | Wajib |
| `profil_klinik` | Profil, lokasi, jam operasional | id, nama, deskripsi, alamat, latitude, longitude, kontak, jam_operasional (jsonb) | Wajib |
| `kunjungan` | Pendaftaran kunjungan | id, no_referensi, pasien_id, dokter_id, layanan_id, jadwal_id, dibuat_oleh, tanggal, keluhan, sumber, status, created_at | Wajib |
| `antrean` | Nomor dan status antrean | id, kunjungan_id, dokter_id, tanggal, nomor_antrean, status, alasan, waktu_dipanggil | Wajib |
| `pemeriksaan` | Hasil pemeriksaan | id, kunjungan_id, dokter_id, anamnesis, tanda_vital (jsonb), diagnosis, catatan, created_at | Wajib |
| `tindakan` | Tindakan medis | id, pemeriksaan_id, nama_tindakan, keterangan, saran | Wajib |
| `notifikasi` | Notifikasi dalam aplikasi sekaligus outbox Web Push | id, profile_id, pesan, is_read, created_at, + kolom push (9.3) | Wajib |
| `push_subscriptions` | Subscription per perangkat | lihat 7.6 | **Wajib, baru** |
| `lampiran_pemeriksaan` | Lampiran privat | id, pemeriksaan_id, file_path, nama_file, mime_type, ukuran_bytes | P1 (K15), ada di ERD |
| `log_aktivitas` | Audit | id, profile_id, aksi, objek, waktu, ip_address | P1 (K15), ada di ERD |

Tabel `sesi` dan kolom `password_hash` **tidak dibuat** (K1). Tabel `notifikasi_job` **tidak dibuat**, status pekerjaan menjadi kolom pada `notifikasi` (K13).

### 9.2 Constraint wajib (lapisan validasi ketiga)

| Tabel | Constraint |
|---|---|
| `profiles` | `role` CHECK in (pasien, petugas, dokter, admin). FK ke `auth.users`. |
| `pasien` | `no_rekam_medis` UNIQUE. `nik` UNIQUE, NOT NULL, CHECK `nik ~ '^[0-9]{16}$'` (K10). `jenis_kelamin` CHECK in (L, P). `profile_id` UNIQUE bila tidak null. |
| `dokter` | `no_sip` UNIQUE NOT NULL. |
| `layanan` | `durasi_menit` CHECK > 0. |
| `jadwal_praktik` | `hari` CHECK 0..6. `kuota` CHECK > 0. `jam_selesai > jam_mulai`. Exclusion constraint: jadwal dokter sama, hari sama, rentang jam tumpang tindih ditolak (butuh `btree_gist`). |
| `kunjungan` | `no_referensi` UNIQUE. `sumber` CHECK in (online, walk_in). `status` CHECK in (terdaftar, hadir, selesai, batal). Unique partial index `(pasien_id, jadwal_id, tanggal) WHERE status <> 'batal'` untuk menolak kunjungan aktif ganda. FK ke pasien, dokter, layanan, jadwal. |
| `antrean` | `UNIQUE (dokter_id, tanggal, nomor_antrean)`. `kunjungan_id` UNIQUE. `status` CHECK in (menunggu, dipanggil, diperiksa, selesai, dilewati, batal). |
| `pemeriksaan` | `kunjungan_id` UNIQUE. `tanda_vital` CHECK rentang BR-18 (kunci terbatas, angka dalam rentang). |
| `notifikasi` | `push_status` CHECK in (menunggu, berhasil, gagal). `push_percobaan` CHECK >= 0. `jenis_kejadian` CHECK. |
| `push_subscriptions` | `endpoint` UNIQUE NOT NULL. FK `profile_id` ON DELETE CASCADE. |

### 9.3 Indeks

`antrean(dokter_id, tanggal)`, `kunjungan(pasien_id)`, `kunjungan(jadwal_id, tanggal)`, `kunjungan(tanggal, status)` untuk rekap, `notifikasi(push_status, created_at)`, `push_subscriptions(profile_id)`, `pasien(nama)` dan `pasien(telepon)` untuk pencarian.

### 9.4 Trigger yang ada atau harus ada

| Trigger | Fungsi |
|---|---|
| Pada `auth.users` (insert) | Membuat `profiles` berperan pasien dan baris `pasien` dari metadata registrasi. Peran dipaksa pasien. |
| Pada `antrean` (insert/update) | Membuat baris `notifikasi` untuk empat kejadian wajib (7.3), plus dilewati dan giliran hampir tiba. Wajib mengisi `jenis_kejadian` dan `tautan` setelah migrasi Tahap 2. |
| Cadangan integritas (opsional) | Menolak transisi status yang tidak sah bila ingin lapisan ketiga lebih kuat. |

### 9.5 Transaksi pendaftaran kunjungan (BR-04)

```text
BEGIN
  SELECT ... FROM jadwal_praktik WHERE id = $jadwal FOR UPDATE      -- kunci baris jadwal
  cek: jadwal aktif, hari cocok (BR-13), dokter aktif, dokter melayani layanan (BR-14)
  cek: kunjungan aktif ganda (BR-02)
  hitung kunjungan aktif pada jadwal+tanggal; tolak bila >= kuota (BR-01)
  nomor = COALESCE(MAX(nomor_antrean),0)+1 untuk (dokter, tanggal)  -- aman karena jadwal terkunci
  INSERT kunjungan (status terdaftar, no_referensi dibuat server)
  INSERT antrean (status menunggu)                                  -- trigger membuat baris notifikasi
COMMIT
```

Catatan: bila satu dokter punya beberapa jadwal pada hari yang sama, kunci `jadwal_praktik` tidak cukup untuk nomor antrean per dokter. Kunci pada baris `dokter` (atau advisory lock `(dokter_id, tanggal)`) sehingga nomor tidak ganda. Unique `(dokter_id, tanggal, nomor_antrean)` menjadi jaring pengaman terakhir.

### 9.6 Row Level Security

| Peran | Boleh | Tidak boleh |
|---|---|---|
| Publik | Baca `profil_klinik`, layanan aktif, dokter aktif, jadwal aktif | Menulis apa pun |
| Pasien | Baca dan ubah profil sendiri (kolom terbatas), baca kunjungan/antrean/pemeriksaan sendiri, baca dan hapus `push_subscriptions` sendiri | Data pasien lain, mengubah peran |
| Petugas | Kelola pasien, kunjungan, antrean | Baca `pemeriksaan` dan `tindakan`, kelola data master |
| Dokter | Baca kunjungan/antrean miliknya, baca-tulis `pemeriksaan` dan `tindakan` miliknya | Kunjungan dokter lain |
| Admin | Kelola data master, pengguna, baca rekap | Baca isi pemeriksaan |

**Catatan penting.** RLS tidak berlaku bagi role database yang memiliki `BYPASSRLS` (misalnya `postgres` atau `service_role`). Bila `DATABASE_URL` backend memakai role seperti itu, RLS hanya menjadi dokumentasi. Audit harus memeriksa role koneksi dan memutuskan (lihat pertanyaan terbuka Q1, bagian 16): backend memakai role aplikasi tanpa `BYPASSRLS` dengan `SET LOCAL` klaim pengguna per transaksi, atau RLS tetap dipertahankan sebagai lapisan bagi akses langsung dan keputusan itu dijelaskan jujur saat demo.

### 9.7 Migrasi dan seed

- Migrasi Drizzle berurutan di `drizzle/` (atau folder yang sudah ada). Migrasi lama tidak diedit.
- Seed terpisah dari migrasi (`npm run db:seed`), dapat dijalankan ulang (idempoten) dan hanya berisi data fiktif.
- Akun uji dibuat lewat Supabase Auth Admin API di skrip seed, bukan `INSERT` ke `auth.users`.
- DB harus dapat dibuat ulang dari proyek Supabase kosong: `db:migrate` lalu `db:seed`.

### 9.8 Komposisi data dummy

Minimal wajib dosen: 5 pasien, 5 jadwal, 5 kunjungan. Target tim (lebih kaya, selaras SRS):

| Objek | Jumlah | Keterangan |
|---|---|---|
| Pasien | 5+ | Minimal 1 walk-in tanpa akun, 2 berakun |
| Dokter | 5 | Minimal 2 berakun login dan masing-masing punya kunjungan |
| Layanan | 5 | |
| Jadwal praktik | 5+ | Satu berkuota 3 terisi 2, satu berkuota 2 terisi 2 (penuh) |
| Kunjungan + antrean | 12 | Komposisi di bawah. Tersebar pada ≥3 dokter, beberapa tanggal, daring dan walk-in. |
| Pemeriksaan | 5 | Satu per kunjungan selesai |
| Tindakan | 5 | Beberapa pemeriksaan boleh punya >1 |
| Akun uji | 1 admin, 1 petugas, 2 dokter, 2 pasien | Kata sandi uji didokumentasikan di README (data fiktif) |
| Push subscription + notifikasi | contoh | Status menunggu, berhasil, gagal agar halaman penelusuran dapat diuji |

| Status antrean | Jumlah | Status kunjungan | Keterangan |
|---|---|---|---|
| Menunggu | 3 | Terdaftar (2), Hadir (1) | Sebagian belum check-in |
| Dipanggil | 1 | Hadir | |
| Sedang diperiksa | 1 | Hadir | |
| Selesai | 5 | Selesai | Masing-masing punya pemeriksaan, total 5 tindakan |
| Dilewati | 1 | Hadir | Dengan alasan |
| Dibatalkan | 1 | Batal | Dengan alasan |
| **Total** | **12** | | |

---

## 10. Kebutuhan non-fungsional dan keamanan

| Kategori | Kebutuhan | Cara memenuhi |
|---|---|---|
| Keamanan akun | Sesi valid untuk dashboard, peran tidak dapat diubah sendiri | Cookie httpOnly, middleware, cek peran di server, kolom `role` hanya ditulis endpoint admin |
| Otorisasi data | Ganti ID di URL tidak membuka data orang lain | Setiap query difilter kepemilikan di server. Respons 404 untuk data milik orang lain. |
| Kredensial | Tidak ada secret di repo/browser | `.env` di `.gitignore`, `.env.example`, grep rutin pada repo dan bundle. Hanya `NEXT_PUBLIC_*` yang boleh di browser (URL dan anon key bila diperlukan, serta kunci publik VAPID). |
| Privasi medis | Petugas dan admin tidak membaca pemeriksaan | Endpoint pemeriksaan hanya untuk dokter pemilik dan pasien pemilik (baca) |
| Privasi notifikasi | Layar kunci tidak membocorkan medis | Isi hanya nomor antrean, dokter, tanggal |
| Rate limiting | Login, registrasi, daftar kunjungan, langganan push | Penghitung berbasis Redis atau memori sebagai awal, respons 429 dengan `Retry-After` |
| Integritas | Tidak ada transaksi ganda | Unique index, transaksi, kunci baris. Tombol dinonaktifkan saat submit. |
| Idempotensi kirim ulang | Klik berulang tidak membuat kunjungan ganda | Unique index anti-ganda (BR-02) menjadi jaring utama. `Idempotency-Key` header opsional (K13). |
| Kinerja | Halaman utama ≤3 detik pada 4G | Halaman publik di-render server dengan revalidasi singkat, gambar dioptimalkan, query beragregasi |
| Kegunaan | Responsif, keyboard, state UI lengkap | Tailwind, komponen tabel yang menggulir pada ponsel, fokus terlihat |
| Observabilitas | Error dan pekerjaan worker dapat ditelusuri | Pino terstruktur (id request, id notifikasi, durasi, percobaan), tanpa data sensitif |
| Pemeliharaan | Dapat dibangun ulang dari dokumentasi | README, migrasi, seed, `.env.example` |
| Ketersediaan | Semua layanan aktif saat demo | Daftar periksa pra-demo (14.6): proyek Supabase tidak tidur, worker dan Redis hidup |

---

## 11. Antarmuka pengguna dan katalog API

> Nama rute di bawah adalah **rancangan target**. Bila kode yang ada sudah memakai nama lain, pertahankan nama yang ada dan catat padanannya di `docs/STATUS.md`. Jangan mengganti nama tanpa alasan.

### 11.1 Halaman

| Area | Rute | Isi |
|---|---|---|
| Publik | `/` | Profil, layanan, dokter, jadwal, lokasi (peta), jam operasional, tombol Daftar Kunjungan |
| Publik | `/layanan`, `/layanan/[id]`, `/dokter`, `/dokter/[id]` | Daftar dan detail (URL sendiri, dapat dibuka ulang) |
| Auth | `/login`, `/registrasi` | Formulir dengan validasi dan state loading |
| Pasien | `/dashboard/pasien` | Antrean aktif, status, tombol Aktifkan Notifikasi |
| Pasien | `/dashboard/pasien/daftar`, `/riwayat`, `/riwayat/[id]`, `/profil` | Pendaftaran bertahap, riwayat, detail hanya-baca, profil |
| Petugas | `/dashboard/petugas/antrean`, `/pasien`, `/walk-in`, `/notifikasi` | Kolom status antrean, pencarian dan walk-in, daftar pekerjaan notifikasi |
| Dokter | `/dashboard/dokter/antrean`, `/pemeriksaan/[kunjunganId]`, `/riwayat` | Antrean pribadi, formulir pemeriksaan dan tindakan, riwayat |
| Admin | `/dashboard/admin/dokter`, `/layanan`, `/jadwal`, `/pengguna`, `/profil-klinik`, `/rekap`, `/notifikasi` | CRUD, rekap, penelusuran pekerjaan |

### 11.2 Katalog endpoint

| Metode dan jalur | Peran | Fungsi |
|---|---|---|
| `GET /api/publik/klinik` `/layanan` `/dokter` `/jadwal` | Publik | Data publik aktif saja |
| `POST /api/auth/registrasi` `/login` `/logout` | Publik/semua | Autentikasi lewat backend |
| `GET/PATCH /api/profil` | Pasien | Ubah alamat, telepon, kontak darurat saja |
| `GET /api/jadwal-tersedia?dokter&tanggal` | Pasien, petugas | Sesi dengan sisa kuota |
| `POST /api/kunjungan` | Pasien | Daftar daring |
| `POST /api/petugas/kunjungan` | Petugas | Daftar walk-in |
| `POST /api/kunjungan/[id]/batal` | Pasien (aturan K11), petugas | Batal dengan alasan |
| `GET /api/kunjungan` `/[id]` | Pasien/dokter/petugas | Daftar dan detail sesuai kepemilikan, dengan filter dan pagination |
| `GET/POST /api/petugas/pasien` | Petugas | Cari dan tambah pasien |
| `PATCH /api/petugas/pasien/[id]` | Petugas | Koreksi data administratif |
| `POST /api/petugas/kunjungan/[id]/checkin` | Petugas | Hadir |
| `GET /api/antrean?tanggal&dokter` | Petugas, dokter, pasien (milik sendiri) | Daftar antrean (dipoll) |
| `POST /api/antrean/[id]/panggil` `/lewati` | Petugas, dokter | Ubah status |
| `POST /api/antrean/[id]/periksa` | Dokter | Mulai pemeriksaan |
| `PUT /api/dokter/pemeriksaan/[kunjunganId]` | Dokter | Simpan pemeriksaan dan tindakan |
| `POST /api/dokter/kunjungan/[id]/selesai` | Dokter | Selesaikan |
| `CRUD /api/admin/dokter` `/layanan` `/jadwal` `/pengguna` `/profil-klinik` | Admin | Data master (unggah foto: multipart ke Supabase Storage) |
| `GET /api/admin/rekap` | Admin | Agregasi dari database |
| `GET /api/push/kunci`, `POST/DELETE /api/push/langganan` | Login | Kunci publik, upsert, nonaktifkan |
| `GET /api/admin/pekerjaan-notifikasi` | Admin, petugas | Daftar pekerjaan dan filter status |

### 11.3 Perilaku UI wajib

Setiap halaman data: skeleton atau spinner saat memuat, keterangan saat kosong, toast atau pesan inline saat berhasil dan gagal, tombol submit nonaktif saat mengirim. Daftar: pencarian atau filter dan pagination. Tabel menggulir horizontal di dalam kontainer pada ponsel. Seluruh alur utama dapat dioperasikan dengan keyboard.

---

## 12. Status implementasi dan analisis kesenjangan

> Hasil audit awal terhadap repository `sehatklinik` (cabang `backend/api`, komit `700724a`, ditambah berkas yang belum di-commit), 4 November 2026. Audit membaca kode, belum menjalankan build atau aplikasi. Tahap 0 di panduan memverifikasi ulang dan memperbarui tabel ini lewat `docs/STATUS.md`.

### 12.1 Yang sudah ada

| Area | Status | Bukti |
|---|---|---|
| Drizzle ORM, `schema.ts` (12 tabel) | Ada | `src/db/schema.ts`, `src/db/index.js` |
| Migrasi SQL 01-08, `scripts/migrate.mjs` | Ada (05 dan folder `db/seed` tidak ada di folder kerja) | `db/migrations/` |
| Constraint DB | Ada: NIK 16 digit unik, exclusion jadwal bentrok, unique kunjungan aktif, unique nomor antrean per dokter+tanggal | migrasi 02, 03 |
| RLS, policy, trigger (profil otomatis, notifikasi dari `antrean`) | Ada | migrasi 04, 07 |
| Auth lewat backend ke Supabase Auth, cek `status_aktif` | Ada | `lib/auth.js`, `api/auth/*` |
| Pendaftaran kunjungan: transaksi, kunci baris dokter, kuota, nomor antrean | Ada | `api/kunjungan/route.js` |
| Query sebagai role `authenticated` (RLS efektif) | Ada, tetapi tidak dipakai di semua route | `lib/rls.js` |
| Pemeriksaan oleh dokter dalam transaksi | Ada | `api/kunjungan/[id]/pemeriksaan` |
| Endpoint publik, pasien, profil, riwayat, notifikasi dalam aplikasi | Ada | `api/public/*`, dst |
| Tidak memanggil `fn_...` dari aplikasi (K9) | Terpenuhi | pencarian kode |

### 12.2 Kesenjangan

| No | Kesenjangan | Rujukan | Tahap |
|---|---|---|---|
| G1 | **Frontend belum terhubung ke API.** `ClinicContext.tsx` memakai data statis `clinic-data.ts` dan `localStorage`, tanpa `fetch`. Tidak ada `middleware` pengalih ke login. | Ketentuan 2, 5, 14 | 1B |
| G2 | **Web Push belum ada** (tabel, `sw.js`, endpoint, worker, BullMQ, Redis, `web-push`). | K4, K13, 3.6e | 2-4 |
| G3 | Zod belum dipakai (validasi manual). | K7 | 1 |
| G4 | Admin masih boleh check-in, batal, dan walk-in, serta panggil/lewati antrean. | K12, K14 | 1 |
| G5 | Aturan batal pasien masih "sebelum check-in", belum "Menunggu dan ≥2 jam sebelum praktik". | K11, BR-08 | 1 |
| G6 | Endpoint admin kurang: layanan, pengguna/akun staf, profil klinik, rekap, unggah foto ke Storage. | US-22..27 | 1 |
| G7 | Rate limiting dan Pino belum ada. | 3.6d, 3.6g | 1 |
| G8 | Seed (12 kunjungan, akun uji) dan migrasi 05 tidak ditemukan. | 9.8 | 5 |
| G9 | Sebagian route memakai `db` langsung tanpa RLS (check-in/batal, antrean, pendaftaran). Putuskan dan dokumentasikan. | 9.6 | 1 |
| G10 | Kecil: `params` belum di-`await` di `kunjungan/[id]` (Next 15), README lama, polling antrean belum ada. | K5 | 1, 1B |
| G11 | Penyimpanan token: login mengembalikan token di body dan API memakai Bearer. Putuskan cookie httpOnly atau penyimpanan lain. | 8.3 | 1B |
| G12 | Deployment Vercel, worker, Redis belum disiapkan. | K6 | 6 |

### 12.3 Kesenjangan terhadap 17 ketentuan umum (ringkas)

Terpenuhi sebagian di lapis backend dan database: 1, 3 (belum ada unggah), 6, 7 (periksa `.env`), 8. Belum terpenuhi karena frontend statis: 2, 5, 10-16. Belum sama sekali: seluruh Web Push (3.6e) dan bukti verifikasi no. 7 dan 8.

---

## 13. Roadmap, risiko, dan checklist

### 13.1 Tahap pengerjaan

| Tahap | Cakupan | Gerbang keluar |
|---|---|---|
| 0 | Audit kode terhadap dokumen, isi `docs/STATUS.md` | Daftar kesenjangan disetujui tim |
| 1 | Penyelarasan backend: Zod, K11, K12, endpoint admin yang kurang, rate limit, Pino, middleware | Uji curl lulus, tidak ada pelanggaran aturan keras |
| 1B | Hubungkan frontend ke API per peran, hapus data statis dan localStorage, polling antrean | Alur 1-9 jalan dari UI ke database lokal |
| 2 | Migrasi Web Push (tabel, kolom, trigger) | Migrasi bersih dari DB kosong, CHECK menolak data buruk |
| 3 | Service Worker, tombol, endpoint push, halaman pekerjaan | Subscription tersimpan, semua kondisi izin tertangani |
| 4 | Worker BullMQ dan kirim push | Tujuh bukti di 7.8 lulus |
| 5 | Seed, uji, UI penguatan, dokumentasi | Alur 10 langkah lulus lokal, dokumen lengkap |
| 6 | Deployment | Alur 10 langkah lulus di URL Vercel |
| 7 | P1 (opsional) | Hanya bila semua P0 lulus |

### 13.2 Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| RLS tidak efektif karena role koneksi | Lapisan 3 klaim palsu | Audit role (9.6), putuskan dan dokumentasikan |
| Nomor antrean ganda saat banyak jadwal per dokter | Data rusak | Kunci per `(dokter, tanggal)` plus unique constraint |
| Redis mati saat demo | Notifikasi tertunda | Outbox di tabel, pemindai mengulang |
| Transaction pooler Supabase tidak mendukung `LISTEN` | `pg_notify` gagal | Pakai koneksi session/direct di worker, pemindai sebagai cadangan |
| Safari iOS hanya push untuk Home Screen | Notifikasi tidak muncul di iOS | Dokumentasikan, uji di Chrome/Edge/Android |
| Proyek Supabase tidur | Demo gagal | Daftar periksa pra-demo |
| Secret terbawa commit | Kebocoran | Grep rutin, `.gitignore`, rotasi bila terjadi |
| Cakupan melebar ke P1 | P0 tidak selesai | Gerbang tahap, P1 hanya di Tahap 7 |
| Agen menyimpang dari K1..K15 | Nilai berkurang | `AGENTS.md`, tinjau diff manusia |
| Tim tidak bisa menjelaskan kode | Nilai berkurang | Minta penjelasan keputusan tiap commit, latihan demo |

### 13.3 Checklist akhir

- [ ] Semua P0 (5.7) selesai dan lulus kriteria penerimaan
- [ ] 17 ketentuan umum terpenuhi dengan bukti
- [ ] 9 butir bukti verifikasi terdokumentasi
- [ ] Alur 10 langkah lulus di URL Vercel
- [ ] Pengujian tambahan (5.6) lulus
- [ ] Worker berjalan terpisah, tujuh bukti 7.8 lulus
- [ ] Tidak ada secret di repo dan bundle
- [ ] README, `.env.example`, ERD, arsitektur, VAPID, daftar fitur dan keterbatasan lengkap
- [ ] Seed dan akun uji tiap peran siap
- [ ] Setiap anggota dapat menjelaskan alur dan keputusan teknis

---

## 14. Panduan teknis

### 14.1 Menjalankan lokal

```bash
git clone <repo> && cd <repo>
npm install
cp .env.example .env.local        # isi nilai asli, jangan di-commit
npm run db:migrate                # terapkan migrasi
npm run db:seed                   # data dummy + akun uji
npm run dev                       # aplikasi web
npm run worker                    # terminal lain: background worker
```

Redis lokal: `docker run -p 6379:6379 redis:7`. Kunci VAPID: `npx web-push generate-vapid-keys`.

### 14.2 Variabel lingkungan (`.env.example`, tanpa nilai asli)

| Variabel | Dipakai oleh | Boleh di browser |
|---|---|---|
| `DATABASE_URL` | App (pooler) dan worker (session/direct) | Tidak |
| `SUPABASE_URL` | App | Boleh bila `NEXT_PUBLIC_` |
| `SUPABASE_SERVICE_ROLE_KEY` | App server saja | **Tidak pernah** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser | Ya |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Worker | **Tidak** |
| `REDIS_URL` | App dan worker | Tidak |
| `SUPABASE_STORAGE_BUCKET` | App | Tidak |
| `BATAS_BATAL_JAM` (opsional, bawaan 2) | App | Tidak |

### 14.3 Struktur repository (target)

```text
app/                 halaman dan Route Handlers
  api/
lib/
  db/ (schema.ts, client)   validasi/ (skema Zod per domain)   auth/   logger.js   rate-limit.js
public/sw.js
worker/index.js
drizzle/             migrasi
scripts/seed.js
docs/                DOKUMEN_INDUK.md, STATUS.md, ARSITEKTUR.md, BUKTI_VERIFIKASI.md
AGENTS.md  README.md  .env.example
```

### 14.4 Kesalahan umum yang harus dihindari

1. Memanggil `supabase.from(...)` di komponen React.
2. Menaruh `SUPABASE_SERVICE_ROLE_KEY` atau `VAPID_PRIVATE_KEY` di variabel `NEXT_PUBLIC_*`.
3. Mempercayai `role` atau `pasien_id` dari body request.
4. Menghitung kuota di luar transaksi atau tanpa kunci.
5. Memasukkan ke antrean BullMQ di dalam transaksi bisnis (harus sesudah commit, outbox sebagai cadangan).
6. Meminta izin notifikasi saat halaman dimuat.
7. Mengedit migrasi lama alih-alih membuat migrasi baru.
8. Menyimpan foto sebagai Base64.
9. Memasukkan keluhan atau diagnosis ke isi notifikasi.
10. Menyatakan "selesai" tanpa menjalankan uji.

### 14.5 Debug cepat

| Gejala | Periksa |
|---|---|
| Notifikasi tak muncul | `push_subscriptions.aktif`, status `notifikasi.push_status`, log worker, izin browser, HTTPS |
| Semua push 401/403 | Pasangan kunci VAPID tidak cocok, `VAPID_SUBJECT` salah |
| Pekerjaan tak diproses | Worker hidup? `REDIS_URL`? Pemindai berjalan? |
| 403 pada aksi valid | Peran sesi, aturan K12/K14 |
| Data orang lain terlihat | Filter kepemilikan di query, role koneksi DB |

### 14.6 Daftar periksa pra-demo

Proyek Supabase aktif, URL Vercel terbuka, worker hidup (log terlihat), Redis terhubung, akun uji tiap peran dapat login, notifikasi diizinkan di browser demo, data seed segar, satu pekerjaan gagal contoh tersedia untuk ditunjukkan.

---

## 15. Strategi pengujian dan bukti verifikasi

### 15.1 Pemetaan sembilan butir bukti

| Butir | Cara membuktikan | Berkas bukti |
|---|---|---|
| 1. Validasi frontend | Kirim formulir kosong dan tidak valid di UI | Rekaman layar + kode skema klien |
| 2. Validasi backend | `curl` langsung dengan body tidak valid, tanpa token, role palsu | Perintah dan keluaran di `BUKTI_VERIFIKASI.md` |
| 3. Constraint DB | `INSERT` langsung SQL yang melanggar CHECK/UNIQUE/FK/exclusion | Pernyataan SQL dan pesan galat |
| 4. Auth, otorisasi, kepemilikan | Dua akun pasien dan dua dokter saling mengakses ID | Hasil 401/403/404 |
| 5. CRUD persisten | Buat, ubah, hapus lalu refresh dan login ulang | Daftar langkah |
| 6. Migrasi dan relasi | DB kosong → migrasi → seed | Log perintah + ERD |
| 7. Web Push via worker | Daftar kunjungan lalu amati worker dan browser | Log worker + tangkapan notifikasi |
| 8. Kegagalan job/subscription | Endpoint palsu → 410, matikan Redis, hentikan worker | Baris `notifikasi` gagal + log |
| 9. Konsistensi dan error | Rekap sama dengan daftar, respons error tanpa bocoran | Perbandingan angka |

### 15.2 Matriks uji otorisasi

| Aksi | Pasien | Petugas | Dokter | Admin | Anonim |
|---|---|---|---|---|---|
| Baca data publik | ✔ | ✔ | ✔ | ✔ | ✔ |
| Daftar kunjungan daring | ✔ (miliknya) | ✘ | ✘ | ✘ | ✘ |
| Daftar walk-in, check-in | ✘ | ✔ | ✘ | ✘ | ✘ |
| Panggil/lewati antrean | ✘ | ✔ | ✔ (miliknya) | ✘ | ✘ |
| Mulai periksa, simpan pemeriksaan | ✘ | ✘ | ✔ (miliknya) | ✘ | ✘ |
| Baca pemeriksaan | ✔ (miliknya, baca saja) | ✘ | ✔ (miliknya) | ✘ | ✘ |
| Batal kunjungan | ✔ (K11) | ✔ | ✘ | ✘ | ✘ |
| Kelola master/pengguna, rekap | ✘ | ✘ | ✘ | ✔ | ✘ |
| Lihat pekerjaan notifikasi | ✘ | ✔ | ✘ | ✔ | ✘ |

Setiap sel ✘ diuji dan harus mengembalikan 401 (anonim) atau 403/404 (lainnya).

### 15.3 Kasus uji konkurensi

Dua pendaftaran serentak pada kuota sisa 1: tepat satu berhasil, satu ditolak. Seratus pendaftaran paralel pada satu dokter dan tanggal: nomor antrean berurutan tanpa ganda. Kirim ulang formulir yang sama dua kali: satu kunjungan.

---

## 16. Keputusan tim dan pertanyaan terbuka

### 16.1 Keputusan tim tercatat

Keputusan K1 sampai K15 pada bagian 1.3 adalah keputusan tim yang mengikat. Tambahan:

| No | Keputusan |
|---|---|
| T1 | Ringkasan hasil pemeriksaan yang dilihat pasien: diagnosis dan catatan, hanya-baca. Anamnesis dan tanda vital ikut ditampilkan. (Usulan, dapat diubah.) |
| T2 | Riwayat dokter dibatasi pada kunjungan yang ia tangani sendiri. |
| T3 | Satu dokter boleh punya beberapa jadwal (sesi) pada hari yang sama. Kuota dihitung per jadwal, nomor antrean per dokter per tanggal. Jadwal tidak boleh tumpang tindih. |
| T4 | Prioritas P1 bila waktu terbatas: (1) giliran hampir tiba, (2) ekspor rekap, (3) log aktivitas. |
| T5 | Polling 5 detik dipilih sebagai bawaan. SSE hanya bila waktu cukup. |

### 16.2 Pertanyaan terbuka

| ID | Pertanyaan | Siapa menjawab |
|---|---|---|
| Q1 | Role database apa yang dipakai `DATABASE_URL` backend, dan bagaimana RLS dipertahankan sebagai lapisan ketiga? | Audit agy lalu tim |
| Q2 | Apakah dosen menerima `service_role` di server untuk pembuatan akun staf dan role koneksi backend? | Tim bertanya ke dosen |
| Q3 | Apakah penyimpangan dari SRS lama (Supabase Auth, bukan sesi sendiri) perlu persetujuan tertulis dosen? Ketentuan dosen menyebut Supabase Auth, jadi dianggap sesuai. | Tim |
| Q4 | Apakah SSE diperlukan, atau polling diterima sebagai "tanpa muat ulang"? | Tim |
| Q5 | Batas pembatalan 2 jam: sesuai kebijakan klinik atau diganti? | Tim |

Bila kode agy menemukan ambiguitas baru, tambahkan di sini, jangan menebak.

---

## 17. Lampiran: matriks keterlacakan

### 17.1 Ketentuan dosen → bukti

| Ketentuan (3.5) | Dipenuhi oleh | Bagian |
|---|---|---|
| 1 Teknologi dan alur | Next.js, GitHub, Vercel, Supabase | 8, 14 |
| 2 Penyimpanan data | PostgreSQL | 9 |
| 3 Penyimpanan aset | Supabase Storage | 5.4, K3 |
| 4 Privasi aset | Bucket privat bila ada lampiran, foto dokter publik | 10 |
| 5 Autentikasi | Supabase Auth + middleware | 8.3 |
| 6 Otorisasi data | Cek server + RLS | 9.6, 15.2 |
| 7 Kredensial | Env var, grep | 10, 14.2 |
| 8 Integritas | Constraint, transaksi | 9.2, 9.5 |
| 9 Validasi masukan | Zod + frontend + CHECK | 8.4 |
| 10 Konsistensi dashboard | Agregasi dari DB | 5.4 |
| 11 Responsif | Tailwind | 11.3 |
| 12 Umpan balik | State UI | 11.3 |
| 13 Pengelolaan daftar | Filter dan pagination | 11.2 |
| 14 Deployment | Vercel + worker | 8.6 |
| 15, 16 Data dummy | Seed | 9.8 |
| 17 Batas pelaksanaan | Tanpa pembayaran | 2.5 |

### 17.2 Cerita pengguna → aturan → tabel → uji

| Cerita | Aturan | Tabel utama | Uji |
|---|---|---|---|
| US-02 | K1, K10 | profiles, pasien | Registrasi dan NIK salah |
| US-05, US-11 | BR-01..04, 13, 14 | kunjungan, antrean, jadwal_praktik | Kuota, ganda, serentak |
| US-06 | BR-06 | antrean | Polling status |
| US-07 | BR-08, K11 | kunjungan, antrean | Batas 2 jam |
| US-08 | — | kunjungan, pemeriksaan | Ganti ID |
| US-09 | 7 | notifikasi, push_subscriptions | Alur push |
| US-10..14 | BR-05, 06, 15, K12 | pasien, kunjungan, antrean | Admin ditolak, alasan wajib |
| US-16..21 | BR-09, 10, 18, K14 | antrean, pemeriksaan, tindakan | Dokter lain ditolak |
| US-22..26 | BR-11, 16, 17 | dokter, layanan, jadwal, profiles, profil_klinik | Bentrok jadwal |
| US-27 | — | kunjungan | Rekap sama daftar |
| US-28 | 7.5 | notifikasi | Pekerjaan gagal tampil |
| US-29, US-30 | K15 | log_aktivitas | Ditunda |

### 17.3 Keputusan → area kode

K1 auth • K2/K9 akses data • K3 storage • K4/K13 push • K5 polling • K6 hosting • K7 Zod • K10 NIK • K11 batal • K12/K14 hak aksi • K15 ditunda.

---

## 18. Panduan pengerjaan dengan agy: persiapan, gerbang tahap, dan prompt siap tempel

Bagian ini adalah **pintu masuk kerja**. Isinya: persiapan repository, peta tugas → bagian yang dibaca, gerbang antar tahap, dan prompt siap tempel. Setiap prompt menunjuk bagian dokumen ini yang harus dibaca, sehingga agy tidak menebak. Aturan kerja agen (aturan keras, cara kerja, aturan Git) ada di berkas terpisah `AGENTS.md` di root repository, karena berkas itu dibaca agen di setiap sesi.

### 18.1 Persiapan (dikerjakan manusia, sekali saja)

Proyek ini memakai **dua berkas pedoman**:

| Berkas | Letak | Fungsi |
|---|---|---|
| `AGENTS.md` | root repository | Aturan keras dan cara kerja. Singkat, dibaca agen di setiap sesi. |
| `DOKUMEN_INDUK.md` | `docs/DOKUMEN_INDUK.md` | Acuan tunggal (bagian 1–17) dan panduan pengerjaan (bagian 18). Dibuka sesuai bagian yang ditunjuk prompt. |

Langkah:

1. Simpan berkas ini sebagai `docs/DOKUMEN_INDUK.md` dan `AGENTS.md` di root.
2. Simpan berkas asli dosen untuk rujukan: `docs/ref/Technical_Requirements.md` dan `docs/ref/Project_Akhir_Web_16_Tim.xlsx`.
3. Simpan gambar ERD, use case, dan sequence diagram di `docs/diagram/`.
4. Pastikan `docs/Kontrak API Sistem Informasi Klinik Kesehatan.md` (dari teman) ada di `docs/`.
5. `docs/STATUS.md` jangan dibuat manual. agy membuatnya di Tahap 0.
6. Commit sebagai titik kembali: `git add docs AGENTS.md` lalu `git commit -m "docs: dokumen induk dan AGENTS.md"`.

### 18.2 Peta dokumen: tugas → bagian yang dibaca

| Tugas | Baca di `docs/DOKUMEN_INDUK.md` |
|---|---|
| Semua tugas (wajib selalu) | §1.3 (K1–K15), §3 (ketentuan dosen), `AGENTS.md` |
| Audit | §3.5, §3.6j, §5.1, §4.3, §5.6, §7, §12 |
| Validasi, auth, aturan bisnis | §5.1 (BR), §8.3, §8.4, §3.6b, §3.6d |
| Database dan migrasi | §9, §7.6 |
| Web Push, worker | §7 (seluruh), §3.6e, §14.5 |
| Halaman dan API | §11, §5.3–5.5 |
| Seed dan data uji | §9.8, §3.4 |
| Pengujian dan bukti | §5.6, §15 |
| Dokumentasi | §3.6i, §14 |
| Deployment | §8.6, §14.2, §14.6 |
| Pertanyaan ambigu | §16 (jangan menebak) |

Urutan otoritas bila ada pertentangan: **ketentuan dosen > K1–K15 dan keputusan tim (§16) > perencanaan lama (SRS, PRD, sequence diagram) > kode saat ini.** SRS dan PRD lama menyebut Prisma, sesi buatan sendiri, Supabase Realtime, dan notifikasi opsional. Itu **sudah digantikan** oleh K1–K15.


### 18.3 Alur tahap dan gerbang

| Tahap | Tujuan | Gerbang (harus lulus sebelum lanjut) |
|---|---|---|
| 0 | Audit | `docs/STATUS.md` disetujui manusia |
| 1 | Penyelarasan backend | Uji `curl` lulus, tak ada pelanggaran aturan keras |
| 1B | Frontend terhubung ke API | Alur 10 langkah (tanpa push) jalan dari UI |
| 2 | Migrasi Web Push | DB kosong → migrasi sukses, CHECK/UNIQUE menolak data buruk |
| 3 | Browser dan API push | Subscription tersimpan, kondisi izin tertangani |
| 4 | Worker | Tujuh bukti §7.8 lulus |
| 5 | Seed, uji, dokumentasi | Alur 10 langkah lulus lokal |
| 6 | Deployment | Alur 10 langkah lulus di URL Vercel |
| 7 | P1 (opsional) | Hanya bila semua P0 lulus |

Setelah tiap tahap, **manusia** menjalankan aplikasi, menguji sendiri, meninjau diff, baru memberi izin tahap berikutnya.


### 18.4 Prompt siap tempel

#### Prompt 0 — Audit (tempel di awal)

```text
Kamu engineer full-stack senior untuk proyek Sistem Informasi Klinik (Tim 7).

BACA DULU, lengkap: AGENTS.md dan docs/DOKUMEN_INDUK.md
bagian 1.3, 3, 4.3, 5, 7, 9, 12. Keputusan K1–K15 mengikat.

TUGAS: AUDIT SAJA. JANGAN mengubah kode, skema, atau konfigurasi.
1. Telusuri seluruh repository: struktur, package.json, schema.ts, migrasi, seed, semua route handler,
   middleware, komponen frontend, env, dokumentasi, konfigurasi deployment.
2. Bandingkan dengan dokumen induk. Buat docs/STATUS.md berisi tabel:
   [ID] | Selesai / Sebagian / Belum | bukti (berkas:baris) | pekerjaan tersisa
   Cakup: 17 ketentuan umum (§3.5), 9 butir bukti (§3.6j), BR-01..BR-18, US-01..US-30,
   K1..K15, alur 10 langkah (§5.6), Web Push (§7), dokumentasi dan deployment (§3.6i).
3. Daftar pelanggaran aturan keras AGENTS.md (supabase.from di browser, validasi tanpa Zod,
   secret terekspos, logika bisnis di fungsi fn_..., dll.) dengan lokasi berkas.
4. Periksa khusus: role database yang dipakai DATABASE_URL backend dan apakah RLS efektif (§9.6, Q1);
   apakah nomor antrean aman bila satu dokter punya beberapa jadwal sehari (§9.5);
   kecocokan nama rute API dengan katalog §11.2 (catat padanannya, jangan ganti nama).
5. Cocokkan §12 dokumen induk dengan temuan; usulkan koreksi teks §12.
6. Susun urutan pengerjaan dan estimasi risiko untuk Tahap 1–6.
7. Daftar pertanyaan terbuka baru (format §16.2).
Berhenti dan tampilkan ringkasan. Tunggu persetujuan saya.
```

#### Prompt 1 — Penyelarasan backend (revisi setelah audit)

```text
Kerjakan TAHAP 1. Baca: AGENTS.md, docs/STATUS.md, docs/DOKUMEN_INDUK.md §1.3 (K1, K5, K7, K10, K11, K12, K14),
§5.1, §8.3, §8.4, §3.6b, §3.6d.
Tulis rencana singkat dan mulai. Hanya perbaiki item berstatus Sebagian/Belum di STATUS.md (temuan audit: G3–G7, G9, G10 di §12.2):
- Tambahan: hapus `admin` dari daftar peran untuk check-in, batal kunjungan, walk-in, panggil/lewati (K12/K14); `await params` di semua route dinamis; tambah endpoint admin yang kurang (layanan, pengguna/akun staf via supabaseAdmin, profil klinik, rekap, unggah foto dokter ke Supabase Storage); tambah middleware.ts pengalih ke /login; putuskan route mana yang wajib lewat denganRls dan catat alasannya.
- K7: ganti validasi manual di SEMUA endpoint dengan Zod (satu berkas skema per domain di lib/validasi/, pesan Indonesia, respons galat per field sesuai §8.4).
- K1: login/registrasi/logout lewat endpoint backend ke Supabase Auth; cookie httpOnly+Secure+SameSite; tolak akun status_aktif=false; tidak ada tabel sesi/password_hash.
- K10: NIK wajib 16 digit angka, unik, di frontend + Zod + CHECK/UNIQUE DB (migrasi baru bila perlu).
- K11/BR-08: pembatalan pasien hanya jika antrean menunggu dan ≥ BATAS_BATAL_JAM (=2) sebelum jam mulai praktik; konstanta tunggal; petugas boleh batal selama belum diperiksa; alasan wajib.
- K12/K14: check-in, walk-in, batal kunjungan hanya petugas (admin → 403); panggil/lewati: petugas dan dokter (dokter hanya miliknya); mulai periksa hanya dokter pemilik.
- K5: hapus semua supabase.from/rpc/Realtime di browser; ganti polling 5 detik ke API kita (berhenti saat tab tersembunyi).
- Rate limiting: login, registrasi, daftar kunjungan, langganan push (429 + Retry-After).
- Pino: logger terstruktur di lib/logger.js, tanpa data sensitif.
- Pastikan transaksi pendaftaran sesuai §9.5 (kunci, kuota, duplikat, nomor antrean) dan aman untuk banyak jadwal per dokter.
Bukti (simpan di docs/BUKTI_VERIFIKASI.md): curl dengan input kosong/negatif/NIK salah/role palsu; ganti ID antar akun;
dua pendaftaran serentak pada kuota sisa 1; kirim ulang formulir; admin mencoba check-in.
Commit per sub-tugas, perbarui STATUS.md, lalu berhenti.
```

#### Prompt 1B — Hubungkan frontend ke API

```text
Kerjakan TAHAP 1B. Baca: AGENTS.md, docs/STATUS.md, docs/DOKUMEN_INDUK.md §3.5 (no. 2, 5, 10-14), §8.3, §8.5, §11.
Masalah: src/context/ClinicContext.tsx dan src/clinic-data.ts memakai data statis + localStorage; tidak ada fetch ke API.
Tugas, kerjakan per peran dan satu commit per bagian:
1. Putuskan penyimpanan sesi (usulan: cookie httpOnly diset oleh route login; jelaskan alasannya). Buat lib klien `api.js` (fetch + penanganan 401/403, pesan galat).
2. Halaman publik membaca /api/public/* (klinik, layanan, dokter, jadwal) dengan state loading/kosong/gagal.
3. Login/daftar memakai /api/auth/*; middleware.ts mengalihkan /dashboard dan halaman peran ke /login tanpa sesi.
4. Pasien: daftar kunjungan, antrean aktif, batal, riwayat, profil via API. Petugas: antrean, check-in, walk-in, pencarian pasien. Dokter: antrean, periksa, simpan pemeriksaan+tindakan, selesai. Admin: dokter, layanan, jadwal, pengguna, profil klinik, rekap.
5. Polling 5 detik untuk antrean (berhenti saat tab tersembunyi).
6. Hapus data statis dan localStorage sebagai sumber data (boleh tersisa hanya preferensi UI). Hapus tombol akses cepat peran demo atau ganti dengan akun uji nyata dari seed.
7. Semua daftar: pencarian/filter + pagination; tombol submit nonaktif saat kirim.
Jangan mengubah desain visual. Bukti: jalankan alur 1-9 §5.6 dari UI terhadap database lokal/Supabase; refresh dan login ulang, data tetap ada.
Perbarui STATUS.md dan berhenti.
```

#### Prompt 2 — Skema Web Push

```text
Kerjakan TAHAP 2. Baca: AGENTS.md, docs/DOKUMEN_INDUK.md §7.3, §7.6, §9.2–9.4, K4, K13.
Buat migrasi Drizzle BARU (jangan edit migrasi lama):
- Tabel push_subscriptions persis §7.6 (UNIQUE endpoint, FK profiles ON DELETE CASCADE, indeks profile_id, RLS pemilik: baca/tambah/hapus miliknya).
- Kolom baru pada notifikasi: jenis_kejadian (CHECK empat kode wajib + kode opsional), tautan, push_status (CHECK menunggu/berhasil/gagal, default menunggu), push_percobaan (CHECK >= 0, default 0), push_error, push_diproses_at; indeks (push_status, created_at).
- Perbarui fungsi trigger antrean yang ada agar mengisi jenis_kejadian dan tautan untuk KUNJUNGAN_TERDAFTAR, PENDAFTARAN_BARU (semua petugas aktif), ANTREAN_DIPANGGIL, KUNJUNGAN_DIBATALKAN. Pesan hanya nomor antrean, nama dokter, tanggal.
- Selaraskan schema.ts.
Bukti: migrasi dari DB kosong sukses; INSERT tidak valid ditolak CHECK/UNIQUE (tampilkan galat); setelah daftar, panggil, batal → baris notifikasi terbentuk dengan kolom benar.
Perbarui STATUS.md dan berhenti.
```

#### Prompt 3 — Browser dan endpoint push

```text
Kerjakan TAHAP 3. Baca: AGENTS.md, docs/DOKUMEN_INDUK.md §7.2, §7.5 (kondisi khusus), §7.7, §11.2, US-28.
- public/sw.js: event push (tampilkan dari payload JSON) dan notificationclick (fokus tab yang ada atau buka tautan).
- Komponen tombol "Aktifkan Notifikasi" untuk pasien dan petugas. Izin HANYA setelah klik. Tangani: izin ditolak (petunjuk mengaktifkan di pengaturan browser), browser tidak mendukung (sembunyikan tombol + pesan), subscription kedaluwarsa (berlangganan ulang).
- Endpoint: GET /api/push/kunci; POST /api/push/langganan (upsert per endpoint, Zod, wajib login, rate limit); DELETE /api/push/langganan (nonaktifkan). Logout menonaktifkan subscription perangkat itu.
- GET /api/admin/pekerjaan-notifikasi (admin dan petugas; filter status; pagination) + halaman UI di dasbor admin dan petugas: status, jumlah percobaan, penyebab gagal, state loading/kosong/gagal.
- Tambah env NEXT_PUBLIC_VAPID_PUBLIC_KEY ke .env.example.
Bukti: subscription masuk tabel dan terhubung ke pengguna; endpoint menolak tanpa sesi; pengguna lain tidak bisa menghapus subscription orang lain; UI untuk tiga kondisi izin.
Perbarui STATUS.md dan berhenti.
```

#### Prompt 4 — Background worker

```text
Kerjakan TAHAP 4. Baca: AGENTS.md, docs/DOKUMEN_INDUK.md §7.1, §7.4, §7.5, §7.8, §8.6, §14.2, §14.5, §3.6e, §3.6g.
- worker/index.js, `npm run worker`, proses terpisah dari Next.js.
- Pemindai saat start dan tiap 30 detik: ambil notifikasi push_status='menunggu', enqueue ke BullMQ dengan jobId = id notifikasi (tidak boleh ganda).
- Setelah commit transaksi bisnis, aplikasi web boleh mencoba enqueue cepat; bila Redis mati, abaikan dengan log peringatan (transaksi tetap sukses).
- Processor: baca subscription aktif penerima, kirim web-push + VAPID.
  201 → berhasil + push_diproses_at, last_success_at; 404/410 → nonaktifkan subscription, tanpa retry;
  tak ada subscription aktif → gagal dengan alasan jelas; 429/5xx/timeout → retry exponential backoff maks 5x;
  400/401/403 → gagal tanpa retry, log error; percobaan habis → gagal + push_error terisi. Perbarui push_percobaan tiap percobaan.
- Pino: id notifikasi, id job, durasi, hasil, percobaan. Tidak boleh ada kegagalan diam-diam. Tangani SIGTERM (selesaikan job berjalan) dan unhandledRejection.
- Koneksi DB worker: session/direct (jangan transaction pooler bila memakai LISTEN). Env: VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT, REDIS_URL, DATABASE_URL. Perbarui .env.example.
Bukti (§7.8) — jalankan dan tempel hasilnya di docs/BUKTI_VERIFIKASI.md:
(1) subscription tersimpan; (2) daftar kunjungan → notifikasi di browser pasien dan petugas; (3) panggil → notifikasi, klik buka dasbor;
(4) endpoint palsu → 404/410 → nonaktif; (5) pekerjaan gagal tampil dengan penyebab dan percobaan;
(6) stop worker, buat kunjungan, start worker → terkirim sekali; (7) matikan Redis → pendaftaran tetap sukses, terkirim setelah Redis pulih.
Jika salah satu tidak bisa diuji di lingkunganmu, katakan jelas dan beri langkah uji manual untuk saya.
Perbarui STATUS.md dan berhenti.
```

#### Prompt 5 — Seed, uji, UI, dokumentasi

```text
Kerjakan TAHAP 5. Baca: AGENTS.md, docs/DOKUMEN_INDUK.md §9.7, §9.8, §3.4, §3.5 (no. 11–13, 15–16), §5.6, §11.3, §14, §15, §3.6i.
- scripts/seed.js idempoten sesuai §9.8: 5+ pasien (≥1 walk-in), 5 dokter, 5 layanan, 5+ jadwal (kuota 3 terisi 2; kuota 2 terisi 2), 12 kunjungan dengan komposisi tabel §9.8, 5 pemeriksaan, 5 tindakan, akun uji tiap peran via Supabase Auth Admin API, contoh push subscription dan notifikasi status menunggu/berhasil/gagal. Data fiktif.
- Pastikan semua daftar punya pencarian/filter + pagination, state loading/kosong/berhasil/gagal, tombol submit nonaktif saat kirim, responsif di lebar 375px, alur utama dapat dipakai dengan keyboard.
- Skrip atau checklist uji untuk alur 10 langkah (§5.6) dan uji tambahan, serta matriks otorisasi §15.2 (otomatiskan dengan skrip curl bila bisa).
- Dokumen: README (instal, jalankan web dan worker, VAPID, Redis, migrasi, seed, akun uji), docs/ARSITEKTUR.md (frontend, backend, database, worker), ERD (ekspor dari skema), daftar fitur selesai dan keterbatasan, docs/BUKTI_VERIFIKASI.md untuk sembilan butir §15.1.
- Audit keamanan akhir: cari service_role, VAPID_PRIVATE, DATABASE_URL, REDIS_URL di repo dan di hasil build browser; laporkan hasilnya.
Perbarui STATUS.md dan berhenti.
```

#### Prompt 6 — Deployment

```text
Kerjakan TAHAP 6. Baca: AGENTS.md, docs/DOKUMEN_INDUK.md §8.6, §14.2, §14.6, §3.5 (no. 14), K6.
Siapkan: aplikasi di Vercel; worker di Railway atau Render; Redis di Upstash (rediss://). Buat daftar env per platform,
langkah deploy bertahap, dan perintah start worker. Jalankan atau panduan saya menjalankan alur 10 langkah dan uji tambahan
pada URL Vercel (HTTPS, tanpa server lokal), termasuk membuka ulang URL detail dan uji Web Push nyata.
Laporkan kendala dan perbaiki. Perbarui README dan STATUS.md.
```

#### Prompt 7 — P1 (hanya bila semua P0 lulus)

```text
Kerjakan TAHAP 7 hanya setelah STATUS.md menunjukkan semua P0 Selesai. Baca §5.7, §16.1 (T4), K15.
Urutan: (1) notifikasi giliran hampir tiba, (2) ekspor rekap PDF/Excel, (3) log aktivitas, lalu sisanya bila waktu cukup.
Satu fitur per commit, jangan merusak alur P0, jalankan ulang uji alur 10 langkah setelah tiap fitur.
```


### 18.5 Prompt pendukung

#### Perbaikan bug

```text
Ada bug: <gejala dan langkah mereproduksi>.
Baca AGENTS.md dan docs/DOKUMEN_INDUK.md bagian yang relevan (<§...>). Cari akar masalah dulu dan jelaskan,
tulis uji yang gagal, perbaiki dengan perubahan minimal, jalankan ulang uji, lalu commit.
Jangan mengubah keputusan K1–K15 untuk "menyelesaikan" bug.
```

#### Review sebelum merge

```text
Tinjau diff terakhir terhadap AGENTS.md dan docs/DOKUMEN_INDUK.md. Periksa: pelanggaran aturan keras, endpoint tanpa Zod,
endpoint tanpa cek peran/kepemilikan, secret terekspos, transaksi yang kurang, logging data sensitif, migrasi yang mengedit yang lama.
Keluarkan daftar temuan berurutan keparahan dengan berkas:baris. Jangan memperbaiki apa pun sebelum saya setuju.
```

#### Persiapan demo

```text
Buat skrip demo berdasarkan docs/DOKUMEN_INDUK.md §5.6, §7.8, §15.1: urutan klik per peran, perintah curl untuk validasi backend,
SQL untuk uji constraint, cara memperlihatkan log worker dan pekerjaan gagal. Sertakan 15 pertanyaan yang mungkin diajukan dosen
(mis. "mengapa kuota aman dari race condition?", "bagaimana Web Push tidak membatalkan transaksi?") beserta jawaban singkat
yang merujuk ke berkas kode.
```


#### Bug aktif: POST /api/admin/dokter gagal "Database error creating new user"

```text
Kamu engineer backend untuk proyek Sistem Informasi Klinik (Tim 7).

Baca dulu: AGENTS.md dan docs/DOKUMEN_INDUK.md (bagian 1.3, 3, 5, 8.3, 9), serta
docs/Kontrak API Sistem Informasi Klinik Kesehatan.md. Aturan keras di AGENTS.md mengikat.

TUGAS: perbaiki bug POST /api/admin/dokter yang selalu gagal dengan pesan
"Database error creating new user" (galat dari Supabase Auth admin.createUser).
Kerjakan hanya bug ini. Jangan refaktor hal lain.

KONTEKS
- File: src/app/api/admin/dokter/route.js (createUser sekitar baris 81, memakai
  app_metadata: { role: "dokter" }, user_metadata: { display_name, nama }).
- Trigger trg_auth_user_created (AFTER INSERT ON auth.users) menjalankan
  public.handle_new_user() (SECURITY DEFINER, search_path=public). Fungsi ini membaca
  raw_app_meta_data->>'role', insert ke public.profiles(id, nama, telepon, role), dan
  insert ke public.pasien hanya bila role = 'pasien'.
- trg_profiles_guard hanya BEFORE UPDATE di public.profiles (bukan penyebab).
- Enum user_role berisi: pasien, petugas, dokter, admin.
- Constraint profiles: nama 1-150 karakter, telepon NULL atau ^\+?[0-9]{8,15}$.
- POST /api/auth/daftar (peran pasien) BERHASIL. Hanya jalur dokter yang gagal.
- Akun dokter1-5 di seed dibuat lewat SQL langsung, jadi jalur createUser untuk dokter
  belum pernah terbukti berjalan.
- Insert dokter langsung ke auth.users lewat SQL Editor (role postgres) lolos, tetapi itu
  belum membuktikan apa pun karena Supabase Auth menulis sebagai role supabase_auth_admin.
- Percobaan gagal tidak meninggalkan baris di auth.users (transaksi dibatalkan penuh).

LANGKAH (urut, jangan loncat)
1. Audit dulu, jangan ubah apa pun: baca route.js lengkap, src/lib/supabase-admin.js, dan migrasi
   yang mendefinisikan handle_new_user, profiles, dokter, dokter_layanan. Bandingkan dengan
   hasil query database live di atas dan catat perbedaannya. Periksa apakah
   SUPABASE_SERVICE_ROLE_KEY di .env.local benar-benar service_role (jangan cetak nilainya).
2. Siapkan skrip SQL untuk saya jalankan di Supabase SQL Editor (kamu tidak punya akses),
   dibungkus begin ... rollback, dengan `set local role supabase_auth_admin;` lalu insert ke
   auth.users untuk peran dokter, pasien, dan petugas sebagai pembanding. Minta saya menempelkan
   pesan galat persisnya.
3. Minta saya mengirim baris ERROR dari Supabase Logs > Postgres Logs (dan Auth Logs) pada menit
   yang sama dengan request gagal. Jangan menebak penyebab sebelum ada pesan galat asli.
4. Hipotesis, urut dari paling mungkin: (a) supabase_auth_admin tidak punya USAGE pada skema
   public atau EXECUTE pada handle_new_user (perlu GRANT lewat migrasi baru); (b) kolom NOT NULL
   tanpa default di profiles atau trigger/constraint lain yang belum terlihat; (c) fungsi di
   database live berbeda dari migrasi di repo; (d) cara route mengirim metadata.
5. Setelah penyebab terbukti dari log, buat perbaikan minimal. Perubahan skema/fungsi/GRANT =
   migrasi Drizzle BARU. Bila createUser sukses tetapi insert dokter/dokter_layanan gagal,
   hapus kembali akun auth yang sudah dibuat (rollback kompensasi).
6. Verifikasi dengan bukti yang dijalankan: POST dengan email baru -> 201 dan tampil di
   GET /api/public/dokter; login dokter baru berhasil; input tidak valid -> 400 pesan Indonesia;
   email duplikat -> 409; tanpa login -> 401; pasien/petugas -> 403; /api/auth/daftar tetap
   berhasil; npm run build lolos.
7. Tulis ringkasan (penyebab, berkas diubah, bukti). Satu commit per sub-tugas di cabang
   fix/admin-dokter. Jangan push dan jangan merge sebelum saya setuju.

BATASAN
- Jangan mencatat password, token, atau service_role key di log atau jawaban.
- Bersihkan akun uji (dokter6/dokter7@klinik.test dan sejenisnya) setelah verifikasi,
  atau berikan SQL pembersihnya.
- Bila ada pertentangan dengan dokumen atau hal ambigu, BERHENTI dan tanyakan.
```


### 18.6 Menyatukan pekerjaan di GitHub

Penggabungan pertama (`backend/api` → `main`) sudah dikerjakan. Untuk pekerjaan berikutnya:

- Satu cabang per tahap atau bug (`feat/zod-validasi`, `feat/frontend-api`, `feat/web-push`, `fix/admin-dokter`), Pull Request kecil, dan sering `git merge origin/main` agar konflik tidak menumpuk.
- Selesaikan konflik di cabang kerja, bukan di `main`, dan jangan memakai tombol "Resolve conflicts" di web.
- Berkas paling rawan konflik: `package.json`, `package-lock.json`, `ClinicContext.tsx`, `ClinicWorkspace.tsx`. Konflik `package-lock.json`: terima salah satu versi lalu jalankan `npm install` ulang. Berkas frontend milik teman jangan dipilih sepihak.
- Setelah menyelesaikan konflik, pastikan tidak ada penanda tersisa sebelum commit:
  `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- . ":!package-lock.json"`. Lalu `npm run build` sebelum push. (`git add` tetap meloloskan berkas yang masih berpenanda.)
- Jangan memakai `npm audit fix --force`.
- Tambahkan `.gitattributes` berisi `* text=auto` agar perbedaan CRLF/LF tidak membuat puluhan berkas tampak berubah.
- Pastikan `.env.local` tidak pernah ikut commit: `git check-ignore -v .env.local` harus mencetak aturan `.gitignore`.

### 18.7 Catatan penting

- **Verifikasi manual tetap perlu.** agy dapat salah menyatakan sesuatu selesai. Jalankan alur 10 langkah sendiri setelah tiap tahap.
- **Bagian 12 dokumen induk adalah dugaan** sampai Prompt 0 selesai. Perbarui setelah audit.
- **Pertanyaan yang sebaiknya Anda ajukan ke dosen** (§16.2): penggunaan `service_role` di server, dan efektivitas RLS bila backend memakai role koneksi yang melewati RLS.
- Bila agy mengusulkan Supabase Realtime, Prisma, sesi buatan sendiri, atau menjadikan notifikasi opsional, tolak dan arahkan ke §1.3.
