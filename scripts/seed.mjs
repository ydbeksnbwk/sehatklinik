// Seed database idempoten terstandar untuk demonstrasi & pengujian klinis.

import pg from "pg";

// 1. Penanda Keamanan Produksi (Wajib SEED_ALLOW=1)
if (process.env.SEED_ALLOW !== "1") {
  console.error("=================================================================");
  console.error("GALAT KEAMANAN: SEED_ALLOW=1 wajib disetel untuk menjalankan seed.");
  console.error("Hal ini mencegah penimpaan data tanpa sengaja pada database produksi.");
  console.error("Gunakan perintah: $env:SEED_ALLOW=\"1\"; npm run db:seed");
  console.error("=================================================================");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("GALAT: DATABASE_URL tidak ditemukan di environment.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Helper menghitung tanggal valid sesuai hari jadwal (0 = Minggu ... 6 = Sabtu)
// Menjamin aturan BR-13: bukan masa lalu, dan hari ini sebelum jam selesai
function hitungTanggalPraktik(hariTarget, jamSelesaiStr = "23:59:00", mingguOffset = 0) {
  const now = new Date();
  const hariSekarang = now.getDay();
  let selisihHari = (hariTarget - hariSekarang + 7) % 7;

  if (selisihHari === 0) {
    const [jamS, menitS] = jamSelesaiStr.split(":").map(Number);
    const batasJam = new Date(now);
    batasJam.setHours(jamS, menitS, 0, 0);
    // Jika jam operasional hari ini sudah lewat, jadwalkan untuk minggu depan
    if (now >= batasJam) {
      selisihHari = 7;
    }
  }

  selisihHari += mingguOffset * 7;
  const d = new Date(now);
  d.setDate(d.getDate() + selisihHari);
  return d.toISOString().split("T")[0]; // format YYYY-MM-DD
}

async function main() {
  console.log("==========================================================");
  console.log("       SEED DATABASE KLINIK TIM 7 (IDEMPOTEN)             ");
  console.log("==========================================================");

  await client.connect();
  await client.query("BEGIN");
  // Bungkam trigger sementara selama transaksi seed agar data kunjungan/antrean
  // seed tidak memicu ratusan notifikasi liar berulang (menjamin idempotensi sejati)
  await client.query("SET LOCAL session_replication_role = 'replica'");

  try {
    // -------------------------------------------------------------------------
    // A. PROFIL KLINIK
    // -------------------------------------------------------------------------
    console.log("[1] Memeriksa & menginisialisasi profil klinik...");
    const profilKlinikId = "47feeb52-3ca1-49d3-991f-e6cd44a80314";
    const clinicDetailData = {
      tagline: "Perawatan Sepenuh Hati, Hidup Lebih Berarti",
      emergencyPhone: "021-555-0911 (Layanan Darurat Ringan 24 Jam)",
      whatsapp: "0812-9988-7700",
      email: "halo@sehatklinik.id",
      history: "Didirikan pada tahun 2018 di kawasan Jakarta Selatan, Klinik Sehat Sentosa lahir dari kepedulian mendalam terhadap kebutuhan keluarga urban akan layanan kesehatan tingkat pertama yang terpercaya, bersih, dan bebas dari kelelahan mengantre fisik. Berawal dari 2 ruang periksa sederhana, kini Klinik Sehat Sentosa telah berkembang menjadi sentra kesehatan primer terakreditasi paripurna yang melayani lebih dari 15.000 kunjungan pasien dengan dukungan sistem informasi kesehatan digital dan antrean cerdas.",
      vision: "Menjadi mitra fasilitas kesehatan primer pilihan utama keluarga di Indonesia yang unggul dalam mutu klinis, berpusat pada kepedulian pasien, dan terdepan dalam adopsi teknologi kesehatan digital.",
      mission: [
        "Menyelenggarakan pelayanan kesehatan primer yang komprehensif, promotif, preventif, kuratif, dan rehabilitatif secara berkesinambungan.",
        "Mengedepankan transparansi waktu tunggu dan kemudahan akses konsultasi dokter melalui sistem antrean digital terintegrasi.",
        "Menjamin mutu keselamatan pasien (patient safety) melalui protokol sterilisasi medis berstandar Kemenkes RI dan tenaga kesehatan tersertifikasi.",
        "Membangun hubungan jangka panjang yang empatik antara tenaga medis dan keluarga pasien dalam suasana klinik yang hangat dan menenangkan."
      ],
      values: [
        {
          title: "Kepedulian Tulus (Care & Empathy)",
          subtitle: "Mendengarkan Sebelum Mendiagnosis",
          desc: "Setiap pasien diperlakukan sebagai pribadi seutuhnya, bukan sekadar angka statistik. Kami mendengar setiap keluhan dengan seksama dan empati.",
          icon: "heart"
        },
        {
          title: "Integritas & Keahlian (Professional Clinical)",
          subtitle: "Standar Medis Tanpa Kompromi",
          desc: "Seluruh dokter dan tenaga kesehatan mengantongi STR aktif, SIP resmi, dan terus memperbarui kompetensi ilmiah demi keselamatan pasien.",
          icon: "shield"
        },
        {
          title: "Aksesibilitas Modern (Smart & Transparent)",
          subtitle: "Bebas Antre Panjang & Terbuka",
          desc: "Integrasi sistem pendaftaran daring, kuota terukur, dan notifikasi Web Push real-time memastikan waktu pasien dihargai secara maksimal.",
          icon: "clock"
        },
        {
          title: "Keamanan & Higiene (Hygiene Excellence)",
          subtitle: "Pencegahan & Pengendalian Infeksi",
          desc: "Penerapan standar PPI (Pencegahan & Pengendalian Infeksi) ketat, sterilisasi instrumen autoclave kelas B, serta sanitasi ruangan terjadwal.",
          icon: "check"
        }
      ],
      accreditation: "Terakreditasi PARIPURNA oleh Kementerian Kesehatan RI",
      accreditationNumber: "Sertifikat Fasyankes: No. YM.02.01/REG/1429/2024",
      facilities: [
        {
          name: "Ruang Pemeriksaan Dokter Ergonomis",
          category: "Klinis",
          desc: "Ruang konsultasi privat dengan peredam suara, tata cahaya menenangkan, dan peralatan diagnostik modern kelas medis.",
          icon: "clinic"
        },
        {
          name: "Ruang Tindakan & Gawat Darurat Ringan",
          category: "Tindakan",
          desc: "Dilengkapi monitor tanda vital, oksigen terpusat, nebulizer kompresor, dan instrumen bedah minor steril sekali pakai.",
          icon: "heart"
        },
        {
          name: "Instalasi Farmasi Terpadu",
          category: "Farmasi",
          desc: "Penyimpanan obat terstandar suhu dingin, apoteker siaga untuk konseling cara minum obat, dan jaminan obat asli dari distributor resmi.",
          icon: "shield"
        },
        {
          name: "Pojok Laktasi & Tumbuh Kembang Anak",
          category: "Ibu & Anak",
          desc: "Area ramah anak dengan mainan terdisinfeksi, ruang menyusui privat yang nyaman, serta alat ukur antropometri standar WHO.",
          icon: "users"
        },
        {
          name: "Laboratorium Rujukan Terintegrasi",
          category: "Diagnostik",
          desc: "Titik sampling darah & urine higienis yang terhubung dengan laboratorium diagnostik tersertifikasi ISO untuk hasil akurat dan cepat.",
          icon: "file"
        },
        {
          name: "Ruang Tunggu Sejuk & Ramah Difabel",
          category: "Kenyamanan",
          desc: "Layar monitor display antrean suara, akses kursi roda tanpa undakan, pendingin udara HEPA filter, dan Wi-Fi kecepatan tinggi gratis.",
          icon: "check"
        }
      ],
      stats: [
        { value: "15.000+", label: "Pasien Terlayani", sub: "Sejak tahun 2018 di Jakarta Selatan" },
        { value: "99.4%", label: "Tingkat Kepuasan", sub: "Survei pengalaman layanan pasien berkala" },
        { value: "5 Poli", label: "Layanan Spesialis & Umum", sub: "Dipimpin dokter berkompeten & bersertifikasi" },
        { value: "100%", label: "Digital Outbox Notifikasi", sub: "Transparansi status pendaftaran & antrean" }
      ]
    };

    await client.query(
      `
      INSERT INTO profil_klinik (id, nama, deskripsi, alamat, latitude, longitude, kontak, jam_operasional, detail)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        nama = EXCLUDED.nama,
        deskripsi = EXCLUDED.deskripsi,
        alamat = EXCLUDED.alamat,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        kontak = EXCLUDED.kontak,
        jam_operasional = EXCLUDED.jam_operasional,
        detail = EXCLUDED.detail
      `,
      [
        profilKlinikId,
        "Klinik Sehat Sentosa",
        "Klinik Pratama Terpadu dengan pelayanan rawat jalan umum, gigi, anak, kandungan, dan konsultasi gizi.",
        "Jl. Sehat Sentosa No. 7, Jakarta Selatan",
        "-6.208800",
        "106.845600",
        "+62 812-3456-7890",
        JSON.stringify({
          senin: "08:00 - 20:00",
          selasa: "08:00 - 20:00",
          rabu: "08:00 - 20:00",
          kamis: "08:00 - 20:00",
          jumat: "08:00 - 20:00",
          sabtu: "08:00 - 17:00",
          minggu: "09:00 - 14:00",
        }),
        JSON.stringify(clinicDetailData),
      ]
    );

    // -------------------------------------------------------------------------
    // B. AKUN UJI & PROFILES (1 Admin, 1 Petugas, 2 Dokter, 2 Pasien)
    // -------------------------------------------------------------------------
    console.log("[2] Memastikan 6 akun uji peran di profiles & auth.users...");
    const akunList = [
      {
        id: "a0000000-0000-0000-0000-000000000001",
        email: "admin.klinik@gmail.com",
        nama: "Admin Klinik",
        telepon: "+6281200000001",
        role: "admin",
      },
      {
        id: "a0000000-0000-0000-0000-000000000002",
        email: "rina.petugas@gmail.com",
        nama: "Rina Petugas",
        telepon: "+6281200000002",
        role: "petugas",
      },
      {
        id: "16546208-3e50-4765-82ea-c38eebd434ed",
        email: "dokter.reyhan@gmail.com",
        nama: "dr. Reyhan Adhitama",
        telepon: "+6281200000003",
        role: "dokter",
      },
      {
        id: "d0000000-0000-0000-0000-000000000002",
        email: "nadira.kirana@gmail.com",
        nama: "drg. Nadira Kirana",
        telepon: "+6281200000004",
        role: "dokter",
      },
      {
        id: "b0000000-0000-0000-0000-000000000001",
        email: "ani.wulandari@gmail.com",
        nama: "Ani Wulandari",
        telepon: "+6281200000005",
        role: "pasien",
      },
      {
        id: "b0000000-0000-0000-0000-000000000002",
        email: "budi.santoso@gmail.com",
        nama: "Bagas Saputra",
        telepon: "+6281200000006",
        role: "pasien",
      },
    ];

    for (const a of akunList) {
      await client.query(
        `
        UPDATE auth.users
        SET
          raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb($2::text)),
          raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{nama}', to_jsonb($3::text))
        WHERE id = $1
        `,
        [a.id, a.role, a.nama]
      );

      await client.query(
        `
        INSERT INTO profiles (id, nama, telepon, role, status_aktif)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (id) DO UPDATE SET
          nama = EXCLUDED.nama,
          telepon = EXCLUDED.telepon,
          role = EXCLUDED.role,
          status_aktif = true
        `,
        [a.id, a.nama, a.telepon, a.role]
      );
    }

    // -------------------------------------------------------------------------
    // C. DOKTER (5 Dokter, Penanganan Dokter Ganda Reyhan Adhitama)
    // -------------------------------------------------------------------------
    console.log("[3] Memeriksa data 5 dokter & menangani duplikat dr. Reyhan Adhitama...");

    const primaryReyhanDokterId = "b9cd5971-4e73-4f8b-b0dd-0bc2ba064092";
    const reyhanCheck = await client.query(
      `SELECT id, profile_id FROM dokter WHERE nama ILIKE '%Reyhan Adhitama%' ORDER BY id`
    );

    if (reyhanCheck.rows.length > 1) {
      console.log(`    -> Ditemukan ${reyhanCheck.rows.length} baris dokter Reyhan. Melakukan merger ke ${primaryReyhanDokterId}...`);
      for (const row of reyhanCheck.rows) {
        if (row.id !== primaryReyhanDokterId) {
          await client.query(`UPDATE dokter_layanan SET dokter_id = $1 WHERE dokter_id = $2`, [primaryReyhanDokterId, row.id]);
          await client.query(`UPDATE jadwal_praktik SET dokter_id = $1 WHERE dokter_id = $2`, [primaryReyhanDokterId, row.id]);
          await client.query(`UPDATE kunjungan SET dokter_id = $1 WHERE dokter_id = $2`, [primaryReyhanDokterId, row.id]);
          await client.query(`UPDATE antrean SET dokter_id = $1 WHERE dokter_id = $2`, [primaryReyhanDokterId, row.id]);
          await client.query(`UPDATE pemeriksaan SET dokter_id = $1 WHERE dokter_id = $2`, [primaryReyhanDokterId, row.id]);
          await client.query(`DELETE FROM dokter WHERE id = $1`, [row.id]);
        }
      }
    }

    const dokterList = [
      {
        id: primaryReyhanDokterId,
        profileId: "16546208-3e50-4765-82ea-c38eebd434ed",
        nama: "dr. Reyhan Adhitama",
        spesialisasi: "Dokter Umum",
        noSip: "SIP-2026-0001",
        fotoPath: "dokter/reyhan.png",
        deskripsi: "Dokter umum berpengalaman lebih dari 8 tahun dalam pelayanan medis primer keluarga.",
        aktif: true,
        detail: {
          str: "STR-2026-001",
          education: [
            { degree: "Pendidikan Dokter Umum", institution: "Fakultas Kedokteran Universitas Indonesia", year: "2016" },
            { degree: "Profesi Dokter (dr.)", institution: "FKUI - RSUPN Dr. Cipto Mangunkusumo", year: "2018" },
            { degree: "Continuing Medical Education (CME)", institution: "Ikatan Dokter Indonesia", year: "2023" }
          ],
          experienceYears: 8,
          almamater: "Universitas Indonesia",
          certifications: [
            "Surat Tanda Registrasi (STR) Dokter Aktif KKI",
            "Advanced Cardiac Life Support (ACLS) - PERKI",
            "Advanced Trauma Life Support (ATLS) - IKABI",
            "Sertifikasi Tata Laksana Terpadu Penyakit Tidak Menular"
          ]
        }
      },
      {
        id: "c92bc40c-50f7-4801-be98-8b709d968ddd",
        profileId: "d0000000-0000-0000-0000-000000000002",
        nama: "drg. Nadira Kirana",
        spesialisasi: "Dokter Gigi",
        noSip: "SIP-2026-0002",
        fotoPath: "dokter/nadira.png",
        deskripsi: "Dokter gigi spesialis konservasi dan estetik gigi keluarga.",
        aktif: true,
        detail: {
          str: "STR-2026-002",
          education: [
            { degree: "Sarjana Kedokteran Gigi (S.KG)", institution: "Fakultas Kedokteran Gigi Universitas Gadjah Mada", year: "2017" },
            { degree: "Profesi Dokter Gigi (drg.)", institution: "FKG UGM - RSGM Prof. Soedomo", year: "2019" }
          ],
          experienceYears: 7,
          almamater: "Universitas Gadjah Mada",
          certifications: [
            "Surat Tanda Registrasi (STR) Dokter Gigi Aktif KKI",
            "Persatuan Dokter Gigi Indonesia (PDGI) Cabang Jakarta Selatan",
            "Hands-on Aesthetic Composite Restoration Mastery",
            "Workshop Rotary Endodontic in Daily Practice"
          ]
        }
      },
      {
        id: "f9473e8b-8d4e-43b9-a54e-3ce6102b3730",
        profileId: "d0000000-0000-0000-0000-000000000003",
        nama: "dr. Raka Mahendra, Sp.A",
        spesialisasi: "Spesialis Anak",
        noSip: "SIP-2026-0003",
        fotoPath: "dokter/raka.png",
        deskripsi: "Dokter spesialis anak dengan fokus tumbuh kembang dan imunisasi pediatrik.",
        aktif: true,
        detail: {
          str: "STR-2026-003",
          education: [
            { degree: "Sarjana Kedokteran & Profesi Dokter", institution: "Fakultas Kedokteran Universitas Airlangga", year: "2014" },
            { degree: "Spesialis Anak (Sp.A)", institution: "Fakultas Kedokteran Universitas Indonesia", year: "2020" }
          ],
          experienceYears: 10,
          almamater: "Universitas Airlangga & UI",
          certifications: [
            "Surat Tanda Registrasi (STR) Dokter Spesialis Anak KKI",
            "Anggota Ikatan Dokter Anak Indonesia (IDAI) Jaya",
            "Pediatric Advanced Life Support (PALS) Certified",
            "Pelatihan Resusitasi Neonatus Terstandar IDAI & Kemenkes"
          ]
        }
      },
      {
        id: "e14e6fa1-20f3-4b69-8757-005aa071f2f6",
        profileId: "d0000000-0000-0000-0000-000000000004",
        nama: "dr. Annisa Fadhilla, Sp.OG",
        spesialisasi: "Spesialis Kebidanan & Kandungan",
        noSip: "SIP-2026-0004",
        fotoPath: "dokter/annisa.png",
        deskripsi: "Spesialis obstetri dan ginekologi dengan keahlian perawatan antenatal komprehensif.",
        aktif: true,
        detail: {
          str: "STR-2026-004",
          education: [
            { degree: "Sarjana Kedokteran & Dokter Umum", institution: "Fakultas Kedokteran Universitas Padjadjaran", year: "2015" },
            { degree: "Spesialis Obstetri & Ginekologi (Sp.OG)", institution: "Fakultas Kedokteran Universitas Indonesia", year: "2021" }
          ],
          experienceYears: 9,
          almamater: "Universitas Padjadjaran & UI",
          certifications: [
            "STR Dokter Spesialis Obstetri & Ginekologi KKI",
            "Perkumpulan Obstetri dan Ginekologi Indonesia (POGI)",
            "Sertifikasi Ultrasonografi Dasar & Madya ISUOG",
            "Pelatihan Basic Surgical Skills in Obstetrics & Gynecology"
          ]
        }
      },
      {
        id: "a08b318d-4287-4ff6-9a8a-48370b650127",
        profileId: "d0000000-0000-0000-0000-000000000005",
        nama: "dr. Alea Prameswari, Sp.GK",
        spesialisasi: "Spesialis Gizi Klinis",
        noSip: "SIP-2026-0005",
        fotoPath: "dokter/alea.png",
        deskripsi: "Dokter spesialis gizi klinis untuk penanganan diet metabolik dan nutrisi klinis.",
        aktif: true,
        detail: {
          str: "STR-2026-005",
          education: [
            { degree: "Sarjana Kedokteran & Profesi Dokter", institution: "Fakultas Kedokteran Universitas Diponegoro", year: "2018" },
            { degree: "Spesialis Gizi Klinik (Sp.GK)", institution: "Fakultas Kedokteran Universitas Indonesia", year: "2023" }
          ],
          experienceYears: 6,
          almamater: "Universitas Diponegoro & UI",
          certifications: [
            "Surat Tanda Registrasi (STR) Spesialis Gizi Klinis KKI",
            "Perhimpunan Dokter Spesialis Gizi Klinik Indonesia (PDGKI)",
            "Clinical Nutrition Course ESPEN (European Society for Clinical Nutrition)",
            "Sertifikasi Manajemen Terapi Nutrisi pada Sindrom Metabolik"
          ]
        }
      },
    ];

    for (const d of dokterList) {
      await client.query(
        `
        INSERT INTO dokter (id, profile_id, nama, spesialisasi, no_sip, foto_path, deskripsi, aktif, detail)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          profile_id = EXCLUDED.profile_id,
          nama = EXCLUDED.nama,
          spesialisasi = EXCLUDED.spesialisasi,
          no_sip = EXCLUDED.no_sip,
          foto_path = EXCLUDED.foto_path,
          deskripsi = EXCLUDED.deskripsi,
          aktif = EXCLUDED.aktif,
          detail = EXCLUDED.detail
        `,
        [d.id, d.profileId, d.nama, d.spesialisasi, d.noSip, d.fotoPath, d.deskripsi, d.aktif, JSON.stringify(d.detail || {})]
      );
    }

    // -------------------------------------------------------------------------
    // D. LAYANAN & DOKTER_LAYANAN (5+ Layanan)
    // -------------------------------------------------------------------------
    console.log("[4] Memeriksa 5 layanan & pemetaan dokter_layanan...");
    const layananList = [
      {
        namaLayanan: "Pemeriksaan Umum",
        deskripsi: "Pelayanan kesehatan umum, diagnosis keluhan harian, dan rujukan pengobatan.",
        durasiMenit: 30,
        aktif: true,
        detail: {
          overview: "Poli Umum merupakan pintu utama pelayanan kesehatan primer bagi pasien dari segala usia. Dokter umum kami siap mendengarkan riwayat kesehatan Anda, melakukan skrining fisik yang teliti, mendiagnosis keluhan medis secara rasional, serta merumuskan penanganan medis dan pola hidup preventif yang tepat sasaran.",
          steps: [
            { step: 1, title: "Skrining Tanda Vital & Antropometri", description: "Pemeriksaan tekanan darah, frekuensi denyut nadi, laju napas, suhu tubuh, saturasi oksigen (SpO2), serta indeks massa tubuh (BB/TB)." },
            { step: 2, title: "Anamnesis Medis Mendalam", description: "Konsultasi terperinci mengenai keluhan utama, kronologi sakit, riwayat pengobatan berjalan, alergi obat, dan pola aktivitas harian." },
            { step: 3, title: "Pemeriksaan Fisik Terfokus", description: "Pemeriksaan menyeluruh pada saluran napas, pendengaran, tenggorokan, bunyi jantung dan paru, serta palpasi rongga perut." },
            { step: 4, title: "Diagnosis, Terapi & Edukasi", description: "Penyampaian penjelasan kondisi medis yang mudah dipahami, peresepan obat rasional, surat rujukan bila diperlukan, dan rencana evaluasi." }
          ],
          cases: [
            "Infeksi Saluran Pernapasan Akut (ISPA), batuk, pilek, influenza, dan radang tenggorokan",
            "Demam berdarah dengue (DBD) derajat awal, demam tifoid, dan malaria",
            "Hipertensi (tekanan darah tinggi) dan evaluasi penyakit kardiovaskular dasar",
            "Diabetes Melitus tipe 2 dan pemantauan gula darah sewaktu/puasa",
            "Dispepsia, gastritis (maag), GERD, dan gangguan saluran pencernaan",
            "Alergi musiman, dermatitis kontak, urtikaria (biduran), dan infeksi kulit ringan",
            "Pemeriksaan kesehatan untuk Surat Keterangan Sehat dan kebutuhan administrasi kerja/studi"
          ],
          facilities: [
            "Tensimeter digital aneroid kelas medis terkalibrasi",
            "Stetoskop akustik Littmann Cardiology Series",
            "Pulse Oximeter dan Nebulizer kompresor Omron untuk terapi uap pernapasan",
            "Glukometer, alat tes kolesterol, dan asam urat instan steril",
            "Perangkat minor surgery kit berbahan stainless steel medis bersertifikasi"
          ],
          preparation: "Membawa kartu identitas resmi, membawa daftar nama obat yang sedang dikonsumsi dalam 2 minggu terakhir, dan mencatat riwayat alergi obat/makanan bila ada."
        }
      },
      {
        namaLayanan: "Kesehatan Gigi",
        deskripsi: "Pemeriksaan kesehatan rongga mulut, pembersihan karang gigi, dan penambalan.",
        durasiMenit: 45,
        aktif: true,
        detail: {
          overview: "Poli Gigi Klinik Sehat Sentosa menghadirkan kenyamanan prima bagi pasien yang membutuhkan penanganan masalah gigi dan mulut. Dilengkapi dental chair ergonomis dan pencahayaan sensor LED, dokter gigi kami mengutamakan prosedur minim nyeri serta edukasi pemeliharaan higienitas gigi jangka panjang.",
          steps: [
            { step: 1, title: "Pemeriksaan Ekstraoral & Intraoral", description: "Inspeksi menyeluruh pada gusi, mukosa mulut, lidah, oklusi gigi, serta deteksi dini karies atau karang gigi dengan kaca mulut steril." },
            { step: 2, title: "Rencana Perawatan & Edukasi Visual", description: "Menjelaskan kondisi gigi secara transparan dan mendiskusikan opsi tindakan restoratif yang paling aman dan estetis bagi pasien." },
            { step: 3, title: "Tindakan Klinis Steril & Terarah", description: "Pelaksanaan pembersihan karang gigi (scaling), penambalan estetik komposit sewarna gigi, atau pencabutan atraumatik." },
            { step: 4, title: "Aplikasi Pencegahan & Perawatan Lanjut", description: "Instruksi cara sikat gigi yang benar, anjuran pasta gigi terapeutik, serta penjadwalan pemeliharaan berkala tiap 6 bulan." }
          ],
          cases: [
            "Pembersihan karang gigi (Scaling & Root Planing) supragingiva dan subgingiva",
            "Penambalan gigi karies/berlubang dengan komposit resin estetik sewarna gigi asli",
            "Penanganan radang gusi (Gingivitis) dan periodontitis tahap awal",
            "Pencabutan gigi susu (pediatrik) dan pencabutan gigi dewasa non-komplikasi",
            "Penanganan darurat sakit gigi akibat pulpitis atau infeksi ujung akar",
            "Konsultasi perawatan estetik dan pemutihan gigi (bleaching gigi) yang aman"
          ],
          facilities: [
            "Dental Unit ergonomis dengan foot-control dan sistem penyaringan air steril",
            "Ultrasonic Scaler terkalibrasi frekuensi tinggi untuk pembersihan karang gigi lembut",
            "Light-curing unit LED intensitas tinggi untuk polimerisasi tambalan komposit cepat",
            "Autoclave Class B vakum untuk sterilisasi mikroba instrumen dental 134°C"
          ],
          preparation: "Menyikat gigi bersih sebelum datang ke klinik, sarapan ringan sebelum tindakan dental, dan memberitahukan riwayat konsumsi obat pengencer darah atau alergi anestesi lokal."
        }
      },
      {
        namaLayanan: "Kesehatan Anak",
        deskripsi: "Konsultasi tumbuh kembang balita, imunisasi dasar, dan penanganan demam anak.",
        durasiMenit: 30,
        aktif: true,
        detail: {
          overview: "Kesehatan buah hati Anda adalah prioritas utama kami. Poli Anak dirancang dengan atmosfer yang ceria dan menenangkan untuk mengurangi kecemasan si kecil saat bertemu dokter. Dokter spesialis anak kami mendampingi orang tua memantau kurva pertumbuhan, vaksinasi tepat waktu, serta menangani keluhan kesehatan balita hingga remaja.",
          steps: [
            { step: 1, title: "Antropometri Terstandar WHO", description: "Penimbangan berat badan bayi/anak, pengukuran panjang/tinggi badan, dan lingkar kepala yang diplot langsung ke kurva KMS digital." },
            { step: 2, title: "Skrining Milestone Perkembangan", description: "Evaluasi kemampuan motorik kasar, motorik halus, respons komunikasi, bahasa, serta kemandirian sosial sesuai usia." },
            { step: 3, title: "Pemeriksaan Fisik Ramah Anak", description: "Pemeriksaan dengan teknik bermain (child-friendly examination) tanpa paksaan untuk memeriksa dada, perut, telinga, dan tenggorokan." },
            { step: 4, title: "Vaksinasi / Tata Laksana & Edukasi Orang Tua", description: "Pemberian vaksin sesuai jadwal IDAI, panduan nutrisi MPASI gizi seimbang, serta cara tepat menangani demam di rumah." }
          ],
          cases: [
            "Program Imunisasi Dasar & Tambahan (Hepatitis B, BCG, DPT-HB-Hib, Polio, PCV, Rotavirus, MR/MMR, Influenza, Varicela)",
            "Pemantauan status gizi, pencegahan stunting, dan evaluasi gagal tumbuh (weight faltering)",
            "Batuk, pilek berulang, bronkiolitis, dan penanganan asma pediatrik",
            "Diare akut, muntah, dan pencegahan dehidrasi pada bayi dan balita",
            "Ruam popok, eksim atopik anak, dan kecurigaan alergi susu sapi (CMPA)",
            "Konseling pemberian Makanan Pendamping ASI (MPASI) bertahap dan konseling laktasi"
          ],
          facilities: [
            "Timbangan bayi digital presisi ketelitian 5 gram dengan infantometer terintegrasi",
            "Stadiometer presisi tinggi untuk balita dan anak usia sekolah",
            "Lemari pendingin vaksin khusus medis (2°C – 8°C) dengan pemantau suhu digital 24 jam",
            "Pojok mainan anak edukatif yang disterilisasi rutin dengan sinar UV-C",
            "Nebulizer anak dengan masker silikon lembut beraroma buah"
          ],
          preparation: "Membawa buku KIA (Buku Pink) atau catatan imunisasi sebelumnya, membawa mainan atau selimut favorit anak, dan mengenakan pakaian longgar berkancing depan."
        }
      },
      {
        namaLayanan: "Kebidanan dan Kandungan",
        deskripsi: "Pemeriksaan kehamilan rutin, USG kebidanan dasar, dan konseling reproduksi.",
        durasiMenit: 45,
        aktif: true,
        detail: {
          overview: "Pelayanan kesehatan reproduksi wanita, pemantauan masa kehamilan, dan deteksi dini komplikasi obstetrik dengan pendekatan menyeluruh dan penuh empati bersama dokter spesialis kebidanan dan kandungan terpercaya.",
          steps: [
            { step: 1, title: "Skrining Tanda Vital & Berat Badan Ibu", description: "Pengukuran tekanan darah, denyut nadi, indeks massa tubuh, dan evaluasi kenaikan berat badan kehamilan." },
            { step: 2, title: "Pemeriksaan Fisik & Ultrasonografi (USG)", description: "Evaluasi denyut jantung janin, taksiran berat janin, posisi plasenta, volume air ketuban, dan anatomi organ." },
            { step: 3, title: "Konseling & Edukasi Kehamilan Sehat", description: "Panduan nutrisi ibu hamil, tanda bahaya kehamilan, persiapan persalinan matang, serta perencanaan kontrol berkala." }
          ],
          cases: [
            "Pemeriksaan antenatal rutin (Antenatal Care - ANC) trimester I, II, dan III",
            "Konsultasi program hamil (promil) dan evaluasi kesuburan pasangan",
            "Pemeriksaan ultrasonografi (USG) kebidanan 2D/4D dasar",
            "Penanganan keputihan patologis, gangguan menstruasi, dan nyeri panggul",
            "Konseling kontrasepsi dan pemasangan IUD/implan pascasalin"
          ],
          facilities: [
            "Mesin USG resolusi tinggi dengan probe konveks dan transvaginal",
            "Fetal Doppler digital untuk pemantauan detak jantung janin presisi",
            "Ranjang periksa ginekologi elektrik ergonomis dengan pencahayaan medis terarah",
            "Alat tes laboratorium cepat untuk protein urine dan glukosa urine"
          ],
          preparation: "Membawa buku KIA/buku kontrol kehamilan sebelumnya, mencatat hari pertama haid terakhir (HPHT), dan mengenakan pakaian dua potong yang nyaman."
        }
      },
      {
        namaLayanan: "Konsultasi Gizi",
        deskripsi: "Pengaturan pola makan klinis untuk manajemen berat badan dan penyakit metabolik.",
        durasiMenit: 30,
        aktif: true,
        detail: {
          overview: "Pola makan yang tepat adalah pilar fundamental pemulihan dan pencegahan penyakit. Bersama dokter spesialis gizi klinik kami, Anda akan dipandu memahami kebutuhan nutrisi spesifik tubuh Anda berdasarkan tes komposisi bioimpedansi, riwayat penyakit metabolik, serta preferensi menu sehari-hari yang realistis dijalani.",
          steps: [
            { step: 1, title: "Pengukuran Bioelectrical Impedance Analysis (BIA)", description: "Analisis mendalam mengenai persentase lemak tubuh, massa otot rangka, lemak viseral, kadar air tubuh, dan laju metabolisme basal (BMR)." },
            { step: 2, title: "Analisis Dietary Recall 24 Jam", description: "Evaluasi pola konsumsi makan harian, kebiasaan camilan, asupan garam dan gula tersembunyi, serta kecukupan mikronutrien." },
            { step: 3, title: "Perumusan Terapi Nutrisi Personal", description: "Menghitung target kalori dan distribusi makronutrien (karbohidrat, protein, lemak sehat) yang sesuai dengan kondisi klinis pasien." },
            { step: 4, title: "Pemberian Meal Plan & Evaluasi Berkala", description: "Menyusun contoh menu mingguan yang fleksibel dan lezat, alternatif bahan makanan pengganti, dan jadwal kontrol progres 2-4 minggu." }
          ],
          cases: [
            "Manajemen gizi penderita Sindrom Metabolik, Diabetes Melitus, dan Prediabetes",
            "Diet penurunan kolesterol (Dislipidemia) dan pengendalian asam urat (Hiperurisemia)",
            "Program penurunan berat badan aman (Medical Weight Loss) untuk obesitas",
            "Program peningkatan berat badan dan massa otot bagi pasien malnutrisi atau sarcopenia",
            "Konseling gizi ibu hamil, persiapan menyusui, dan nutrisi pascamelahirkan",
            "Pengaturan pola makan penderita penyakit ginjal kronis stadium awal dan fatty liver"
          ],
          facilities: [
            "Body Composition Analyzer multifrekuensi modern",
            "Food Model takaran porsi edukatif visual",
            "Perangkat lunak kalkulasi gizi medik klinis",
            "Panduan meal plan cetak dan panduan digital praktis untuk dibawa pulang"
          ],
          preparation: "Dianjurkan membawa hasil laboratorium darah terbaru (profil lipid, HbA1c, fungsi ginjal bila ada), serta mencatat jenis makanan yang dikonsumsi 2 hari terakhir."
        }
      },
      {
        namaLayanan: "Pemeriksaan Berkala",
        deskripsi: "Medical check-up berkala untuk evaluasi tekanan darah, gula darah, dan kolesterol.",
        durasiMenit: 45,
        aktif: true,
        detail: {
          overview: "Mencegah selalu lebih bijak dan terjangkau daripada mengobati. Program Pemeriksaan Berkala (Medical Check-Up) Klinik Sehat Sentosa dirancang untuk memberikan gambaran komprehensif mengenai kondisi vital organ Anda, mendeteksi kelainan yang seringkali tidak bergejala sejak stadium awal, serta memberikan rencana hidup sehat jangka panjang.",
          steps: [
            { step: 1, title: "Registrasi & Kuesioner Riwayat Hidup", description: "Pengisian riwayat penyakit keluarga, kebiasaan merokok, tingkat aktivitas fisik, pola stres, dan riwayat kesehatan lampau." },
            { step: 2, title: "Pemeriksaan Fisik Head-to-Toe", description: "Pemeriksaan mata, saraf cranial, fungsi kardiovaskular, pernapasan, kelenjar getah bening, dan organ abdomen oleh dokter." },
            { step: 3, title: "Skrining Penunjang Cepat", description: "Pemeriksaan gula darah puasa/sewaktu, panel kolesterol total, asam urat, rekam jantung (EKG) dasar bila terindikasi, dan tes urine cepat." },
            { step: 4, title: "Resume Medis & Rekomendasi Terpadu", description: "Penjelasan buku resume hasil cek kesehatan dalam bahasa yang mudah dipahami disertai rekomendasi gaya hidup dan rujukan spesifik." }
          ],
          cases: [
            "Medical Check-Up rutin tahunan untuk deteksi dini risiko penyakit degeneratif",
            "Skrining kesehatan pranikah (Pre-marital Check) bagi calon pengantin",
            "Pemeriksaan kesehatan syarat kerja, sertifikasi bebas narkoba awal, dan MCU institusi",
            "Evaluasi fungsi organ vital bagi kelompok usia dewasa muda hingga lanjut usia (geriatri)"
          ],
          facilities: [
            "Alat rekam jantung digital (EKG) 12-lead dengan analisis gelombang otomatis",
            "Point-of-Care Testing (POCT) laboratorium mikro berstandar akurasi tinggi",
            "Ruang konsultasi pribadi untuk mendiskusikan resume medis secara rahasia"
          ],
          preparation: "Berpuasa 8-10 jam sebelum jadwal pemeriksaan jika paket mencakup pemeriksaan gula darah puasa (hanya diperbolehkan minum air putih), dan cukup tidur minimal 7 jam."
        }
      },
    ];

    for (const l of layananList) {
      await client.query(
        `
        INSERT INTO layanan (nama_layanan, deskripsi, durasi_menit, aktif, detail)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (nama_layanan) DO UPDATE SET
          deskripsi = EXCLUDED.deskripsi,
          durasi_menit = EXCLUDED.durasi_menit,
          aktif = EXCLUDED.aktif,
          detail = EXCLUDED.detail
        `,
        [l.namaLayanan, l.deskripsi, l.durasiMenit, l.aktif, JSON.stringify(l.detail || {})]
      );
    }

    // Ambil mapping nama_layanan -> id
    const layQuery = await client.query(`SELECT id, nama_layanan FROM layanan`);
    const layMap = {};
    for (const row of layQuery.rows) {
      layMap[row.nama_layanan] = row.id;
    }

    // Pemetaan dokter_layanan
    const relasiDokterLayanan = [
      [primaryReyhanDokterId, layMap["Pemeriksaan Umum"]],
      [primaryReyhanDokterId, layMap["Pemeriksaan Berkala"]],
      ["c92bc40c-50f7-4801-be98-8b709d968ddd", layMap["Kesehatan Gigi"]],
      ["f9473e8b-8d4e-43b9-a54e-3ce6102b3730", layMap["Kesehatan Anak"]],
      ["e14e6fa1-20f3-4b69-8757-005aa071f2f6", layMap["Kebidanan dan Kandungan"]],
      ["a08b318d-4287-4ff6-9a8a-48370b650127", layMap["Konsultasi Gizi"]],
    ];

    for (const [dokId, layId] of relasiDokterLayanan) {
      if (dokId && layId) {
        await client.query(
          `
          INSERT INTO dokter_layanan (dokter_id, layanan_id)
          VALUES ($1, $2)
          ON CONFLICT (dokter_id, layanan_id) DO NOTHING
          `,
          [dokId, layId]
        );
      }
    }

    // -------------------------------------------------------------------------
    // E. PASIEN (5+ Pasien: 2 Berakun, 4 Walk-in)
    // -------------------------------------------------------------------------
    console.log("[5] Memeriksa data 6 pasien (2 berakun, 4 walk-in)...");
    const pasienList = [
      {
        id: "a1506570-a6a9-4df8-8c86-51adef93858a",
        profileId: "b0000000-0000-0000-0000-000000000001",
        noRm: "RM-000001",
        nama: "Ani Wulandari",
        nik: "3374019999000001",
        tglLahir: "1995-05-15",
        jk: "P",
        alamat: "Jl. Melati No. 12, Semarang",
        telepon: "+6281200000005",
        kontakDarurat: "Budi (Suami) - 081299990001",
      },
      {
        id: "132d62e2-9d70-4fe9-bc32-9306ba1c7293",
        profileId: "b0000000-0000-0000-0000-000000000002",
        noRm: "RM-000002",
        nama: "Bagas Saputra",
        nik: "3374019999000002",
        tglLahir: "1990-08-20",
        jk: "L",
        alamat: "Jl. Mawar No. 45, Semarang",
        telepon: "+6281200000006",
        kontakDarurat: "Siti (Istri) - 081299990002",
      },
      {
        id: "47336add-e5a4-4d4f-87a0-5d56d58b13be",
        profileId: null, // Walk-in
        noRm: "RM-000003",
        nama: "Citra Lestari",
        nik: "3374019999000003",
        tglLahir: "2001-09-30",
        jk: "P",
        alamat: "Jl. Flamboyan No. 22, Semarang",
        telepon: "+6281200000010",
        kontakDarurat: "Ibu Citra - 081299990006",
      },
      {
        id: "d1c0cb92-d1cc-483b-8e8b-f36f4e47f4ab",
        profileId: null, // Walk-in
        noRm: "RM-000004",
        nama: "Dewi Anggraini",
        nik: "3374019999000004",
        tglLahir: "1988-12-10",
        jk: "P",
        alamat: "Jl. Anggrek No. 8, Semarang",
        telepon: "+6281200000007",
        kontakDarurat: "Agus (Kakak) - 081299990003",
      },
      {
        id: "40fd490e-8fda-48a2-91b1-1aef5e8d18c1",
        profileId: null, // Walk-in
        noRm: "RM-000005",
        nama: "Eko Prasetyo",
        nik: "3374019999000005",
        tglLahir: "1985-03-25",
        jk: "L",
        alamat: "Jl. Cempaka No. 19, Semarang",
        telepon: "+6281200000008",
        kontakDarurat: "Rini (Adik) - 081299990004",
      },
      {
        id: "81d2f170-e8f7-4dbb-a6cd-2463b61ea75b",
        profileId: null, // Walk-in
        noRm: "RM-000008",
        nama: "Slamet Riyadi",
        nik: "3374011111000098",
        tglLahir: "1978-07-14",
        jk: "L",
        alamat: "Jl. Kenanga No. 3, Semarang",
        telepon: "+6281200000009",
        kontakDarurat: "Tri (Anak) - 081299990005",
      },
    ];

    for (const p of pasienList) {
      await client.query(
        `
        INSERT INTO pasien (id, profile_id, no_rekam_medis, nama, nik, tanggal_lahir, jenis_kelamin, alamat, telepon, kontak_darurat)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          profile_id = EXCLUDED.profile_id,
          no_rekam_medis = EXCLUDED.no_rekam_medis,
          nama = EXCLUDED.nama,
          nik = EXCLUDED.nik,
          tanggal_lahir = EXCLUDED.tanggal_lahir,
          jenis_kelamin = EXCLUDED.jenis_kelamin,
          alamat = EXCLUDED.alamat,
          telepon = EXCLUDED.telepon,
          kontak_darurat = EXCLUDED.kontak_darurat
        `,
        [p.id, p.profileId, p.noRm, p.nama, p.nik, p.tglLahir, p.jk, p.alamat, p.telepon, p.kontakDarurat]
      );
    }

    // -------------------------------------------------------------------------
    // F. JADWAL PRAKTIK (5+ Jadwal, kuota 3 terisi 2, kuota 2 terisi 2 penuh)
    // -------------------------------------------------------------------------
    console.log("[6] Memeriksa jadwal praktik dan menetapkan kuota terstandar...");

    // Jadwal 1: dr. Reyhan (kuota 3, terisi 2) - Hari Rabu (3), dipakai juga oleh uji-suite
    const jadwal1Id = "b5563fa3-0a3a-4c96-a780-54b136d53056";
    await client.query(
      `
      INSERT INTO jadwal_praktik (id, dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif)
      VALUES ($1, $2, 3, '08:00:00', '12:00:00', 3, true)
      ON CONFLICT (id) DO UPDATE SET
        dokter_id = EXCLUDED.dokter_id,
        hari = EXCLUDED.hari,
        jam_mulai = EXCLUDED.jam_mulai,
        jam_selesai = EXCLUDED.jam_selesai,
        kuota = 3,
        aktif = true
      `,
      [jadwal1Id, primaryReyhanDokterId]
    );

    // Jadwal 2: dr. Annisa (kuota 2, terisi 2 penuh) - Hari Senin (1)
    const jadwal2Id = "dca28cd1-db9f-4bae-b11f-0ec917dc26ec";
    await client.query(
      `
      INSERT INTO jadwal_praktik (id, dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif)
      VALUES ($1, 'e14e6fa1-20f3-4b69-8757-005aa071f2f6', 1, '13:00:00', '16:00:00', 2, true)
      ON CONFLICT (id) DO UPDATE SET
        dokter_id = EXCLUDED.dokter_id,
        hari = EXCLUDED.hari,
        jam_mulai = EXCLUDED.jam_mulai,
        jam_selesai = EXCLUDED.jam_selesai,
        kuota = 2,
        aktif = true
      `,
      [jadwal2Id]
    );

    // Jadwal 3: drg. Nadira (kuota 10) - Hari Senin (1)
    const jadwal3Id = "81f0e5ac-a981-49bc-b78d-57aa267a1bc6";
    await client.query(
      `
      INSERT INTO jadwal_praktik (id, dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif)
      VALUES ($1, 'c92bc40c-50f7-4801-be98-8b709d968ddd', 1, '09:00:00', '14:00:00', 10, true)
      ON CONFLICT (id) DO UPDATE SET kuota = 10, aktif = true
      `,
      [jadwal3Id]
    );

    // Jadwal 4: dr. Raka Mahendra (kuota 10) - Hari Minggu (0)
    const jadwal4Id = "3afadb3b-f6ef-49e3-a006-ddd974ef3fcc";
    await client.query(
      `
      INSERT INTO jadwal_praktik (id, dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif)
      VALUES ($1, 'f9473e8b-8d4e-43b9-a54e-3ce6102b3730', 0, '08:00:00', '11:00:00', 10, true)
      ON CONFLICT (id) DO UPDATE SET kuota = 10, aktif = true
      `,
      [jadwal4Id]
    );

    // Jadwal 5: dr. Alea Prameswari (kuota 10) - Hari Senin (1)
    const jadwal5Id = "83b08a2c-ad6a-4f2d-8e48-3313130a89e1";
    await client.query(
      `
      INSERT INTO jadwal_praktik (id, dokter_id, hari, jam_mulai, jam_selesai, kuota, aktif)
      VALUES ($1, 'a08b318d-4287-4ff6-9a8a-48370b650127', 1, '10:00:00', '13:00:00', 10, true)
      ON CONFLICT (id) DO UPDATE SET kuota = 10, aktif = true
      `,
      [jadwal5Id]
    );

    // Hitung tanggal praktik sesuai hari jadwal masing-masing
    const tglJadwal1 = hitungTanggalPraktik(3, "12:00:00"); // Hari Rabu
    const tglJadwal2 = hitungTanggalPraktik(1, "16:00:00"); // Hari Senin
    const tglJadwal3 = hitungTanggalPraktik(1, "14:00:00"); // Hari Senin
    const tglJadwal4 = hitungTanggalPraktik(0, "11:00:00"); // Hari Minggu
    const tglJadwal5 = hitungTanggalPraktik(1, "13:00:00"); // Hari Senin

    // -------------------------------------------------------------------------
    // G. 12 KUNJUNGAN & ANTREAN (Persis Komposisi PRD §6.3)
    // -------------------------------------------------------------------------
    console.log("[7] Menyusun dataset 12 kunjungan & 12 antrean sesuai PRD §6.3...");

    // Bersihkan data transaksi transien lama untuk menjaga kemurnian dataset kanonikal
    await client.query("DELETE FROM tindakan");
    await client.query("DELETE FROM pemeriksaan");
    await client.query("DELETE FROM antrean");
    await client.query("DELETE FROM kunjungan");

    const kunjunganDataset = [
      // 1. Menunggu (Terdaftar 1/2) - Jadwal 1 (terisi 1/3)
      {
        kunjunganId: "00000000-0000-4000-a000-000000000001",
        noRef: "KJ-00000001",
        pasienId: "a1506570-a6a9-4df8-8c86-51adef93858a", // Ani Wulandari
        dokterId: primaryReyhanDokterId,
        layananId: layMap["Pemeriksaan Umum"],
        jadwalId: jadwal1Id,
        tanggal: tglJadwal1,
        keluhan: "Pusing dan lemas sejak kemarin pagi",
        sumber: "online",
        statusKunjungan: "terdaftar",
        nomorAntrean: 1,
        statusAntrean: "menunggu",
        alasan: null,
        waktuDipanggil: null,
      },
      // 2. Menunggu (Terdaftar 2/2) - Jadwal 1 (terisi 2/3) -> Jadwal 1 kuota 3 terisi 2!
      {
        kunjunganId: "00000000-0000-4000-a000-000000000002",
        noRef: "KJ-00000002",
        pasienId: "132d62e2-9d70-4fe9-bc32-9306ba1c7293", // Bagas Saputra
        dokterId: primaryReyhanDokterId,
        layananId: layMap["Pemeriksaan Umum"],
        jadwalId: jadwal1Id,
        tanggal: tglJadwal1,
        keluhan: "Kontrol tekanan darah bulanan",
        sumber: "online",
        statusKunjungan: "terdaftar",
        nomorAntrean: 2,
        statusAntrean: "menunggu",
        alasan: null,
        waktuDipanggil: null,
      },
      // 3. Menunggu (Hadir 1/1) - Jadwal 2 (terisi 1/2)
      {
        kunjunganId: "00000000-0000-4000-a000-000000000003",
        noRef: "KJ-00000003",
        pasienId: "d1c0cb92-d1cc-483b-8e8b-f36f4e47f4ab", // Dewi Anggraini (Walk-in)
        dokterId: "e14e6fa1-20f3-4b69-8757-005aa071f2f6", // dr. Annisa
        layananId: layMap["Kebidanan dan Kandungan"],
        jadwalId: jadwal2Id,
        tanggal: tglJadwal2,
        keluhan: "Kontrol kehamilan trimester kedua",
        sumber: "walk_in",
        statusKunjungan: "hadir",
        nomorAntrean: 1,
        statusAntrean: "menunggu",
        alasan: null,
        waktuDipanggil: null,
      },
      // 4. Dipanggil (Hadir 1/1) - Jadwal 2 (terisi 2/2) -> Jadwal 2 kuota 2 terisi 2 PENUH!
      {
        kunjunganId: "00000000-0000-4000-a000-000000000004",
        noRef: "KJ-00000004",
        pasienId: "47336add-e5a4-4d4f-87a0-5d56d58b13be", // Citra Lestari
        dokterId: "e14e6fa1-20f3-4b69-8757-005aa071f2f6", // dr. Annisa
        layananId: layMap["Kebidanan dan Kandungan"],
        jadwalId: jadwal2Id,
        tanggal: tglJadwal2,
        keluhan: "Konsultasi kesehatan reproduksi",
        sumber: "walk_in",
        statusKunjungan: "hadir",
        nomorAntrean: 2,
        statusAntrean: "dipanggil",
        alasan: null,
        waktuDipanggil: new Date().toISOString(),
      },
      // 5. Diperiksa (Hadir 1/1) - Jadwal 3 (drg. Nadira)
      {
        kunjunganId: "00000000-0000-4000-a000-000000000005",
        noRef: "KJ-00000005",
        pasienId: "40fd490e-8fda-48a2-91b1-1aef5e8d18c1", // Eko Prasetyo (Walk-in)
        dokterId: "c92bc40c-50f7-4801-be98-8b709d968ddd",
        layananId: layMap["Kesehatan Gigi"],
        jadwalId: jadwal3Id,
        tanggal: tglJadwal3,
        keluhan: "Sakit gigi geraham berlubang berdenyut",
        sumber: "walk_in",
        statusKunjungan: "hadir",
        nomorAntrean: 1,
        statusAntrean: "diperiksa",
        alasan: null,
        waktuDipanggil: new Date(Date.now() - 15 * 60000).toISOString(),
      },
      // 6. Selesai (1/5) - drg. Nadira
      {
        kunjunganId: "00000000-0000-4000-a000-000000000006",
        noRef: "KJ-00000006",
        pasienId: "81d2f170-e8f7-4dbb-a6cd-2463b61ea75b", // Slamet Riyadi (Walk-in)
        dokterId: "c92bc40c-50f7-4801-be98-8b709d968ddd",
        layananId: layMap["Kesehatan Gigi"],
        jadwalId: jadwal3Id,
        tanggal: tglJadwal3,
        keluhan: "Pembersihan karang gigi rutin",
        sumber: "walk_in",
        statusKunjungan: "selesai",
        nomorAntrean: 2,
        statusAntrean: "selesai",
        alasan: null,
        waktuDipanggil: new Date(Date.now() - 60 * 60000).toISOString(),
      },
      // 7. Selesai (2/5) - dr. Raka (Anak)
      {
        kunjunganId: "00000000-0000-4000-a000-000000000007",
        noRef: "KJ-00000007",
        pasienId: "a1506570-a6a9-4df8-8c86-51adef93858a", // Ani Wulandari
        dokterId: "f9473e8b-8d4e-43b9-a54e-3ce6102b3730",
        layananId: layMap["Kesehatan Anak"],
        jadwalId: jadwal4Id,
        tanggal: tglJadwal4,
        keluhan: "Demam dan batuk anak usia 3 tahun",
        sumber: "online",
        statusKunjungan: "selesai",
        nomorAntrean: 1,
        statusAntrean: "selesai",
        alasan: null,
        waktuDipanggil: new Date(Date.now() - 120 * 60000).toISOString(),
      },
      // 8. Selesai (3/5) - dr. Raka (Anak)
      {
        kunjunganId: "00000000-0000-4000-a000-000000000008",
        noRef: "KJ-00000008",
        pasienId: "132d62e2-9d70-4fe9-bc32-9306ba1c7293", // Bagas Saputra
        dokterId: "f9473e8b-8d4e-43b9-a54e-3ce6102b3730",
        layananId: layMap["Kesehatan Anak"],
        jadwalId: jadwal4Id,
        tanggal: tglJadwal4,
        keluhan: "Imunisasi campak dan pemantauan tumbuh kembang",
        sumber: "online",
        statusKunjungan: "selesai",
        nomorAntrean: 2,
        statusAntrean: "selesai",
        alasan: null,
        waktuDipanggil: new Date(Date.now() - 90 * 60000).toISOString(),
      },
      // 9. Selesai (4/5) - dr. Alea (Gizi)
      {
        kunjunganId: "00000000-0000-4000-a000-000000000009",
        noRef: "KJ-00000009",
        pasienId: "d1c0cb92-d1cc-483b-8e8b-f36f4e47f4ab", // Dewi Anggraini
        dokterId: "a08b318d-4287-4ff6-9a8a-48370b650127",
        layananId: layMap["Konsultasi Gizi"],
        jadwalId: jadwal5Id,
        tanggal: tglJadwal5,
        keluhan: "Konsultasi pola makan untuk penurunan kolesterol",
        sumber: "walk_in",
        statusKunjungan: "selesai",
        nomorAntrean: 1,
        statusAntrean: "selesai",
        alasan: null,
        waktuDipanggil: new Date(Date.now() - 80 * 60000).toISOString(),
      },
      // 10. Selesai (5/5) - dr. Alea (Gizi)
      {
        kunjunganId: "00000000-0000-4000-a000-000000000010",
        noRef: "KJ-00000010",
        pasienId: "40fd490e-8fda-48a2-91b1-1aef5e8d18c1", // Eko Prasetyo
        dokterId: "a08b318d-4287-4ff6-9a8a-48370b650127",
        layananId: layMap["Konsultasi Gizi"],
        jadwalId: jadwal5Id,
        tanggal: tglJadwal5,
        keluhan: "Konsultasi diet manajemen diabetes melitus tipe 2",
        sumber: "walk_in",
        statusKunjungan: "selesai",
        nomorAntrean: 2,
        statusAntrean: "selesai",
        alasan: null,
        waktuDipanggil: new Date(Date.now() - 50 * 60000).toISOString(),
      },
      // 11. Dilewati (1/1) - Hadir, dengan alasan
      {
        kunjunganId: "00000000-0000-4000-a000-000000000011",
        noRef: "KJ-00000011",
        pasienId: "81d2f170-e8f7-4dbb-a6cd-2463b61ea75b", // Slamet Riyadi
        dokterId: "a08b318d-4287-4ff6-9a8a-48370b650127",
        layananId: layMap["Konsultasi Gizi"],
        jadwalId: jadwal5Id,
        tanggal: tglJadwal5,
        keluhan: "Konsultasi nutrisi lansia",
        sumber: "walk_in",
        statusKunjungan: "hadir",
        nomorAntrean: 3,
        statusAntrean: "dilewati",
        alasan: "Pasien belum kembali ke ruang tunggu saat nomor antrean dipanggil 3 kali.",
        waktuDipanggil: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      // 12. Batal (1/1) - Batal, dengan alasan
      {
        kunjunganId: "00000000-0000-4000-a000-000000000012",
        noRef: "KJ-00000012",
        pasienId: "47336add-e5a4-4d4f-87a0-5d56d58b13be", // Citra Lestari
        dokterId: "a08b318d-4287-4ff6-9a8a-48370b650127",
        layananId: layMap["Konsultasi Gizi"],
        jadwalId: jadwal5Id,
        tanggal: tglJadwal5,
        keluhan: "Konsultasi gizi olahraga",
        sumber: "online",
        statusKunjungan: "batal",
        nomorAntrean: 4,
        statusAntrean: "batal",
        alasan: "Dibatalkan oleh pasien karena ada agenda dinas luar kota yang mendadak.",
        waktuDipanggil: null,
      },
    ];

    for (const k of kunjunganDataset) {
      await client.query(
        `
        INSERT INTO kunjungan (
          id, no_referensi, pasien_id, dokter_id, layanan_id, jadwal_id, dibuat_oleh, tanggal, keluhan, sumber, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          k.kunjunganId,
          k.noRef,
          k.pasienId,
          k.dokterId,
          k.layananId,
          k.jadwalId,
          "a0000000-0000-0000-0000-000000000002", // Dibuat oleh Rina Petugas
          k.tanggal,
          k.keluhan,
          k.sumber,
          k.statusKunjungan,
        ]
      );

      await client.query(
        `
        INSERT INTO antrean (
          kunjungan_id, dokter_id, tanggal, nomor_antrean, status, alasan, waktu_dipanggil
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          k.kunjunganId,
          k.dokterId,
          k.tanggal,
          k.nomorAntrean,
          k.statusAntrean,
          k.alasan,
          k.waktuDipanggil,
        ]
      );
    }

    // -------------------------------------------------------------------------
    // H. 5 PEMERIKSAAN & 5 TINDAKAN (Untuk 5 Kunjungan Berstatus Selesai)
    // -------------------------------------------------------------------------
    console.log("[8] Menambahkan 5 pemeriksaan dan 5 tindakan medis (tanda vital valid BR-18)...");

    const pemeriksaanDataset = [
      {
        id: "10000000-0000-4000-a000-000000000001",
        kunjunganId: "00000000-0000-4000-a000-000000000006",
        dokterId: "c92bc40c-50f7-4801-be98-8b709d968ddd", // drg. Nadira
        anamnesis: "Pasien mengeluhkan karang gigi tebal di bagian rahang bawah belakang. Tidak ada nyeri akut.",
        tandaVital: { sistolik: 120, diastolik: 80, suhu: 36.5, berat_badan: 65, tinggi_badan: 170 },
        diagnosis: "Gingivitis kronis ringan e.c. kalkulus dentalis supra dan subgingiva.",
        catatan: "Edukasi sikat gigi 2x sehari dan kontrol 6 bulan sekali.",
        namaTindakan: "Scaling Gigi Rahang Atas dan Bawah",
        keterangan: "Pembersihan karang gigi menggunakan ultrasonic scaler dan pemolesan profilaksis.",
        saran: "Gunakan obat kumur antiseptik tanpa alkohol selama 3 hari.",
      },
      {
        id: "10000000-0000-4000-a000-000000000002",
        kunjunganId: "00000000-0000-4000-a000-000000000007",
        dokterId: "f9473e8b-8d4e-43b9-a54e-3ce6102b3730", // dr. Raka (Anak)
        anamnesis: "Anak usia 3 tahun mengalami demam sejak 2 hari yang lalu, batuk berdahak ringan, nafsu makan agak menurun.",
        tandaVital: { sistolik: 100, diastolik: 65, suhu: 38.2, berat_badan: 14, tinggi_badan: 95 },
        diagnosis: "Infeksi Saluran Pernapasan Akut (ISPA) bagian atas non-spesifik.",
        catatan: "Pastikan asupan cairan cukup, kompres hangat bila suhu di atas 38C.",
        namaTindakan: "Nebulisasi & Pemeriksaan Fisik Pediatrik",
        keterangan: "Terapi inhalasi saline untuk mengencerkan sekret saluran napas.",
        saran: "Bila demam bertahan lebih dari 3 hari, lakukan tes darah tepi lengkap.",
      },
      {
        id: "10000000-0000-4000-a000-000000000003",
        kunjunganId: "00000000-0000-4000-a000-000000000008",
        dokterId: "f9473e8b-8d4e-43b9-a54e-3ce6102b3730", // dr. Raka (Anak)
        anamnesis: "Jadwal imunisasi lanjutan usia 18 bulan. Tidak ada keluhan demam, batuk, atau pilek.",
        tandaVital: { sistolik: 95, diastolik: 60, suhu: 36.6, berat_badan: 11.5, tinggi_badan: 84 },
        diagnosis: "Anak sehat, imunisasi lanjutan campak-rubella (MR).",
        catatan: "Pertumbuhan dan perkembangan motorik kasar serta halus sesuai usia.",
        namaTindakan: "Injeksi Imunisasi Subkutan",
        keterangan: "Pemberian vaksin MR dosis booster pada deltoid lengan kiri.",
        saran: "Pantau potensi demam ringan 24 jam pasca-imunisasi.",
      },
      {
        id: "10000000-0000-4000-a000-000000000004",
        kunjunganId: "00000000-0000-4000-a000-000000000009",
        dokterId: "a08b318d-4287-4ff6-9a8a-48370b650127", // dr. Alea (Gizi)
        anamnesis: "Pasien membawa hasil laboratorium: kolesterol total 240 mg/dL, LDL 160 mg/dL. Ingin mengatur pola makan.",
        tandaVital: { sistolik: 125, diastolik: 82, suhu: 36.7, berat_badan: 72, tinggi_badan: 162 },
        diagnosis: "Dislipidemia campuran dan kelebihan berat badan (BMI 27.4).",
        catatan: "Diberikan panduan menu gizi seimbang rendah lemak jenuh dan tinggi serat larut.",
        namaTindakan: "Analisis Komposisi Tubuh & Konseling Diet",
        keterangan: "Bioelectrical impedance analysis dan penentuan target defisit kalori harian.",
        saran: "Aktivitas fisik aerobik jalan cepat minimal 30 menit sehari, 5 hari seminggu.",
      },
      {
        id: "10000000-0000-4000-a000-000000000005",
        kunjunganId: "00000000-0000-4000-a000-000000000010",
        dokterId: "a08b318d-4287-4ff6-9a8a-48370b650127", // dr. Alea (Gizi)
        anamnesis: "Penderita diabetes melitus tipe 2 sejak 3 tahun lalu. Gula darah puasa terkontrol 115 mg/dL.",
        tandaVital: { sistolik: 130, diastolik: 85, suhu: 36.6, berat_badan: 68, tinggi_badan: 168 },
        diagnosis: "Diabetes Melitus Tipe 2 terkontrol dengan terapi nutrisi medis.",
        catatan: "Kepatuhan diet baik, porsi karbohidrat kompleks terbagi merata 3 kali makan utama.",
        namaTindakan: "Penyusunan Meal Plan Khusus Diabetik",
        keterangan: "Perhitungan indeks glikemik dan porsi karbohidrat per kali makan.",
        saran: "Cek HbA1c ulang setiap 3 bulan dan rutin pantau gula darah mandiri.",
      },
    ];

    for (const pm of pemeriksaanDataset) {
      await client.query(
        `
        INSERT INTO pemeriksaan (id, kunjungan_id, dokter_id, anamnesis, tanda_vital, diagnosis, catatan)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          pm.id,
          pm.kunjunganId,
          pm.dokterId,
          pm.anamnesis,
          JSON.stringify(pm.tandaVital),
          pm.diagnosis,
          pm.catatan,
        ]
      );

      await client.query(
        `
        INSERT INTO tindakan (pemeriksaan_id, nama_tindakan, keterangan, saran)
        VALUES ($1, $2, $3, $4)
        `,
        [pm.id, pm.namaTindakan, pm.keterangan, pm.saran]
      );
    }

    // -------------------------------------------------------------------------
    // I. PUSH SUBSCRIPTIONS & NOTIFIKASI
    // -------------------------------------------------------------------------
    console.log("[9] Menambahkan contoh push_subscriptions dan notifikasi (idempoten)...");

    // Kembalikan session_replication_role ke origin
    await client.query("SET LOCAL session_replication_role = 'origin'");

    // Hapus subscription lama milik seed (ditandai dengan prefix domain mock atau mock user_agent)
    await client.query("DELETE FROM push_subscriptions WHERE endpoint LIKE '%seed-%' OR endpoint LIKE '%push.example.com%' OR user_agent LIKE '%MOCK_SEED%'");
    const dummySubs = [
      {
        profileId: "b0000000-0000-0000-0000-000000000001", // Ani
        endpoint: "https://push.example.com/mock-fcm/seed-sub-ani-inaktif",
        p256dh: "BMh39r8mZJ+qV3oK/4L9p7hR1qA1sK3pT7yU8iO9p0a=",
        auth: "aB1cD2eF3gH4iJ5kL6mN7o==",
        userAgent: "MOCK_SEED_SIMULATION (Endpoint Simulasi Demo - Tidak Aktif)",
        aktif: false, // TIDAK AKTIF agar background worker tidak salah mengirim push ke endpoint simulasi
      },
      {
        profileId: "a0000000-0000-0000-0000-000000000002", // Rina
        endpoint: "https://push.example.com/mock-fcm/seed-sub-rina-inaktif",
        p256dh: "CLk40s9naK+rW4pL/5M0q8iS2rB2tL4qU8zV9jP0q1b=",
        auth: "bC2dE3fG4hI5jK6lM7nO8p==",
        userAgent: "MOCK_SEED_SIMULATION (Endpoint Simulasi Demo - Tidak Aktif)",
        aktif: false, // TIDAK AKTIF agar background worker tidak salah mengirim push ke endpoint simulasi
      },
    ];

    for (const s of dummySubs) {
      await client.query(
        `
        INSERT INTO push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent, aktif)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (endpoint) DO UPDATE SET
          aktif = EXCLUDED.aktif,
          user_agent = EXCLUDED.user_agent
        `,
        [s.profileId, s.endpoint, s.p256dh, s.auth, s.userAgent, s.aktif]
      );
    }

    // Notifikasi terstandar dengan KUNCI DETERMINISTIK (UUID Tetap)
    // Hapus hanya notifikasi milik seed (berdasarkan ID deterministik atau tag [SEED])
    const seedNotifIds = [
      "c0000000-0000-0000-0000-000000000001",
      "c0000000-0000-0000-0000-000000000002",
      "c0000000-0000-0000-0000-000000000003",
      "c0000000-0000-0000-0000-000000000004",
    ];

    await client.query(
      `DELETE FROM notifikasi WHERE id = ANY($1::uuid[]) OR pesan LIKE '%[SEED]%'`,
      [seedNotifIds]
    );

    // Komposisi Notifikasi Seed: 2 berstatus menunggu, 1 berhasil, 1 gagal (PRD §6.3 & Tahap 5B)
    const notifDataset = [
      {
        id: "c0000000-0000-0000-0000-000000000001",
        profileId: "b0000000-0000-0000-0000-000000000001", // Ani
        pesan: "[SEED] Nomor antrean #1 untuk pemeriksaan dr. Reyhan Adhitama pada tanggal " + tglJadwal1 + " berhasil didaftarkan.",
        isRead: false,
        jenisKejadian: "KUNJUNGAN_TERDAFTAR",
        tautan: "/dashboard",
        pushStatus: "menunggu",
        pushPercobaan: 0,
        pushError: null,
        pushDiprosesAt: null,
      },
      {
        id: "c0000000-0000-0000-0000-000000000002",
        profileId: "a0000000-0000-0000-0000-000000000002", // Rina Petugas
        pesan: "[SEED] Pendaftaran online baru untuk dr. Reyhan Adhitama pada tanggal " + tglJadwal1 + " membutuhkan penanganan.",
        isRead: false,
        jenisKejadian: "PENDAFTARAN_BARU",
        tautan: "/petugas",
        pushStatus: "menunggu",
        pushPercobaan: 0,
        pushError: null,
        pushDiprosesAt: null,
      },
      {
        id: "c0000000-0000-0000-0000-000000000003",
        profileId: "b0000000-0000-0000-0000-000000000001", // Ani
        pesan: "[SEED] Nomor antrean #1 untuk pemeriksaan drg. Nadira Kirana pada tanggal " + tglJadwal3 + " sedang dipanggil ke ruang praktik.",
        isRead: true,
        jenisKejadian: "ANTREAN_DIPANGGIL",
        tautan: "/dashboard",
        pushStatus: "berhasil",
        pushPercobaan: 1,
        pushError: null,
        pushDiprosesAt: new Date().toISOString(),
      },
      {
        id: "c0000000-0000-0000-0000-000000000004",
        profileId: "b0000000-0000-0000-0000-000000000001", // Ani
        pesan: "[SEED] Nomor antrean #4 untuk pemeriksaan dr. Alea Prameswari, Sp.GK pada tanggal " + tglJadwal5 + " telah dibatalkan.",
        isRead: true,
        jenisKejadian: "KUNJUNGAN_DIBATALKAN",
        tautan: "/riwayat",
        pushStatus: "gagal",
        pushPercobaan: 5,
        pushError: "Gagal mengirim push: Endpoint 410 Gone (Subscription expired or unsubscribed)",
        pushDiprosesAt: new Date().toISOString(),
      },
    ];

    for (const n of notifDataset) {
      await client.query(
        `
        INSERT INTO notifikasi (
          id, profile_id, pesan, is_read, jenis_kejadian, tautan, push_status, push_percobaan, push_error, push_diproses_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          profile_id = EXCLUDED.profile_id,
          pesan = EXCLUDED.pesan,
          is_read = EXCLUDED.is_read,
          jenis_kejadian = EXCLUDED.jenis_kejadian,
          tautan = EXCLUDED.tautan,
          push_status = EXCLUDED.push_status,
          push_percobaan = EXCLUDED.push_percobaan,
          push_error = EXCLUDED.push_error,
          push_diproses_at = EXCLUDED.push_diproses_at
        `,
        [
          n.id,
          n.profileId,
          n.pesan,
          n.isRead,
          n.jenisKejadian,
          n.tautan,
          n.pushStatus,
          n.pushPercobaan,
          n.pushError,
          n.pushDiprosesAt,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("\n-> TRANSAKSI SEED BERHASIL DI-COMMIT!");

    // -------------------------------------------------------------------------
    // J. VERIFIKASI HASIL AKHIR & KOMPOSISI ANTREAN
    // -------------------------------------------------------------------------
    console.log("\n==========================================================");
    console.log("            RINGKASAN DATASET HASIL SEED                  ");
    console.log("==========================================================");

    const rekapTabel = await client.query(`
      SELECT 'pasien' AS tabel, count(*) FROM pasien UNION ALL
      SELECT 'dokter', count(*) FROM dokter UNION ALL
      SELECT 'layanan', count(*) FROM layanan UNION ALL
      SELECT 'jadwal_praktik', count(*) FROM jadwal_praktik UNION ALL
      SELECT 'kunjungan', count(*) FROM kunjungan UNION ALL
      SELECT 'antrean', count(*) FROM antrean UNION ALL
      SELECT 'pemeriksaan', count(*) FROM pemeriksaan UNION ALL
      SELECT 'tindakan', count(*) FROM tindakan UNION ALL
      SELECT 'notifikasi', count(*) FROM notifikasi
    `);

    for (const r of rekapTabel.rows) {
      console.log(`  - ${r.tabel.padEnd(16, " ")}: ${r.count} baris`);
    }

    console.log("\nKOMPOSISI ANTREAN (Harus persis tabel PRD §6.3):");
    const rekapAntrean = await client.query(`
      SELECT status, count(*) AS jumlah
      FROM antrean
      GROUP BY status
      ORDER BY CASE status
        WHEN 'menunggu' THEN 1
        WHEN 'dipanggil' THEN 2
        WHEN 'diperiksa' THEN 3
        WHEN 'selesai' THEN 4
        WHEN 'dilewati' THEN 5
        WHEN 'batal' THEN 6
        ELSE 7
      END
    `);

    for (const r of rekapAntrean.rows) {
      console.log(`  * ${r.status.padEnd(10, " ")}: ${r.jumlah}`);
    }

    console.log("==========================================================");
    console.log("Seed database selesai dengan SUKSES & IDEMPOTEN.");
    console.log("==========================================================");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n[FATAL] Terjadi kesalahan selama transaksi seed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Kesalahan fatal runtime seed:", err);
  process.exit(1);
});
