# Daftar Fitur, Keterbatasan, & Panduan Uji Manual
**Sistem Informasi Klinik Kesehatan (Klinik Tim 7)**  
*Panduan Checklist Pengujian Manual bagi Pengembang / Evaluator*

---

## 1. Daftar Fitur yang Telah Selesai Diimplementasikan

### A. Halaman Publik (Tanpa Autentikasi)
- **Beranda (`/`)**: Hero section, profil klinik terintegrasi database (`/api/public/klinik`), jam operasional dinamis, ringkasan 5 layanan aktif, dan ajakan bertindak (CTA).
- **Layanan (`/layanan`, `/layanan/[id]`)**: Katalog 6 layanan aktif dengan durasi konsultasi dan deskripsi lengkap dari database.
- **Dokter (`/dokter`, `/dokter/[id]`)**: Profil 5 dokter spesialis dan umum dengan nomor SIP, jadwal sesi praktik, dan foto dari Supabase Storage.
- **Jadwal Praktik (`/jadwal`)**: Pencarian jadwal dokter berdasarkan tanggal dan hari praktik.
- **Lokasi & Kontak (`/lokasi`)**: Alamat klinik, koordinat peta OpenStreetMap, jam operasional, dan kontak darurat.
- **Autentikasi (`/login`, `/daftar`)**: Formulir login aman (cookie HttpOnly) dan registrasi pasien baru dengan validasi Zod.

### B. Dasbor Pasien (`/pasien` atau `/dashboard`)
- **Pendaftaran Kunjungan**: Pemilihan layanan, dokter yang bertugas, tanggal praktik sesuai jadwal (BR-13), sesi kuota antrean, dan validasi anti-duplikasi (BR-02).
- **Tiket Antrean Live**: Nomor antrean unik per dokter per tanggal dengan status real-time (`menunggu`, `dipanggil`, `diperiksa`, `selesai`).
- **Polling Antrean Otomatis**: Pembaruan status antrean berkala setiap 5 detik dengan listener `visibilitychange` (polling dijeda otomatis saat tab peramban tersembunyi guna menghemat bandwidth).
- **Pembatalan Mandiri (BR-08)**: Pasien dapat membatalkan kunjungan selama antrean masih berstatus `menunggu` dan dilakukan paling lambat 2 jam sebelum jam praktik dimulai.
- **Riwayat Medis Pribadi (`/riwayat/[id]`)**: Akses riwayat kunjungan masa lalu beserta catatan pemeriksaan dan tindakan medis (terisolasi ketat dari pasien lain).
- **Web Push Notification**: Tombol opt-in izin notifikasi peramban untuk menerima update pemanggilan antrean secara langsung.

### C. Dasbor Petugas Loket (`/petugas`)
- **Manajemen Kedatangan Pasien (Check-in, BR-05)**: Mengubah status kunjungan terdaftar menjadi hadir saat pasien tiba di klinik.
- **Pemanggilan Antrean**: Memanggil antrean pasien yang telah hadir ke ruang tunggu dokter.
- **Pelewatan & Pembatalan Antrean (BR-15)**: Melewati (*skip*) atau membatalkan antrean dengan input alasan wajib minimal 3 karakter.
- **Pendaftaran Walk-In (BR-12)**: Mendaftarkan pasien walk-in langsung di tempat tanpa mewajibkan kepemilikan akun login.
- **Pencarian & Koreksi Pasien**: Pencarian data pasien berdasarkan No. RM, NIK, atau nama.

### D. Dasbor Dokter (`/dokter-dashboard`)
- **Antrean Pasien Khusus**: Menampilkan hanya pasien yang terdaftar pada dokter yang sedang login (isolasi data antar dokter).
- **Mulai Pemeriksaan (BR-06, K14)**: Memulai sesi konsultasi (status antrean berubah menjadi `diperiksa`).
- **Pencatatan Rekam Medis & Tindakan (BR-18)**: Pengisian anamnesis, tanda-tanda vital fisiologis valid (sistolik, diastolik, suhu, berat badan, tinggi badan), diagnosis, dan tindakan medis dalam satu transaksi database atomik.
- **Selesaikan Kunjungan (BR-07, BR-09)**: Kunjungan hanya dapat diselesaikan setelah data rekam medis tersimpan.

### E. Dasbor Admin (`/admin`)
- **Manajemen Master Dokter**: Tambah dan kelola dokter, relasi layanan poli (`dokter_layanan`), status aktif, serta unggah foto dokter ke Supabase Storage (validasi biner magic bytes).
- **Manajemen Master Layanan**: Tambah dan sunting katalog layanan klinik beserta durasi konsultasi.
- **Manajemen Jadwal Praktik Dokter**: Tambah dan atur sesi jadwal dokter per hari, jam operasional, dan kuota (dengan validasi anti-bentrok jadwal).
- **Manajemen Staf & Pengguna (BR-11)**: Pendaftaran akun staf baru (Petugas dan Dokter) via Supabase Auth Admin (`app_metadata.role`) serta aktivasi/deaktivasi akun.
- **Pengaturan Profil Klinik**: Mengatur informasi publik klinik, koordinat peta, dan jam operasional.
- **Rekapitulasi Kunjungan**: Laporan agregasi data kunjungan real-time dengan filter tanggal, dokter, layanan, status, dan ekspor data tabel.

