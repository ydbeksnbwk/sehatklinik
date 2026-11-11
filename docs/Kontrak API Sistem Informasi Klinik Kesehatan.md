# Kontrak API Sistem Informasi Klinik Kesehatan

## 1. Aturan umum

- **Base URL:** `/api` (Route Handlers Next.js). Format JSON, UTF-8.
- **Penamaan:** field JSON memakai camelCase (`namaLayanan`). Kolom database tetap snake\_case; backend yang menerjemahkan.
- **Tanggal dan jam:** tanggal `YYYY-MM-DD`, jam `HH:MM`, waktu lengkap ISO 8601 (UTC). Hari praktik: 0 = Minggu sampai 6 = Sabtu.
- **Autentikasi:** sesi Supabase Auth tersimpan di cookie httpOnly yang dikelola server. Frontend memanggil `fetch('/api/...', { credentials: 'same-origin' })` dan tidak mengirim token sendiri. Role dan ID pengguna selalu dibaca server dari sesi dan tabel `profiles`; nilai role atau ID yang dikirim client diabaikan.
- **Respons sukses:** `{ "data": ... }`. Untuk daftar ditambah `"meta": { "page": 1, "pageSize": 10, "total": 42, "totalPages": 5 }`.
- **Respons gagal:** `{ "error": { "code": "KODE", "message": "Pesan siap tampil", "fields": { "email": "Format email tidak valid" } } }`. Properti `fields` hanya ada untuk galat validasi. `message` berbahasa Indonesia dan aman ditampilkan langsung ke pengguna.
- **Daftar:** parameter `page` (mulai 1), `pageSize` (bawaan 10, maksimal 50), dan `q` untuk pencarian teks bila disebut pada endpoint.
- **Validasi:** skema Zod yang sama dipakai di frontend (pesan di formulir) dan backend (pemeriksaan ulang). Database tetap menjadi lapisan ketiga lewat constraint.
- **Kirim ulang formulir:** tombol dinonaktifkan di frontend; di backend kunjungan aktif ganda ditolak dengan `409 DUPLIKAT`, sehingga klik berulang tidak membuat data ganda.

### Kode status dan kode galat

| Status | `error.code` | Arti |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | Belum login atau sesi tidak valid |
| 403 | `FORBIDDEN` | Role tidak berhak, atau data bukan milik pengguna |
| 404 | `NOT_FOUND` | Data tidak ditemukan (juga dipakai bila data milik orang lain, agar ID tidak bisa ditebak) |
| 422 | `VALIDATION_ERROR` | Input tidak valid, lihat `fields` |
| 409 | `DUPLIKAT` | Kunjungan aktif ganda pada dokter, jadwal, dan tanggal yang sama |
| 409 | `KUOTA_PENUH` | Kuota jadwal pada tanggal itu sudah penuh |
| 409 | `JADWAL_BENTROK` | Jadwal dokter bertumpuk dengan jadwal lain |
| 409 | `STATUS_TIDAK_VALID` | Perubahan status melanggar urutan yang diizinkan |
| 409 | `DATA_TERPAKAI` | Data tidak bisa dihapus karena dipakai data lain (sarankan menonaktifkan) |
| 429 | `RATE_LIMITED` | Terlalu banyak percobaan (login, registrasi) |
| 500 | `INTERNAL` | Kesalahan server; detail hanya di log, tidak dikirim ke client |

## 2. Hak akses ringkas

| Awalan jalur | Pengunjung | Pasien | Petugas | Dokter | Admin |
| --- | --- | --- | --- | --- | --- |
| `/api/auth/*` | ya | ya | ya | ya | ya |
| `/api/public/*` | ya | ya | ya | ya | ya |
| `/api/pasien/*` | tidak | ya | tidak | tidak | tidak |
| `/api/petugas/*` | tidak | tidak | ya | tidak | tidak |
| `/api/dokter/*` | tidak | tidak | tidak | ya | tidak |
| `/api/admin/*` | tidak | tidak | tidak | tidak | ya |
| `/api/notifikasi`, `/api/push/*` | tidak | ya | ya | ya | ya |

