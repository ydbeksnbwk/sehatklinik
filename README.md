# Sistem Informasi Klinik Kesehatan (Next.js App Router)

Aplikasi web Sistem Informasi Klinik Kesehatan yang direka-ulang (**recreated**) menjadi **Next.js 15 (App Router, React 19, TypeScript)** dengan **100% desain, estetika visual, warna, font DM Sans, dan alur kerja asli tetap dipertahankan**.

Proyek ini selaras dengan dokumen **PRD (Product Requirements Document) v1.0** dan **Diagram ERD/Use Case** yang ada pada repositori.

---

## 🚀 Fitur Utama & Ruang Lingkup

### 1. Halaman Publik
- **Beranda (`/`)**: Hero section dengan profil dokter berjilbab, jaminan mutu (*trust badges*), ringkasan layanan, dan ajakan bertindak (CTA).
- **Layanan (`/layanan`)**: Daftar 5 layanan aktif (Poli Umum, Poli Gigi, Poli Anak, Konsultasi Gizi, Pemeriksaan Berkala) dengan durasi konsultasi dan karya seni sinematik.
- **Dokter (`/dokter`)**: Profil 5 dokter spesialis dan umum dengan nomor SIP, jadwal sesi aktif, dan foto dokter.
- **Jadwal Praktik (`/jadwal`)**: Pencarian jadwal dokter berdasarkan tanggal, hari, serta kalkulasi sisa kuota antrean secara *real-time*.
- **Lokasi & Kontak (`/lokasi`)**: Alamat klinik (Jl. Melati No. 18, Jakarta Selatan), peta koordinat OpenStreetMap, jam operasional, dan kontak.
- **Masuk & Registrasi (`/login`, `/daftar`)**: Formulir login dan pendaftaran pasien baru lengkap dengan tombol akses cepat peran demo.

### 2. Area Kerja Berdasarkan Peran (Workspace)
- **Pasien (`/pasien` atau `/dashboard`)**:
  - Pendaftaran kunjungan bertahap (pilih layanan, dokter, tanggal, sesi jadwal, validasi kuota & anti-ganda).
  - Tiket nomor antrean unik per dokter per tanggal.
  - Pemantauan status antrean *live* (Menunggu, Dipanggil, Sedang Diperiksa, Selesai).
  - Pembatalan kunjungan mandiri sebelum dipanggil (kuota dikembalikan).
  - Riwayat kunjungan dengan ringkasan pemeriksaan medis *read-only*.
  - Manajemen profil pasien.
- **Petugas Loket (`/petugas` atau `/dashboard`)**:
  - Dasbor antrean hari ini.
  - Konfirmasi kehadiran pasien (*Check-in*).
  - Pemanggilan antrean (*Panggil*).
  - Pelewatan pasien yang belum hadir (*Lewati* dengan alasan).
  - Pembatalan kunjungan dengan alasan (mengembalikan kuota).
  - Pendaftaran kunjungan *walk-in* untuk pasien tanpa akun.
  - Pencarian dan filter pasien.
- **Dokter (`/dokter-dashboard` atau `/dashboard`)**:
  - Antrean pribadi dokter (hanya pasien dokter bersangkutan).
  - Pemanggilan pasien dan mulai pemeriksaan (*Sedang Diperiksa*).
  - Pencatatan hasil pemeriksaan lengkap: anamnesis, tanda-tanda vital (tekanan darah sistolik/diastolik, suhu tubuh, berat badan), diagnosis, dan catatan.
  - Pencatatan tindakan medis lanjutan.
  - Validasi penyelesaian: kunjungan tidak dapat diselesaikan sebelum pemeriksaan disimpan.
  - Riwayat pasien yang pernah ditangani.
- **Admin (`/admin` atau `/dashboard`)**:
  - Rekap statistik dan grafik tren kunjungan.
  - Pengelolaan data master dokter (CRUD dan relasi layanan).
  - Pengelolaan data master layanan (CRUD).
  - Pengelolaan jadwal praktik dokter & kuota sesi (dengan validasi bentrok jadwal).
  - Pengelolaan akun staf (Petugas dan Dokter).
  - Pengaturan profil klinik (nama, jam operasional, alamat, koordinat).
  - Rekapitulasi laporan kunjungan dengan filter periode tanggal, dokter, layanan, status, dan ekspor data.

---

## 🛠️ Arsitektur & Teknologi