### F. Infrastruktur, Keamanan, & Background Worker
- **Notifikasi Web Push VAPID**: Pengiriman push notification berbasis outbox pattern via Service Worker `sw.js` dan pustaka `web-push`.
- **Background Worker BullMQ**: Pemrosesan antrean tugas terpisah (`worker/index.mjs`) dengan penanganan retry exponential backoff dan pembersihan otomatis langganan 404/410.
- **Validasi Tiga Lapis**: Frontend (React) -> Backend (Zod di semua endpoint) -> Database (PostgreSQL constraints & partial index).
- **Keamanan Sesi**: Cookie HttpOnly, SameSite=Lax, proteksi CSRF Origin header, dan middleware redirect 307.
- **Sliding-Window Rate Limiting**: Proteksi endpoint kritis (login, register, pendaftaran kunjungan, push) dengan mekanisme fail-open saat Redis offline.
- **Observabilitas Pino Logger**: Log terstruktur dengan redaksi otomatis data rahasia (password, token, cookie, database URL).

---

## 2. Keterbatasan Sistem yang Diketahui

1. **Pengujian Visual Browser Manual**: Sebagai agen berbasis terminal (CLI), pengujian layout visual responsif dan navigasi keyboard peramban tidak dapat dieksekusi secara otonom oleh agen dan memerlukan verifikasi manual oleh pengguna menggunakan checklist di bawah.
2. **Penentuan Alamat IP Klien**: Rate limiter membaca IP dari header `x-forwarded-for`. Diperlukan reverse proxy tepercaya (seperti Vercel atau Cloudflare) di lingkungan produksi untuk mencegah *spoofing* header oleh klien.
3. **Peringatan ESLint `react-hooks/exhaustive-deps`**: 6 peringatan dependensi useEffect dipertahankan apa adanya demi menjaga kestabilan polling dan mencegah infinite render loop pada komponen frontend.
4. **Cakupan Pengujian Web Push**: Pengujian Web Push telah diverifikasi pada Chromium desktop, namun memerlukan pengujian langsung pada ragam perangkat fisik mobile (iOS PWA Safari 16.4+ dan Android).

---

## 3. Checklist Panduan Pengujian Manual untuk Pengguna

> [!IMPORTANT]
> Agen tidak memiliki peramban visual (browser). Mohon lakukan checklist pengujian manual berikut di peramban Anda untuk memverifikasi aspek responsivitas dan aksesibilitas keyboard:

### A. Checklist Uji Responsivitas Tampilan Ponsel (Lebar Layar 375 px)
*Buka browser (Chrome / Edge / Firefox), tekan `F12` (DevTools), aktifkan **Device Toolbar** (`Ctrl+Shift+M`), dan pilih preset **iPhone SE** atau setel lebar tepat **375 px**.*

- [ ] **1. Halaman Beranda (`/`)**:
  - [ ] Apakah teks judul hero section membungkus rapi (*wrap*) tanpa terpotong (*overflow* horizontal)?
  - [ ] Apakah tombol navigasi menu mobile (hamburger menu) dapat diklik dan membuka drawer/dropdown dengan mulus?
  - [ ] Apakah kartu layanan dan jadwal praktik tersusun rapi secara vertikal (1 kolom)?
- [ ] **2. Formulir Pendaftaran Kunjungan (`/pasien` atau `/dashboard`)**:
  - [ ] Apakah dropdown pilihan layanan, dokter, tanggal, dan sesi jadwal pas dengan lebar layar 375 px?
  - [ ] Apakah tombol "Kirim Pendaftaran" terlihat jelas dan tidak tertutup footer?
- [ ] **3. Dasbor Tabel Petugas & Admin (`/petugas`, `/admin`)**:
  - [ ] Apakah tabel antrean kunjungan memiliki scrollbar horizontal (*horizontal scroll*) sehingga tidak merusak tata letak halaman?
  - [ ] Apakah tombol aksi (*Check-in*, *Panggil*, *Lewati*, *Batal*) mudah disentuh (*touch-friendly*)?
- [ ] **4. Dasbor Pemeriksaan Dokter (`/dokter-dashboard`)**:
  - [ ] Apakah input tanda-tanda vital (sistolik, diastolik, suhu, berat, tinggi) tersusun rapi pada layar 375 px?

### B. Checklist Aksesibilitas Navigasi Keyboard
*Gunakan keyboard saja (tanpa menyentuh mouse/touchpad).*

- [ ] **1. Fokus Indikator Visual**:
  - [ ] Tekan tombol `Tab` berulang kali dari atas halaman. Apakah elemen yang aktif (link, tombol, input) memiliki cincin fokus (*focus ring*) yang kontras dan jelas?
- [ ] **2. Navigasi Formulir Login & Registrasi**:
  - [ ] Tekan `Tab` untuk berpindah antar-field (Email -> Kata Sandi -> Tombol Masuk).
  - [ ] Tekan tombol `Enter` saat berada di tombol Masuk. Apakah formulir berhasil di-submit?
- [ ] **3. Interaksi Modal / Dialog**:
  - [ ] Buka dialog/modal (misal: modal alasan pembatalan atau form tambah dokter).
  - [ ] Tekan tombol `Esc` (Escape). Apakah modal tertutup secara otomatis?
  - [ ] Apakah fokus keyboard terperangkap di dalam modal saat modal aktif (*focus trap*)?
- [ ] **4. Navigasi Dropdown & Menu**:
  - [ ] Gunakan tombol panah `Arrow Up` / `Arrow Down` dan `Enter` untuk memilih opsi pada dropdown pilihan dokter/layanan.