Petugas dan Admin tidak pernah dapat membaca isi pemeriksaan dan tindakan. Pasien hanya dapat membaca ringkasan hasil miliknya (hanya-baca). Dokter hanya melihat kunjungan dan pasien yang ia tangani sendiri.

## 3. Objek data

- **Layanan:** `id`, `namaLayanan`, `deskripsi`, `durasiMenit`, `aktif`.
- **Dokter:** `id`, `nama`, `spesialisasi`, `noSip`, `deskripsi`, `fotoUrl` (alamat publik berkas di Storage atau `null`), `aktif`, `layanan` (daftar Layanan ringkas), `jadwal` (daftar Jadwal).
- **Jadwal:** `id`, `dokterId`, `hari`, `jamMulai`, `jamSelesai`, `kuota`, `aktif`.
- **Pasien:** `id`, `noRekamMedis`, `nama`, `nik`, `tanggalLahir`, `jenisKelamin` (`L` atau `P`), `alamat`, `telepon`, `kontakDarurat`, `punyaAkun` (boolean).
- **Kunjungan:** `id`, `noReferensi`, `tanggal`, `status` (`terdaftar`, `hadir`, `selesai`, `batal`), `sumber` (`online`, `walk_in`), `keluhan`, `dokter` {`id`, `nama`, `spesialisasi`}, `layanan` {`id`, `namaLayanan`}, `jadwal` {`id`, `jamMulai`, `jamSelesai`}, `antrean` {`nomorAntrean`, `status`, `alasan`, `waktuDipanggil`}.
- **Status antrean:** `menunggu`, `dipanggil`, `diperiksa`, `selesai`, `dilewati`, `batal`.
- **Pemeriksaan:** `id`, `kunjunganId`, `anamnesis`, `tandaVital` {`sistolik`, `diastolik`, `suhu`, `beratBadan`, `tinggiBadan`}, `diagnosis`, `catatan`, `tindakan` (daftar {`id`, `namaTindakan`, `keterangan`, `saran`}).
- **Notifikasi:** `id`, `pesan`, `dibaca`, `dibuatPada`.

## 4. Autentikasi (`/api/auth`)

| Endpoint | Masukan (body) | Hasil |
| --- | --- | --- |
| `POST /api/auth/register` | `email`, `password` (min 8, huruf dan angka), `nama`, `telepon`, `tanggalLahir`, `jenisKelamin`, opsional `nik` (16 digit), `alamat`, `kontakDarurat` | 201 `{ data: { id, email } }`. Peran selalu pasien; field `role` apa pun diabaikan. Email sudah dipakai menghasilkan 422 dengan `fields.email`. Rate limit berlaku. |
| `POST /api/auth/login` | `email`, `password` | 200 `{ data: { id, nama, role } }` dan cookie sesi. Akun nonaktif atau salah sandi menghasilkan 401 dengan pesan yang sama (tidak membocorkan alasan). Rate limit berlaku. |
| `POST /api/auth/logout` | tanpa body | 200 `{ data: { ok: true } }`, cookie sesi dihapus. |
| `GET /api/auth/me` | tanpa body | 200 `{ data: { id, nama, role } }` atau 401. Dipakai frontend untuk menentukan dasbor yang ditampilkan. |

Pengunjung yang membuka halaman dasbor tanpa sesi diarahkan ke halaman login oleh middleware. Setelah login, frontend mengarahkan sesuai `role`: pasien, petugas, dokter, atau admin.

## 5. Publik (`/api/public`)

Semua `GET`, tanpa login, hanya menampilkan data aktif.