| Lapisan | Teknologi |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Bahasa** | TypeScript |
| **Library UI** | React 19 |
| **Styling** | Vanilla CSS + Tailwind CSS v4 (@tailwindcss/postcss) |
| **Tipografi** | Google Fonts DM Sans |
| **State & Persistence** | React Context (`ClinicContext`) + `localStorage` (data tetap aman saat *refresh*) |
| **Routing** | URL Route Next.js (`/`, `/layanan`, `/dokter`, `/jadwal`, `/lokasi`, `/login`, `/daftar`, `/dashboard`, `/admin`, `/petugas`, `/dokter-dashboard`, `/pasien`) |

---

## 📁 Struktur Direktori

```
klinik-nextjs/
├── public/
│   ├── favicon.svg
│   └── images/                       # Aset foto dokter, konsultasi, logo, simbol
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout dengan font DM Sans & CSS imports
│   │   ├── page.tsx                  # Beranda utama (/)
│   │   ├── layanan/page.tsx          # /layanan
│   │   ├── dokter/page.tsx           # /dokter
│   │   ├── jadwal/page.tsx           # /jadwal
│   │   ├── lokasi/page.tsx           # /lokasi
│   │   ├── login/page.tsx            # /login
│   │   ├── daftar/page.tsx           # /daftar
│   │   ├── dashboard/page.tsx        # /dashboard
│   │   ├── admin/page.tsx            # /admin (shortcut role Admin)
│   │   ├── petugas/page.tsx          # /petugas (shortcut role Petugas)
│   │   ├── dokter-dashboard/page.tsx # /dokter-dashboard (shortcut role Dokter)
│   │   └── pasien/page.tsx           # /pasien (shortcut role Pasien)
│   ├── components/
│   │   ├── BrandArtwork.tsx          # Logo dan wordmark SehatKlinik
│   │   ├── CinematicArtwork.tsx      # Komponen grafis interaktif sinematik
│   │   ├── ClinicWorkspace.tsx       # Komponen workspace utama multi-peran
│   │   ├── Icon.tsx                  # Koleksi ikon SVG
│   │   └── PublicSite.tsx            # Komponen tampilan landing publik
│   ├── context/
│   │   └── ClinicContext.tsx         # Manajemen state sinkron & persistensi localStorage
│   ├── clinic-data.ts                # Seed data & fungsi kalkulasi kuota / tanggal
│   ├── cinematic.css
│   ├── design-system.css
│   ├── index.css
│   ├── patient.css
│   ├── public-prd.css
│   ├── public.css
│   ├── sky.css
│   └── workspace.css
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## 💻 Cara Menjalankan Proyek

1. Buka terminal pada folder proyek:
   ```bash
   cd "e:\PEMWEB\KLINIK WEB\klinik-nextjs"
   ```

2. Jalankan server pengembangan (Development Server):
   ```bash
   npm run dev
   ```

3. Buka peramban (browser) di alamat:
   ```
   http://localhost:3000
   ```

4. Untuk membuat versi produksi (Production Build):
   ```bash
   npm run build
   npm run start
   ```

---

## 🔄 Pengujian Alur Uji Minimum (Sesuai PRD Bagian 9.1)

Anda dapat menguji 8 langkah alur utama langsung di browser:
1. **Pasien**: Buka `/layanan` atau `/login` -> Pilih `Demo Pasien` -> Buka `Pendaftaran Kunjungan` -> Pilih dokter, tanggal, dan sesi -> Kirim pendaftaran -> Nomor antrean unik tampil.
2. **Pasien**: Buka menu `Antrean Saya` -> Nomor antrean aktif dan status `Menunggu` terlihat.
3. **Petugas**: Ganti peran ke `Petugas` melalui pemilih peran di topbar atau buka `/petugas` -> Buka `Antrean Hari Ini` -> Klik `Check-in` -> Status berubah menjadi `Hadir`.
4. **Petugas**: Klik `Panggil Antrean` -> Status antrean berubah menjadi `Dipanggil`.
5. **Dokter**: Ganti peran ke `Dokter` atau buka `/dokter-dashboard` -> Buka `Antrean Saya` -> Klik `Mulai Periksa` -> Status menjadi `Sedang Diperiksa`.
6. **Dokter**: Isi tanda vital, diagnosis, dan tindakan -> Simpan pemeriksaan -> Klik `Selesaikan Kunjungan` -> Kunjungan berstatus `Selesai`.
7. **Pasien**: Ganti peran ke `Pasien` -> Buka `Riwayat Kunjungan` -> Hasil pemeriksaan dan tindakan dokter dapat dibaca secara aman (*read-only*).
8. **Admin**: Ganti peran ke `Admin` atau buka `/admin` -> Buka `Rekap Kunjungan` -> Jumlah dan statistik sinkron secara tepat.
