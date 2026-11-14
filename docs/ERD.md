# Diagram Hubungan Entitas (Entity-Relationship Diagram - ERD)
**Sistem Informasi Klinik Kesehatan (Klinik Tim 7)**  
*Diekstrak langsung dan divalidasi 100% terhadap `src/db/schema.ts` dan migrasi PostgreSQL*

---

## 1. Diagram Mermaid ERD

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : "memiliki profil (id)"
    PROFILES ||--o| PASIEN : "profile_id (opsional walk-in)"
    PROFILES ||--o| DOKTER : "profile_id (staf dokter)"
    PROFILES ||--o{ KUNJUNGAN : "dibuat_oleh"
    PROFILES ||--o{ NOTIFIKASI : "profile_id"
    PROFILES ||--o{ PUSH_SUBSCRIPTIONS : "profile_id"

    DOKTER ||--|{ DOKTER_LAYANAN : "dokter_id"
    LAYANAN ||--|{ DOKTER_LAYANAN : "layanan_id"

    DOKTER ||--o{ JADWAL_PRAKTIK : "dokter_id"
    DOKTER ||--o{ KUNJUNGAN : "dokter_id"
    DOKTER ||--o{ ANTREAN : "dokter_id"
    DOKTER ||--o{ PEMERIKSAAN : "dokter_id"

    LAYANAN ||--o{ KUNJUNGAN : "layanan_id"
    JADWAL_PRAKTIK ||--o{ KUNJUNGAN : "jadwal_id"
    PASIEN ||--o{ KUNJUNGAN : "pasien_id"

    KUNJUNGAN ||--|| ANTREAN : "kunjungan_id (1 to 1)"
    KUNJUNGAN ||--o| PEMERIKSAAN : "kunjungan_id (1 to 1)"

    PEMERIKSAAN ||--o{ TINDAKAN : "pemeriksaan_id (1 to N)"

    AUTH_USERS {
        uuid id PK
    }

    PROFILES {
        uuid id PK,FK "auth.users.id"
        text nama
        text telepon
        user_role role "'pasien' | 'petugas' | 'dokter' | 'admin'"
        boolean status_aktif "default true"
        timestamptz created_at "default now()"
    }

    PASIEN {
        uuid id PK
        uuid profile_id FK "nullable untuk walk-in"
        text no_rekam_medis UK "'RM-xxxxxx'"
        text nama
        text nik UK "16 digit angka"
        date tanggal_lahir
        text jenis_kelamin "'L' | 'P'"
        text alamat
        text telepon
        text kontak_darurat
        timestamptz created_at "default now()"
    }

    DOKTER {
        uuid id PK
        uuid profile_id FK,UK "nullable"
        text nama
        text spesialisasi
        text no_sip UK
        text foto_path "Supabase Storage bucket foto-dokter"
        text deskripsi
        boolean aktif "default true"
    }

    LAYANAN {
        uuid id PK
        text nama_layanan UK
        text deskripsi
        integer durasi_menit "1..480"
        boolean aktif "default true"
    }

    DOKTER_LAYANAN {
        uuid dokter_id PK,FK
        uuid layanan_id PK,FK
    }

    JADWAL_PRAKTIK {
        uuid id PK
        uuid dokter_id FK
        smallint hari "0 (Minggu) .. 6 (Sabtu)"
        time jam_mulai
        time jam_selesai "jam_selesai > jam_mulai"
        integer kuota "kuota > 0"
        boolean aktif "default true"
    }

    KUNJUNGAN {
        uuid id PK
        text no_referensi UK "'KJ-xxxxxxxx'"
        uuid pasien_id FK
        uuid dokter_id FK
        uuid layanan_id FK
        uuid jadwal_id FK
        uuid dibuat_oleh FK "profiles.id"
        date tanggal
        text keluhan "1..500 karakter"
        sumber_daftar sumber "'online' | 'walk_in'"
        status_kunjungan status "'terdaftar' | 'hadir' | 'selesai' | 'batal'"
        timestamptz created_at "default now()"
    }

    ANTREAN {
        uuid id PK
        uuid kunjungan_id FK,UK "1 to 1 relasi kunjungan"
        uuid dokter_id FK
        date tanggal
        integer nomor_antrean "nomor_antrean > 0"
        status_antrean status "'menunggu' | 'dipanggil' | 'diperiksa' | 'selesai' | 'dilewati' | 'batal'"
        text alasan "wajib bila dilewati / batal"
        timestamptz waktu_dipanggil
    }

    PEMERIKSAAN {
        uuid id PK
        uuid kunjungan_id FK,UK "1 to 1 relasi kunjungan"
        uuid dokter_id FK
        text anamnesis
        jsonb tanda_vital "sistolik, diastolik, suhu, berat_badan, tinggi_badan (BR-18)"
        text diagnosis
        text catatan
        timestamptz created_at "default now()"
    }

    TINDAKAN {
        uuid id PK
        uuid pemeriksaan_id FK
        text nama_tindakan
        text keterangan
        text saran
    }

    NOTIFIKASI {
        uuid id PK
        uuid profile_id FK
        text pesan
        boolean is_read "default false"
        text jenis_kejadian "'KUNJUNGAN_TERDAFTAR' | 'PENDAFTARAN_BARU' | 'ANTREAN_DIPANGGIL' | 'KUNJUNGAN_DIBATALKAN' | 'GILIRAN_MENDEKAT' | 'ANTREAN_DILEWATI' | 'INFO'"
        text tautan
        text push_status "'menunggu' | 'berhasil' | 'gagal'"
        integer push_percobaan "default 0"
        text push_error
        timestamptz push_diproses_at
        timestamptz created_at "default now()"
    }

    PUSH_SUBSCRIPTIONS {
        uuid id PK
        uuid profile_id FK
        text endpoint UK
        text p256dh
        text auth
        text user_agent
        boolean aktif "default true"
        timestamptz created_at "default now()"
        timestamptz last_success_at
    }

    PROFIL_KLINIK {
        uuid id PK
        text nama
        text deskripsi
        text alamat
        numeric latitude "-90 .. 90"
        numeric longitude "-180 .. 180"
        text kontak
        jsonb jam_operasional
    }
```

---

## 2. Rincian Batasan & Indeks Penting Database (Lapisan Ketiga)

| Tabel | Tipe Batasan / Indeks | Definisi & Tujuan |
|---|---|---|
| `pasien` | `CHECK (pasien_nik_check)` | `nik ~ '^[0-9]{16}$'` (Wajib persis 16 digit angka, K10) |
| `pasien` | `UNIQUE INDEX (uq_pasien_nik)` | NIK tidak boleh terdaftar ganda di database |
| `dokter` | `UNIQUE (dokter_no_sip_key)` | Nomor Surat Izin Praktik dokter wajib unik |
| `layanan` | `CHECK (layanan_durasi_menit_check)` | Durasi konsultasi antara 1 sampai 480 menit |
| `jadwal_praktik` | `CHECK (ck_jadwal_jam)` | `jam_selesai > jam_mulai` |
| `jadwal_praktik` | `CHECK (jadwal_praktik_kuota_check)` | `kuota > 0` |
| `kunjungan` | `UNIQUE PARTIAL INDEX (uq_kunjungan_aktif)` | `(pasien_id, jadwal_id, tanggal) WHERE status <> 'batal'` (Anti pendaftaran ganda pada jadwal & tanggal sama, BR-02) |
| `antrean` | `UNIQUE (uq_antrean_nomor)` | `(dokter_id, tanggal, nomor_antrean)` (Nomor antrean unik per dokter per tanggal, BR-03) |
| `antrean` | `CHECK (ck_antrean_alasan)` | Status `dilewati` dan `batal` wajib memiliki alasan (BR-15) |
| `pemeriksaan` | `CHECK (pemeriksaan_tanda_vital_check)` | Fungsi `fn_valid_tanda_vital(tanda_vital)` memvalidasi batas fisiologis (sistolik 50–300, diastolik 30–200, suhu 30–45, berat_badan 1–500, tinggi_badan 20–250, BR-18) |
| `notifikasi` | `INDEX (idx_notifikasi_push)` | Indeks komposit `(push_status, created_at)` untuk efisiensi polling outbox background worker BullMQ |