| Endpoint | Query | Hasil |
| --- | --- | --- |
| `/api/public/klinik` | none | Profil klinik: `nama`, `deskripsi`, `alamat`, `latitude`, `longitude`, `kontak`, `jamOperasional` (kunci `"0"`..`"6"` berisi `buka` dan `tutup`) |
| `/api/public/layanan` | `q`, `page`, `pageSize` | Daftar Layanan |
| `/api/public/layanan/:id` | none | Satu Layanan beserta daftar dokter yang melayaninya |
| `/api/public/dokter` | `q`, `layananId`, `page`, `pageSize` | Daftar Dokter (dengan `layanan` dan `jadwal`) |
| `/api/public/dokter/:id` | none | Satu Dokter lengkap |
| `/api/public/jadwal` | `dokterId`, `hari` | Daftar Jadwal aktif |
| `/api/public/jadwal-tersedia` | `tanggal` (wajib), `dokterId`, `layananId` | Daftar sesi pada tanggal itu: `jadwalId`, `dokter` {`id`, `nama`, `spesialisasi`, `fotoUrl`}, `jamMulai`, `jamSelesai`, `kuota`, `terisi`, `sisa`. Hanya jadwal yang harinya cocok dengan tanggal, dokter aktif, dan (bila `layananId` diberikan) dokter yang melayani layanan itu. `sisa` = kuota dikurangi kunjungan aktif (tidak batal). |

## 6. Pasien (`/api/pasien`)

| Endpoint | Masukan | Hasil dan aturan |
| --- | --- | --- |
| `GET /api/pasien/profil` | none | Pasien milik pengguna yang login |
| `PATCH /api/pasien/profil` | salah satu dari `alamat`, `telepon`, `kontakDarurat` | Data terbaru. Field lain (nama, NIK, tanggal lahir, jenis kelamin) ditolak 422. Telepon harus cocok format `+?[0-9]{8,15}`. |
| `POST /api/pasien/kunjungan` | `jadwalId`, `layananId`, `tanggal`, `keluhan` (1 sampai 500 karakter) | 201 `{ data: { kunjunganId, noReferensi, nomorAntrean, tanggal, status: "terdaftar" } }`. Aturan di bagian 10. |
| `GET /api/pasien/kunjungan` | `status`, `dari`, `sampai`, `page`, `pageSize` | Daftar Kunjungan milik pasien, terbaru dahulu |
| `GET /api/pasien/kunjungan/:id` | none | Kunjungan lengkap. Bila sudah ada pemeriksaan, disertakan ringkasan hanya-baca: `diagnosis`, `catatan`, `tindakan`. Kunjungan milik orang lain menghasilkan 404. |
| `GET /api/pasien/kunjungan/:id/antrean` | none | `{ data: { nomorSaya, status, nomorSedangDilayani, antreanDiDepan } }`. Dipanggil berkala (polling 5 sampai 10 detik) atau diganti langganan realtime. |
| `POST /api/pasien/kunjungan/:id/batal` | opsional `alasan` | 200. Hanya bila antrean masih `menunggu` (sebelum dipanggil). Kuota kembali tersedia. Selain itu 409 `STATUS_TIDAK_VALID`. |

## 7. Petugas (`/api/petugas`)

