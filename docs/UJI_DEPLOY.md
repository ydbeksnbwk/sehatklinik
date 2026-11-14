# Checklist Pengujian Alur 10 Langkah & Ketahanan di URL Produksi (Vercel)
**Sistem Informasi Klinik Kesehatan (Klinik Tim 7)**  
*Lembar Kerja Pengujian Manual Bagi Penguji / Evaluator*

---

## 📋 Petunjuk Pelaksanaan

1. Buka peramban di URL deployment HTTPS Vercel (contoh: `https://sehatklinik-tim7.vercel.app`).
2. Siapkan **dua peramban berbeda** (atau jendela Incognito/Private terpisah):
   - **Peramban A (Chrome)**: Untuk sesi Pasien (`ani.wulandari@gmail.com`).
   - **Peramban B (Edge)**: Untuk sesi Petugas (`rina.petugas@gmail.com`) dan Dokter (`dokter.reyhan@gmail.com`).
3. Pastikan background worker di Railway/Render sedang aktif (`npm run worker:prod`).
4. Beri tanda centang `[X]` atau status `LULUS` / `GAGAL` pada kolom hasil yang disediakan.

---

## 1. Tabel Checklist Alur Utama 10 Langkah (PRD §5)

| No | Langkah | Aktor & Akun | Tindakan yang Dilakukan | Hasil yang Diharapkan | Status | Catatan Penguji |
|:---:|---|---|---|---|:---:|---|
| **1** | **Aktivasi Notifikasi** | Pasien (`ani.wulandari@gmail.com`) di Peramban A | Klik tombol **"Aktifkan Notifikasi"**, lalu pilih **Allow/Izinkan** pada dialog izin browser | Dialog sukses muncul; tombol berubah menjadi status "Notifikasi Aktif"; langganan tersimpan di database | `[  ]` | |
| **2** | **Pendaftaran Kunjungan** | Pasien di Peramban A | Masuk menu Pendaftaran Kunjungan: pilih Layanan (Poli Umum), Dokter (dr. Reyhan), Tanggal, Sesi Jadwal, masukkan keluhan, klik **Kirim** | Kunjungan berhasil terdaftar dengan nomor referensi unik dan nomor antrean; notifikasi push pendaftaran muncul di layar | `[  ]` | |
| **3** | **Pemantauan Dasbor Pasien** | Pasien di Peramban A | Buka halaman Dasbor Pasien (`/dashboard` atau `/pasien`) | Kartu antrean aktif menampilkan nomor antrean (#1) dengan status **Menunggu** | `[  ]` | |
| **4** | **Check-in Kedatangan** | Petugas (`rina.petugas@gmail.com`) di Peramban B | Login sebagai Petugas, buka Dasbor Antrean (`/petugas`), cari antrean pasien tadi, klik tombol **Check-in** | Status kunjungan berubah menjadi **Hadir**; tombol "Panggil" menjadi aktif | `[  ]` | |
| **5** | **Pemanggilan Antrean** | Petugas di Peramban B | Klik tombol **Panggil** pada antrean pasien yang telah Hadir | Status berubah menjadi **Dipanggil**; notifikasi Web Push berbunyi/muncul di Peramban A; klik notifikasi membuka tab dasbor pasien | `[  ]` | |
| **6** | **Mulai Pemeriksaan Dokter** | Dokter (`dokter.reyhan@gmail.com`) di Peramban B | Login sebagai Dokter, buka antrean pribadi (`/dokter-dashboard`), temukan pasien, klik **Mulai Periksa** | Status antrean berubah menjadi **Sedang Diperiksa**; hanya pasien dr. Reyhan yang terlihat di daftar | `[  ]` | |
| **7** | **Pencatatan Rekam Medis & Selesai** | Dokter di Peramban B | Masukkan Anamnesis, Tanda Vital valid (TD: 120/80, Suhu: 36.5, BB: 65, TB: 170), Diagnosis, Tindakan medis, klik **Simpan & Selesaikan Kunjungan** | Kunjungan dan nomor antrean berubah status menjadi **Selesai**; data rekam medis tersimpan persisten | `[  ]` | |
| **8** | **Isolasi Riwayat Medis** | Pasien di Peramban A | Buka halaman Riwayat (`/riwayat` atau `/dashboard`) | Kunjungan yang baru saja selesai muncul lengkap dengan ringkasan medis; login akun Pasien 2 membuktikan kunjungan ini terisolasi total | `[  ]` | |
| **9** | **Rekapitulasi Konsisten** | Admin (`admin.klinik@gmail.com`) | Login sebagai Admin, buka menu Rekapitulasi Kunjungan (`/admin`) | Angka ringkasan total kunjungan sama persis dengan penjumlahan status (Terdaftar + Hadir + Selesai + Batal) | `[  ]` | |
| **10** | **Audit Outbox & Worker** | Admin / Petugas | Buka menu Pekerjaan Notifikasi (`/admin` atau `/api/admin/pekerjaan-notifikasi`) | Daftar pekerjaan outbox push notification menampilkan status riwayat pengiriman (`berhasil`, `gagal`) dengan jumlah percobaan | `[  ]` | |

---

## 2. Tabel Checklist Pengujian Ketahanan Khusus (Edge Cases & Resilience)

| No | Kasus Pengujian | Skenario & Langkah Uji | Hasil yang Diharapkan | Status | Catatan Penguji |
|:---:|---|---|---|:---:|---|
| **E.1** | **Web Push Nyata Lintas 2 Peramban** | Aktifkan notifikasi pada Chrome (Pasien) dan Edge (Petugas). Daftarkan kunjungan online di Chrome. | Notifikasi pendaftaran langsung muncul di Edge petugas; pemanggilan antrean di Edge memicu popup push di Chrome pasien | `[  ]` | |
| **E.2** | **Interaksi Klik Notifikasi (Deep Linking)** | Saat banner Web Push muncul di sudut layar peramban, klik banner notifikasi tersebut. | Peramban langsung mengaktifkan tab aplikasi dan mengarahkan pengguna ke halaman tujuan (`/dashboard` atau `/riwayat`) | `[  ]` | |
| **E.3** | **Ketahanan Worker Mati-Lalu-Hidup (Stop/Start)** | 1. Matikan proses worker di Railway/Render.<br>2. Lakukan pendaftaran kunjungan dari web.<br>3. Nyalakan kembali worker (`npm run worker:prod`). | Pendaftaran tetap berhasil 100% (tersimpan di DB); saat worker menyala kembali, scanner mendeteksi notifikasi outbox dan push terkirim tanpa data hilang atau dobel | `[  ]` | |
| **E.4** | **Ketahanan Redis Putus (Fail-Open)** | 1. Ubah sementara variabel `REDIS_URL` menjadi salah atau matikan instance Redis.<br>2. Lakukan pendaftaran kunjungan di web. | Pendaftaran kunjungan tetap berhasil instan tanpa error 500; rate limiter beralih ke in-memory; notifikasi aman di outbox database | `[  ]` | |
| **E.5** | **Pencegahan Akses Tanpa Sesi (Middleware Guard)** | Buka tab baru dalam mode Private/Incognito, langsung akses URL `https://<domain>/admin` atau `https://<domain>/pasien`. | Middleware Next.js seketika melakukan HTTP 307 Redirect ke halaman `/login?redirect=...` | `[  ]` | |
| **E.6** | **Pencegahan Modifikasi ID Kunjungan Orang Lain** | Login sebagai Pasien 2, coba akses detail kunjungan milik Pasien 1 via URL `/kunjungan/<id-pasien-1>`. | Sistem merespons penolakan otorisasi (HTTP 403 Forbidden / Not Found); data tidak bocor | `[  ]` | |
| **E.7** | **Pencegahan Pendaftaran Kuota Penuh (BR-01)** | Daftarkan kunjungan pada sesi jadwal dokter yang kuotanya telah penuh (2/2). | Pendaftaran ditolak dengan pesan jelas dan status HTTP 409 Conflict | `[  ]` | |

---

## 3. Catatan Ringkasan Hasil Evaluasi Penguji

- **Tanggal Pengujian**: `____________________`
- **Nama Penguji / Evaluator**: `____________________`
- **URL Deployment Vercel**: `________________________________________________`
- **Platform Worker**: Railway / Render (`___________________________________`)
- **Kesimpulan Akhir**: `[  ] MEMENUHI SYARAT (LULUS SEMUA)   [  ] PERLU PERBAIKAN`