| Endpoint | Masukan | Hasil dan aturan |
| --- | --- | --- |
| `GET /api/petugas/pasien` | `q` (nama, nomor rekam medis, atau telepon), `page`, `pageSize` | Daftar Pasien |
| `POST /api/petugas/pasien` | `nama`, `tanggalLahir`, `jenisKelamin`, opsional `nik`, `alamat`, `telepon`, `kontakDarurat` | 201 Pasien baru tanpa akun (walk-in). `noRekamMedis` dibuat otomatis. |
| `PATCH /api/petugas/pasien/:id` | salah satu field administratif: `nama`, `alamat`, `telepon`, `kontakDarurat`, `nik` | Koreksi data administratif. Nomor rekam medis dan akun tidak bisa diubah. |
| `POST /api/petugas/kunjungan` | `pasienId`, `jadwalId`, `layananId`, `tanggal`, `keluhan` | 201 seperti pendaftaran pasien, dengan `sumber = walk_in`. Aturan kuota, anti-ganda, dan nomor antrean sama persis. |
| `GET /api/petugas/antrean` | `tanggal` (bawaan hari ini), `dokterId`, `status`, `q` | Daftar antrean harian dengan nama pasien, nomor rekam medis, dokter, layanan, keluhan, status kunjungan dan antrean |
| `POST /api/petugas/kunjungan/:id/check-in` | none | Status kunjungan menjadi `hadir`. Hanya dari `terdaftar`. |
| `POST /api/petugas/antrean/:id/panggil` | none | Status antrean `dipanggil`. Hanya bila kunjungan sudah `hadir` dan antrean `menunggu`. |
| `POST /api/petugas/antrean/:id/lewati` | `alasan` (wajib) | Status antrean `dilewati`. Hanya dari `dipanggil`. |
| `POST /api/petugas/kunjungan/:id/batal` | `alasan` (wajib) | Dibatalkan dari antrean `menunggu` atau `dipanggil`. Kuota kembali. |
| `PATCH /api/petugas/kunjungan/:id` | `keluhan` | Koreksi administratif; data pokok kunjungan (dokter, jadwal, tanggal, pasien) tidak dapat diubah. |

Petugas tidak punya endpoint apa pun untuk pemeriksaan dan tindakan.

## 8. Dokter (`/api/dokter`)

Semua data otomatis dibatasi pada dokter yang sedang login.

| Endpoint | Masukan | Hasil dan aturan |
| --- | --- | --- |
| `GET /api/dokter/antrean` | `tanggal` (bawaan hari ini), `status` | Antrean pribadi |
| `POST /api/dokter/antrean/:id/panggil` | none | `dipanggil` (setelah check-in). Antrean dokter lain menghasilkan 403. |
| `POST /api/dokter/antrean/:id/mulai` | none | `diperiksa`. Hanya dari `dipanggil`. Hanya dokter yang boleh memulai pemeriksaan. |
| `GET /api/dokter/kunjungan/:id` | none | Kunjungan miliknya beserta pemeriksaan (bila ada) |
| `PUT /api/dokter/kunjungan/:id/pemeriksaan` | `anamnesis`, `diagnosis` (wajib), `catatan`, `tandaVital`, `tindakan`: daftar {`namaTindakan` (wajib), `keterangan`, `saran`} | 200 `{ data: { pemeriksaanId } }`. Hanya saat antrean `diperiksa`. Dapat disimpan ulang (mengganti isi dan seluruh tindakan). Rentang tanda vital: sistolik 50 sampai 300, diastolik 30 sampai 200, suhu 30 sampai 45, berat badan 1 sampai 500, tinggi badan 20 sampai 250. Nilai di luar rentang menghasilkan 422. |
| `POST /api/dokter/kunjungan/:id/selesai` | none | Kunjungan dan antrean menjadi `selesai`. Ditolak 409 bila belum ada pemeriksaan atau antrean belum `diperiksa`. |
| `GET /api/dokter/pasien/:pasienId/riwayat` | `page` | Riwayat pasien hanya dari kunjungan yang ditangani dokter ini |

## 9. Admin (`/api/admin`)

| Endpoint | Masukan | Hasil dan aturan |
| --- | --- | --- |
| `GET/POST /api/admin/dokter` | daftar: `q`, `page`; tambah: `nama`, `spesialisasi`, `noSip` (unik), `deskripsi` | Dokter. `noSip` ganda menghasilkan 422. |
| `GET/PATCH/DELETE /api/admin/dokter/:id` | PATCH: field Dokter termasuk `aktif` | DELETE menonaktifkan; bila dipakai kunjungan menghasilkan 409 `DATA_TERPAKAI` |
| `PUT /api/admin/dokter/:id/layanan` | `layananIds` (daftar) | Mengganti relasi dokter dan layanan |
| `POST /api/admin/dokter/:id/foto` | `multipart/form-data` berkas `foto` | 200 `{ data: { fotoUrl } }`. Tipe JPG, PNG, atau WebP; maksimal 2 MB (diperiksa di server). Berkas ke Storage bucket `foto-dokter`; database hanya menyimpan path. |
| `GET/POST /api/admin/layanan`, `GET/PATCH/DELETE /api/admin/layanan/:id` | `namaLayanan` (unik), `deskripsi`, `durasiMenit` (1 sampai 480), `aktif` | Layanan |
| `GET/POST /api/admin/jadwal`, `PATCH/DELETE /api/admin/jadwal/:id` | `dokterId`, `hari`, `jamMulai`, `jamSelesai` (> jamMulai), `kuota` (> 0), `aktif` | Jadwal. Jadwal aktif dokter yang sama pada hari yang sama dengan jam bertumpuk menghasilkan 409 `JADWAL_BENTROK`. |
| `GET /api/admin/pengguna` | `role`, `q`, `page` | Daftar akun: `id`, `nama`, `email`, `telepon`, `role`, `statusAktif` |
| `POST /api/admin/pengguna` | `email`, `password`, `nama`, `telepon`, `role` (`petugas`, `dokter`, `admin`); untuk dokter: `dokterId` untuk menautkan dokter yang sudah ada, atau `spesialisasi` dan `noSip` untuk membuat baru | 201. Dibuat di server dengan kunci service role; role disimpan di `app_metadata`. |
| `PATCH /api/admin/pengguna/:id` | `role`, `statusAktif` | Hanya Admin. Admin tidak dapat mengubah role atau status akunnya sendiri. Akun nonaktif tidak bisa login. |
| `GET/PUT /api/admin/klinik` | `nama`, `deskripsi`, `alamat`, `latitude`, `longitude`, `kontak`, `jamOperasional` | Profil klinik (satu baris) |
| `GET /api/admin/kunjungan` | `dari`, `sampai`, `dokterId`, `layananId`, `status`, `sumber`, `q`, `page` | Daftar kunjungan (tanpa isi pemeriksaan), konsisten dengan rekap |
| `GET /api/admin/rekap` | `dari`, `sampai`, `dokterId`, `layananId`, `status`, `sumber`, `kelompok` (`tanggal`, `minggu`, `bulan`, `dokter`, `layanan`, `status`) | `{ data: { total, perStatus: { terdaftar, hadir, selesai, batal }, baris: [{ kunci, label, jumlah }] } }`. Dihitung dari database. Jumlah semua baris sama dengan `total` dan sama dengan jumlah baris pada `/api/admin/kunjungan` untuk filter yang sama. |

## 10. Aturan bisnis yang ditegakkan backend

### Pendaftaran kunjungan (pasien dan petugas)

Urutan pemeriksaan dalam satu transaksi database:

1. Pengguna login dan aktif. Pasien hanya mendaftarkan dirinya (`sumber = online`). Petugas wajib mengirim `pasienId` yang ada (`sumber = walk_in`). Peran lain ditolak 403.
2. `tanggal` tidak boleh sebelum hari ini (zona Asia/Jakarta). `keluhan` 1 sampai 500 karakter setelah dipangkas spasi.
3. Jadwal ada dan aktif (dikunci `FOR UPDATE`); hari pada `tanggal` sama dengan `hari` jadwal; dokter aktif; dokter melayani layanan yang dipilih dan layanan aktif.
4. Kunci per dokter dan tanggal (`pg_advisory_xact_lock`), agar kuota dan nomor antrean tidak balapan.
5. Tidak ada kunjungan aktif (status bukan `batal`) untuk pasien, jadwal, dan tanggal yang sama, jika ada: 409 `DUPLIKAT`.
6. Jumlah kunjungan aktif pada jadwal dan tanggal itu kurang dari `kuota`, jika tidak: 409 `KUOTA_PENUH`.
7. Nomor antrean = nomor terbesar dokter pada tanggal itu ditambah 1. Simpan kunjungan (status `terdaftar`, `noReferensi` otomatis) dan antrean (status `menunggu`).
8. Setelah transaksi tersimpan, buat notifikasi dan masukkan pekerjaan Web Push ke antrean. Kegagalan notifikasi tidak boleh membatalkan pendaftaran.

### Urutan status

| Objek | Dari | Ke | Siapa | Syarat |
| --- | --- | --- | --- | --- |
| Kunjungan | `terdaftar` | `hadir` | Petugas | Check-in |
| Kunjungan | `hadir` | `selesai` | Dokter pemilik | Pemeriksaan sudah tersimpan |
| Kunjungan | `terdaftar`, `hadir` | `batal` | Pasien atau Petugas | Lihat aturan pembatalan |
| Antrean | `menunggu` | `dipanggil` | Petugas atau dokter pemilik | Kunjungan sudah `hadir` |
| Antrean | `dipanggil` | `diperiksa` | Dokter pemilik | none |
| Antrean | `dipanggil` | `dilewati` | Petugas atau dokter pemilik | Alasan wajib |
| Antrean | `menunggu`, `dipanggil` | `batal` | Petugas | Alasan wajib |
| Antrean | `diperiksa` | `selesai` | Dokter pemilik (lewat selesaikan) | Pemeriksaan sudah ada |

Status akhir (`selesai`, `dilewati`, `batal`) tidak dapat diubah lagi. Perubahan di luar tabel ini menghasilkan 409 `STATUS_TIDAK_VALID`.

### Pembatalan

- **Pasien:** hanya kunjungan miliknya, hanya saat antrean `menunggu`.
- **Petugas:** antrean `menunggu` atau `dipanggil`, alasan wajib.
- Kunjungan batal tidak dihitung sebagai kunjungan aktif sehingga kuota kembali.

## 11. Notifikasi dan Web Push

| Endpoint | Masukan | Hasil |
| --- | --- | --- |
| `GET /api/notifikasi` | `dibaca` (true atau false), `page` | Notifikasi milik pengguna |
| `PATCH /api/notifikasi/:id/baca` | none | Tandai dibaca (hanya miliknya) |
| `POST /api/notifikasi/baca-semua` | none | Tandai semua dibaca |
| `GET /api/push/vapid-public-key` | none | `{ data: { publicKey } }` untuk subscribe di browser |
| `POST /api/push/subscribe` | `endpoint`, `keys` {`p256dh`, `auth`} (bentuk objek `PushSubscription`) | 201. Disimpan dan dikaitkan dengan pengguna; endpoint yang sama tidak diduplikasi. |
| `DELETE /api/push/subscribe` | `endpoint` | 200 |

Kejadian bisnis yang memicu notifikasi dan Web Push:

| Kejadian | Penerima | Isi singkat | Tautan saat diklik |
| --- | --- | --- | --- |
| Pendaftaran berhasil | Pasien (bila berakun) | Nomor antrean dan tanggal | Halaman detail kunjungan |
| Pendaftaran online baru | Semua petugas aktif | Nomor antrean dan tanggal | Dasbor antrean |
| Antrean dipanggil | Pasien | Giliran Anda dipanggil | Halaman status antrean |
| Giliran hampir tiba | Pasien berikutnya yang menunggu | Nomor antrean | Halaman status antrean |
| Antrean dilewati atau dibatalkan | Pasien | Alasan | Halaman detail kunjungan |

Alur: kejadian bisnis, database (baris `notifikasi`), antrean pekerjaan, worker, Web Push, service worker, notifikasi di browser. Muatan push: `{ "title", "body", "url" }`.

## 12. Hal yang perlu disepakati backend dan frontend

- Pembaruan status antrean di tampilan:  langganan realtime .
- Penanganan galat di frontend: tampilkan `error.message`; untuk `422` tampilkan `error.fields` di bawah kolom yang bersangkutan.
