import { getTodayISODate } from "./lib/date"

export const DEMO_DATE = getTodayISODate()
export type Role = "Publik" | "Pasien" | "Petugas" | "Dokter" | "Admin"
export type QueueStatus = "Menunggu" | "Dipanggil" | "Sedang Diperiksa" | "Selesai" | "Dilewati" | "Dibatalkan"
export type VisitStatus = "Terdaftar" | "Hadir" | "Selesai" | "Dibatalkan"

export type Patient = {
  id: string
  name: string
  phone: string
  birth: string
  gender: string
  address: string
  emergency: string
  account: boolean
  nik?: string
}

export type DoctorEducation = {
  degree: string
  institution: string
  year?: string
  honor?: string
}

export type Doctor = {
  id: string
  name: string
  specialty: string
  sip: string
  str: string
  services: string[]
  active: boolean
  education: DoctorEducation[]
  experienceYears: number
  almamater: string
  certifications: string[]
  bio: string
  photoUrl?: string
}

export type ServiceStep = {
  step: number
  title: string
  description: string
}

export type Service = {
  id: string
  name: string
  description: string
  duration: number
  active: boolean
  overview: string
  steps: ServiceStep[]
  cases: string[]
  facilities: string[]
  preparation: string
}

export type Schedule = {
  id: string
  doctor: string
  day: number
  start: string
  end: string
  quota: number
  active: boolean
}

export type Examination = {
  anamnesis: string
  pressure: string
  temperature: string
  weight: string
  height: string
  diagnosis: string
  notes: string
  actions: {
    name: string
    description: string
    advice: string
  }[]
}

export type Visit = {
  id: string
  patient: string
  doctor: string
  service: string
  schedule: string
  date: string
  complaint: string
  source: "Online" | "Walk-in"
  status: VisitStatus
  queue: QueueStatus
  number: number
  ref?: string
  reason?: string
  examination?: Examination
}

export type NotificationType =
  | "KUNJUNGAN_TERDAFTAR"
  | "PENDAFTARAN_BARU"
  | "ANTREAN_DIPANGGIL"
  | "GILIRAN_MENDEKAT"
  | "PENGINGAT_KUNJUNGAN"
  | "KUNJUNGAN_DIBATALKAN"
  | "KUNJUNGAN_SELESAI"
  | "INFO"

export type NotificationItem = {
  id: string
  targetRole: Role | "Semua"
  targetUserId?: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  isRead: boolean
  visitId?: string
  queueNumber?: string
  actionUrl?: string
}

export type NotificationJob = {
  id: string
  profileId: string
  recipientName: string
  recipientRole: Role
  eventType: NotificationType
  visitId: string
  queueNumber?: string
  status: "menunggu" | "berhasil" | "gagal"
  attempts: number
  error: string | null
  createdAt: string
  processedAt: string | null
}

export type ClinicFacility = {
  name: string
  category: string
  desc: string
  icon: string
}

export type ClinicProfileDetail = {
  name: string
  tagline: string
  description: string
  address: string
  phone: string
  emergencyPhone: string
  whatsapp: string
  email: string
  latitude: string
  longitude: string
  hours: string
  history: string
  vision: string
  mission: string[]
  values: { title: string; subtitle: string; desc: string; icon: string }[]
  accreditation: string
  accreditationNumber: string
  facilities: ClinicFacility[]
  stats: { value: string; label: string; sub: string }[]
}

export const clinicDetailSeed: ClinicProfileDetail = {
  name: "Klinik Sehat Sentosa",
  tagline: "Perawatan Sepenuh Hati, Hidup Lebih Berarti",
  description: "Fasilitas pelayanan kesehatan primer modern dan terpadu yang mengedepankan pendekatan humanis, kenyamanan pasien, dan kepastian antrean berbasis digital.",
  address: "Jl. Melati No. 18, Kebayoran Baru, Jakarta Selatan 12160",
  phone: "021-555-0123",
  emergencyPhone: "021-555-0911 (Layanan Darurat Ringan 24 Jam)",
  whatsapp: "0812-9988-7700",
  email: "halo@sehatklinik.id",
  latitude: "-6.2615",
  longitude: "106.8106",
  hours: "Senin – Sabtu, 08.00 – 20.00 WIB (Poli Spesialis & Umum)",
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
}

export const servicesSeed: Service[] = [
  {
    id: "s1",
    name: "Poli Umum",
    description: "Pemeriksaan kesehatan menyeluruh, penanganan keluhan harian, dan tata laksana penyakit akut maupun kronis.",
    duration: 30,
    active: true,
    overview: "Poli Umum merupakan pintu utama pelayanan kesehatan primer bagi pasien dari segala usia. Dokter umum kami siap mendengarkan riwayat kesehatan Anda, melakukan skrining fisik yang teliti, mendiagnosis keluhan medis secara rasional, serta merumuskan penanganan medis dan pola hidup preventif yang tepat sasaran.",
    steps: [
      {
        step: 1,
        title: "Skrining Tanda Vital & Antropometri",
        description: "Pemeriksaan tekanan darah, frekuensi denyut nadi, laju napas, suhu tubuh, saturasi oksigen (SpO2), serta indeks massa tubuh (BB/TB)."
      },
      {
        step: 2,
        title: "Anamnesis Medis Mendalam",
        description: "Konsultasi terperinci mengenai keluhan utama, kronologi sakit, riwayat pengobatan berjalan, alergi obat, dan pola aktivitas harian."
      },
      {
        step: 3,
        title: "Pemeriksaan Fisik Terfokus",
        description: "Pemeriksaan menyeluruh pada saluran napas, pendengaran, tenggorokan, bunyi jantung dan paru, serta palpasi rongga perut."
      },
      {
        step: 4,
        title: "Diagnosis, Terapi & Edukasi",
        description: "Penyampaian penjelasan kondisi medis yang mudah dipahami, peresepan obat rasional, surat rujukan bila diperlukan, dan rencana evaluasi."
      }
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
  },
  {
    id: "s2",
    name: "Poli Gigi",
    description: "Perawatan kuratif, preventif, dan restoratif kesehatan gigi dan rongga mulut dengan standar sterilisasi modern.",
    duration: 45,
    active: true,
    overview: "Poli Gigi Klinik Sehat Sentosa menghadirkan kenyamanan prima bagi pasien yang membutuhkan penanganan masalah gigi dan mulut. Dilengkapi dental chair ergonomis dan pencahayaan sensor LED, dokter gigi kami mengutamakan prosedur minim nyeri serta edukasi pemeliharaan higienitas gigi jangka panjang.",
    steps: [
      {
        step: 1,
        title: "Pemeriksaan Ekstraoral & Intraoral",
        description: "Inspeksi menyeluruh pada gusi, mukosa mulut, lidah, oklusi gigi, serta deteksi dini karies atau karang gigi dengan kaca mulut steril."
      },
      {
        step: 2,
        title: "Rencana Perawatan & Edukasi Visual",
        description: "Menjelaskan kondisi gigi secara transparan dan mendiskusikan opsi tindakan restoratif yang paling aman dan estetis bagi pasien."
      },
      {
        step: 3,
        title: "Tindakan Klinis Steril & Terarah",
        description: "Pelaksanaan pembersihan karang gigi (scaling), penambalan estetik komposit sewarna gigi, atau pencabutan atraumatik."
      },
      {
        step: 4,
        title: "Aplikasi Pencegahan & Perawatan Lanjut",
        description: "Instruksi cara sikat gigi yang benar, anjuran pasta gigi terapeutik, serta penjadwalan pemeliharaan berkala tiap 6 bulan."
      }
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
  },
  {
    id: "s3",
    name: "Poli Anak",
    description: "Konsultasi tumbuh kembang, imunisasi terpadu, dan penanganan penyakit pediatrik dalam suasana hangat ramah anak.",
    duration: 30,
    active: true,
    overview: "Kesehatan buah hati Anda adalah prioritas utama kami. Poli Anak dirancang dengan atmosfer yang ceria dan menenangkan untuk mengurangi kecemasan si kecil saat bertemu dokter. Dokter spesialis anak kami mendampingi orang tua memantau kurva pertumbuhan, vaksinasi tepat waktu, serta menangani keluhan kesehatan balita hingga remaja.",
    steps: [
      {
        step: 1,
        title: "Antropometri Terstandar WHO",
        description: "Penimbangan berat badan bayi/anak, pengukuran panjang/tinggi badan, dan lingkar kepala yang diplot langsung ke kurva KMS digital."
      },
      {
        step: 2,
        title: "Skrining Milestone Perkembangan",
        description: "Evaluasi kemampuan motorik kasar, motorik halus, respons komunikasi, bahasa, serta kemandirian sosial sesuai usia."
      },
      {
        step: 3,
        title: "Pemeriksaan Fisik Ramah Anak",
        description: "Pemeriksaan dengan teknik bermain (child-friendly examination) tanpa paksaan untuk memeriksa dada, perut, telinga, dan tenggorokan."
      },
      {
        step: 4,
        title: "Vaksinasi / Tata Laksana & Edukasi Orang Tua",
        description: "Pemberian vaksin sesuai jadwal IDAI, panduan nutrisi MPASI gizi seimbang, serta cara tepat menangani demam di rumah."
      }
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
  },
  {
    id: "s4",
    name: "Konsultasi Gizi",
    description: "Pendampingan terapi nutrisi medik personal, analisis komposisi tubuh, dan panduan pola makan seimbang.",
    duration: 30,
    active: true,
    overview: "Pola makan yang tepat adalah pilar fundamental pemulihan dan pencegahan penyakit. Bersama dokter spesialis gizi klinik kami, Anda akan dipandu memahami kebutuhan nutrisi spesifik tubuh Anda berdasarkan tes komposisi bioimpedansi, riwayat penyakit metabolik, serta preferensi menu sehari-hari yang realistis dijalani.",
    steps: [
      {
        step: 1,
        title: "Pengukuran Bioelectrical Impedance Analysis (BIA)",
        description: "Analisis mendalam mengenai persentase lemak tubuh, massa otot rangka, lemak viseral, kadar air tubuh, dan laju metabolisme basal (BMR)."
      },
      {
        step: 2,
        title: "Analisis Dietary Recall 24 Jam",
        description: "Evaluasi pola konsumsi makan harian, kebiasaan camilan, asupan garam dan gula tersembunyi, serta kecukupan mikronutrien."
      },
      {
        step: 3,
        title: "Perumusan Terapi Nutrisi Personal",
        description: "Menghitung target kalori dan distribusi makronutrien (karbohidrat, protein, lemak sehat) yang sesuai dengan kondisi klinis pasien."
      },
      {
        step: 4,
        title: "Pemberian Meal Plan & Evaluasi Berkala",
        description: "Menyusun contoh menu mingguan yang fleksibel dan lezat, alternatif bahan makanan pengganti, dan jadwal kontrol progres 2-4 minggu."
      }
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
  },
  {
    id: "s5",
    name: "Pemeriksaan Berkala",
    description: "Evaluasi kesehatan preventif, skrining risiko kardiovaskular, dan deteksi dini penyakit tidak menular.",
    duration: 45,
    active: true,
    overview: "Mencegah selalu lebih bijak dan terjangkau daripada mengobati. Program Pemeriksaan Berkala (Medical Check-Up) Klinik Sehat Sentosa dirancang untuk memberikan gambaran komprehensif mengenai kondisi vital organ Anda, mendeteksi kelainan yang seringkali tidak bergejala sejak stadium awal, serta memberikan rencana hidup sehat jangka panjang.",
    steps: [
      {
        step: 1,
        title: "Registrasi & Kuesioner Riwayat Hidup",
        description: "Pengisian riwayat penyakit keluarga, kebiasaan merokok, tingkat aktivitas fisik, pola stres, dan riwayat kesehatan lampau."
      },
      {
        step: 2,
        title: "Pemeriksaan Fisik Head-to-Toe",
        description: "Pemeriksaan mata, saraf cranial, fungsi kardiovaskular, pernapasan, kelenjar getah bening, dan organ abdomen oleh dokter."
      },
      {
        step: 3,
        title: "Skrining Penunjang Cepat",
        description: "Pemeriksaan gula darah puasa/sewaktu, panel kolesterol total, asam urat, rekam jantung (EKG) dasar bila terindikasi, dan tes urine cepat."
      },
      {
        step: 4,
        title: "Resume Medis & Rekomendasi Terpadu",
        description: "Penjelasan buku resume hasil cek kesehatan dalam bahasa yang mudah dipahami disertai rekomendasi gaya hidup dan rujukan spesifik."
      }
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
  },
]

export const DOC_REYHAN_ID = "b9cd5971-4e73-4f8b-b0dd-0bc2ba064092"
export const DOC_NADIRA_ID = "c92bc40c-50f7-4801-be98-8b709d968ddd"
export const DOC_RAKA_ID = "f9473e8b-8d4e-43b9-a54e-3ce6102b3730"
export const DOC_ANNISA_ID = "e14e6fa1-20f3-4b69-8757-005aa071f2f6"
export const DOC_ALEA_ID = "a08b318d-4287-4ff6-9a8a-48370b650127"

export const doctorsSeed: Doctor[] = [
  {
    id: DOC_REYHAN_ID,
    name: "dr. Reyhan Adhitama",
    specialty: "Dokter Umum",
    sip: "SIP-2026-0001",
    str: "31.2.1.100.2.21.145890",
    services: ["s1", "s5"],
    active: true,
    photoUrl: "https://swrzfderhamcjawwkwkt.supabase.co/storage/v1/object/public/foto-dokter/reyhan.png",
    almamater: "Universitas Indonesia",
    experienceYears: 8,
    education: [
      {
        degree: "Sarjana Kedokteran (S.Ked)",
        institution: "Fakultas Kedokteran Universitas Indonesia",
        year: "2014 – 2018",
        honor: "Lulusan Terbaik Program Akademik"
      },
      {
        degree: "Profesi Dokter (dr.)",
        institution: "RSUPN Dr. Cipto Mangunkusumo / FK UI",
        year: "2018 – 2020",
        honor: "Predikat Cum Laude"
      },
      {
        degree: "Continuing Medical Education (CME)",
        institution: "Ikatan Dokter Indonesia (IDI) Wilayah DKI Jakarta",
        year: "2021 – 2025",
        honor: "Sertifikasi Kompetensi Kedokteran Primer Berkelanjutan"
      }
    ],
    certifications: [
      "Advanced Cardiac Life Support (ACLS) – Perhimpunan Dokter Spesialis Kardiovaskular Indonesia (PERKI)",
      "Manajemen Terpadu Tata Laksana Balita Sakit (MTBS) – Kemenkes RI",
      "Sertifikasi Penanganan Gawat Darurat Pertama (PPGD) Standar Nasional"
    ],
    bio: "dr. Reyhan Adhitama memiliki dedikasi tinggi pada pelayanan kedokteran keluarga primer. Pendekatannya yang hangat, empatik, serta kemampuan mendengar yang sabar menjadikannya dokter kepercayaan bagi banyak keluarga di Klinik Sehat Sentosa."
  },
  {
    id: DOC_NADIRA_ID,
    name: "drg. Nadira Kirana",
    specialty: "Dokter Gigi",
    sip: "SIP-2026-0002",
    str: "33.1.2.100.1.20.129034",
    services: ["s2"],
    active: true,
    photoUrl: "https://swrzfderhamcjawwkwkt.supabase.co/storage/v1/object/public/foto-dokter/nadira.png",
    almamater: "Universitas Gadjah Mada",
    experienceYears: 7,
    education: [
      {
        degree: "Sarjana Kedokteran Gigi (S.KG)",
        institution: "Fakultas Kedokteran Gigi Universitas Gadjah Mada",
        year: "2015 – 2019",
        honor: "Fokus Studi: Restorasi Gigi Minimal Invasif"
      },
      {
        degree: "Profesi Dokter Gigi (drg.)",
        institution: "RSGM Prof. Soedomo Yogyakarta / FKG UGM",
        year: "2019 – 2021",
        honor: "Penghargaan Klinis Perawatan Konservasi Gigi"
      },
      {
        degree: "Pelatihan Fellowship Estetik Dental",
        institution: "Persatuan Dokter Gigi Indonesia (PDGI)",
        year: "2023",
        honor: "Sertifikasi Master Restorasi Komposit Anterior"
      }
    ],
    certifications: [
      "Advanced Composite Restorative Hands-on – PDGI Cabang Jakarta",
      "Rotary Endodontic Therapy & Root Canal Debridement – Indonesian Endodontic Association",
      "Sertifikasi Sterilisasi dan Pengendalian Infeksi Dental – Kemenkes RI"
    ],
    bio: "drg. Nadira Kirana ahli dalam perawatan konservasi dan estetika gigi. Beliau sangat berhati-hati dalam setiap prosedur untuk meminimalkan rasa cemas pasien terhadap perawatan gigi, terutama pasien dewasa muda dan anak."
  },
  {
    id: DOC_RAKA_ID,
    name: "dr. Raka Mahendra, Sp.A",
    specialty: "Spesialis Anak",
    sip: "SIP-2026-0003",
    str: "31.1.2.200.3.18.098412",
    services: ["s3"],
    active: true,
    photoUrl: "https://swrzfderhamcjawwkwkt.supabase.co/storage/v1/object/public/foto-dokter/raka.png",
    almamater: "Universitas Airlangga & UI",
    experienceYears: 10,
    education: [
      {
        degree: "Sarjana Kedokteran & Profesi Dokter (dr.)",
        institution: "Fakultas Kedokteran Universitas Airlangga, Surabaya",
        year: "2011 – 2017",
        honor: "Lulusan Berprestasi Bidang Ilmu Kesehatan Anak"
      },
      {
        degree: "Program Pendidikan Dokter Spesialis (Sp.A)",
        institution: "Departemen Ilmu Kesehatan Anak FK Universitas Indonesia / RSCM",
        year: "2017 – 2021",
        honor: "Spesialis Anak Terakreditasi Kolegium IKA"
      },
      {
        degree: "Pelatihan Konselor Menyusui Standar WHO/UNICEF",
        institution: "Sentra Laktasi Indonesia (SELASI)",
        year: "2022",
        honor: "Sertifikasi Konselor Laktasi & MPASI Nasional"
      }
    ],
    certifications: [
      "Pediatric Advanced Life Support (PALS) – Ikatan Dokter Anak Indonesia (IDAI)",
      "Resusitasi Neonatus Lanjut (NRP) – Perinasia",
      "Sertifikasi Deteksi Dini Tumbuh Kembang (SDIDTK) Balita – Kemenkes RI"
    ],
    bio: "dr. Raka Mahendra, Sp.A dikenal ramah, sabar, dan sangat disukai oleh anak-anak. Beliau memiliki keahlian komprehensif dalam pemantauan stunting, imunisasi modern tanpa efek samping berlebih, dan penyakit infeksi anak."
  },
  {
    id: DOC_ANNISA_ID,
    name: "dr. Annisa Fadhilla, Sp.OG",
    specialty: "Spesialis Kandungan",
    sip: "SIP-2026-0004",
    str: "31.1.2.300.4.19.076321",
    services: ["s4"],
    active: true,
    photoUrl: "https://swrzfderhamcjawwkwkt.supabase.co/storage/v1/object/public/foto-dokter/annisa.png",
    almamater: "Universitas Padjadjaran & UI",
    experienceYears: 9,
    education: [
      {
        degree: "Sarjana Kedokteran & Profesi Dokter (dr.)",
        institution: "Fakultas Kedokteran Universitas Padjadjaran, Bandung",
        year: "2012 – 2018",
        honor: "Fokus Studi: Kesehatan Reproduksi dan Antenatal Care"
      },
      {
        degree: "Program Pendidikan Dokter Spesialis Obstetri & Ginekologi (Sp.OG)",
        institution: "Fakultas Kedokteran Universitas Indonesia / RSCM",
        year: "2018 – 2022",
        honor: "Spesialis Kandungan Terakreditasi Kolegium Obgyn"
      }
    ],
    certifications: [
      "Pelatihan USG Obstetri & Ginekologi Tingkat Lanjut – POGI",
      "Advanced Life Support in Obstetrics (ALSO)",
      "Konseling Kontrasepsi Modern dan Pencegahan Komplikasi Kehamilan"
    ],
    bio: "dr. Annisa Fadhilla, Sp.OG berpengalaman dalam pelayanan kesehatan reproduksi wanita, antenatal care komprehensif, dan pendampingan keluarga berencana dengan pendekatan ramah pasien."
  },
  {
    id: DOC_ALEA_ID,
    name: "dr. Alea Prameswari, Sp.GK",
    specialty: "Spesialis Gizi Klinik",
    sip: "SIP-2026-0005",
    str: "32.2.1.100.2.22.167234",
    services: ["s5", "s6"],
    active: true,
    photoUrl: "https://swrzfderhamcjawwkwkt.supabase.co/storage/v1/object/public/foto-dokter/alea.png",
    almamater: "Universitas Diponegoro & UI",
    experienceYears: 6,
    education: [
      {
        degree: "Sarjana Kedokteran & Profesi Dokter (dr.)",
        institution: "Fakultas Kedokteran Universitas Diponegoro, Semarang",
        year: "2015 – 2021",
        honor: "Minat Khusus: Terapi Gizi Medis Penyakit Tidak Menular"
      },
      {
        degree: "Program Pendidikan Dokter Spesialis Gizi Klinik (Sp.GK)",
        institution: "Fakultas Kedokteran Universitas Indonesia / RSCM",
        year: "2021 – 2024",
        honor: "Lulusan Terbaik Departemen Ilmu Gizi FK UI"
      }
    ],
    certifications: [
      "Clinical Nutrition & Metabolism Course – ESPEN",
      "Sertifikasi Terapi Nutrisi Medik Sindrom Metabolik – PDGKI",
      "Konseling Diet Penyakit Kronis & Manajemen Berat Badan Berkelanjutan"
    ],
    bio: "dr. Alea Prameswari, Sp.GK berfokus pada terapi nutrisi medis klinis, manajemen obesitas, penanganan diabetes serta hipertensi melalui pola makan berbasis bukti ilmiah."
  },
]

const todayDayIndex = typeof window !== "undefined" ? (new Date().getDay() || 1) : 1
export const schedulesSeed: Schedule[] = doctorsSeed.map((d, i) => ({
  id: `j${i + 1}`,
  doctor: d.id,
  day: todayDayIndex,
  start: i === 2 ? "09:00" : "08:00",
  end: "12:00",
  quota: i === 0 ? 10 : i === 1 ? 8 : 5,
  active: true,
}))

export const patientsSeed: Patient[] = [
  {
    id: "RM-00128",
    name: "Ani Wulandari",
    nik: "3374019999000001",
    phone: "0813-0000-0001",
    birth: "1992-03-14",
    gender: "Perempuan",
    address: "Jl. Melati No. 5, Kebayoran Baru, Jakarta Selatan",
    emergency: "0813-0000-9001 (Suami)",
    account: true,
  },
  {
    id: "RM-00129",
    name: "Bagas Saputra",
    nik: "3374019999000002",
    phone: "0813-0000-0002",
    birth: "1988-11-02",
    gender: "Laki-laki",
    address: "Jl. Kenanga No. 12, Cilandak, Jakarta Selatan",
    emergency: "0813-0000-9002 (Istri)",
    account: false,
  },
  {
    id: "RM-00130",
    name: "Citra Lestari",
    nik: "3374019999000003",
    phone: "0813-0000-0003",
    birth: "1996-07-21",
    gender: "Perempuan",
    address: "Jl. Anggrek No. 3, Kemang, Jakarta Selatan",
    emergency: "0813-0000-9003 (Orang Tua)",
    account: true,
  },
  {
    id: "RM-00131",
    name: "Darmawan Putra",
    nik: "3374019999000004",
    phone: "0812-8877-6655",
    birth: "1983-05-09",
    gender: "Laki-laki",
    address: "Jl. Wijaya IX No. 14, Kebayoran Baru, Jakarta Selatan",
    emergency: "0812-8877-0011 (Keluarga)",
    account: true,
  },
  {
    id: "RM-00132",
    name: "Eka Rahmawati",
    nik: "3374019999000005",
    phone: "0815-4433-2211",
    birth: "1994-01-19",
    gender: "Perempuan",
    address: "Jl. Gandaria Tengah No. 22, Jakarta Selatan",
    emergency: "0815-4433-0022 (Ibu)",
    account: true,
  },
  {
    id: "RM-00133",
    name: "Fajar Nugroho",
    nik: "3374019999000006",
    phone: "0817-9900-1122",
    birth: "1990-08-30",
    gender: "Laki-laki",
    address: "Jl. Cipete Raya No. 8, Jakarta Selatan",
    emergency: "0817-9900-3344 (Saudara)",
    account: false,
  },
]

export const visitsSeed: Visit[] = [
  {
    id: "KJ-20261026-001",
    patient: "RM-00128",
    doctor: DOC_REYHAN_ID,
    service: "s1",
    schedule: "j1",
    date: DEMO_DATE,
    complaint: "Demam sejak 2 hari lalu disertai sakit kepala ringan dan pegal.",
    source: "Online",
    status: "Hadir",
    queue: "Menunggu",
    number: 1,
  },
  {
    id: "KJ-20261026-002",
    patient: "RM-00129",
    doctor: DOC_REYHAN_ID,
    service: "s1",
    schedule: "j1",
    date: DEMO_DATE,
    complaint: "Batuk berdahak dan tenggorokan terasa gatal sejak kemarin malam.",
    source: "Walk-in",
    status: "Terdaftar",
    queue: "Menunggu",
    number: 2,
  },
  {
    id: "KJ-20261026-003",
    patient: "RM-00130",
    doctor: DOC_REYHAN_ID,
    service: "s1",
    schedule: "j1",
    date: DEMO_DATE,
    complaint: "Nyeri ulu hati dan mual setelah telat makan siang.",
    source: "Online",
    status: "Hadir",
    queue: "Dipanggil",
    number: 3,
  },
  {
    id: "KJ-20261026-004",
    patient: "RM-00131",
    doctor: DOC_REYHAN_ID,
    service: "s1",
    schedule: "j1",
    date: DEMO_DATE,
    complaint: "Kontrol tekanan darah rutin dan keluhan kaku di tengkuk.",
    source: "Online",
    status: "Hadir",
    queue: "Sedang Diperiksa",
    number: 4,
  },
  {
    id: "KJ-20261026-005",
    patient: "RM-00132",
    doctor: DOC_REYHAN_ID,
    service: "s1",
    schedule: "j1",
    date: DEMO_DATE,
    complaint: "Pusing berputar ringan saat bangun tidur sejak pagi.",
    source: "Online",
    status: "Selesai",
    queue: "Selesai",
    number: 5,
    examination: {
      anamnesis:
        "Pasien mengeluh pusing berputar singkat (< 1 menit) saat perubahan posisi kepala sejak bangun tidur pagi hari. Tidak ada mual hebat atau gangguan pendengaran.",
      pressure: "118/78",
      temperature: "36.6",
      weight: "54",
      height: "162",
      diagnosis: "Benign Paroxysmal Positional Vertigo (BPPV) ringan",
      notes: "Kondisi stabil, edukasi manuver perubahan posisi perlahan dan hidrasi cukup.",
      actions: [
        {
          name: "Terapi Betahistine 6 mg & Vitamin B Kompleks",
          description: "Diminum 3x1 tablet sehari sesudah makan selama 5 hari",
          advice: "Kontrol ulang apabila keluhan masih berlanjut setelah 3 hari",
        },
      ],
    },
  },
  {
    id: "KJ-20261024-001",
    patient: "RM-00133",
    doctor: DOC_REYHAN_ID,
    service: "s1",
    schedule: "j1",
    date: "2026-10-24",
    complaint: "Pilek, bersin-bersin, dan badan terasa lemas 3 hari.",
    source: "Walk-in",
    status: "Selesai",
    queue: "Selesai",
    number: 1,
    examination: {
      anamnesis:
        "Pasien mengeluhkan hidung tersumbat, bersin berulang, dan badan pegal sejak 3 hari lalu tanpa sesak napas.",
      pressure: "120/80",
      temperature: "37.2",
      weight: "68",
      height: "172",
      diagnosis: "Infeksi Saluran Pernapasan Akut (ISPA) ringan / Nasofaringitis akut",
      notes: "Disarankan istirahat cukup dan perbanyak konsumsi air hangat.",
      actions: [
        {
          name: "Pemberian Paracetamol 500 mg & Dekongestan oral",
          description: "Paracetamol bila demam/nyeri, diminum setelah makan",
          advice: "Kembali periksa jika demam tinggi > 3 hari atau muncul sesak",
        },
      ],
    },
  },
]

export const notificationsSeed: NotificationItem[] = []

export const notificationJobsSeed: NotificationJob[] = []

export const queueLabel = (v: Visit, doctorIndex?: number) => {
  const rawPrefix = /^d\d+$/i.test(v.doctor)
    ? v.doctor.replace(/^\D+/g, "")
    : doctorIndex !== undefined && doctorIndex >= 0
      ? String(doctorIndex + 1)
      : "01"
  return `${rawPrefix.padStart(2, "0")}-${String(v.number).padStart(3, "0")}`
}

export const dateLabel = (date: string) => {
  if (!date) return ""
  try {
    const d = date.includes("T") ? new Date(date) : new Date(`${date}T12:00:00+07:00`)
    return !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        })
      : date
  } catch {
    return date
  }
}

export const remaining = (schedule: Schedule, date: string, visits: Visit[]) =>
  Math.max(
    0,
    schedule.quota -
      visits.filter(
        (v) =>
          v.schedule === schedule.id &&
          v.date === date &&
          v.status !== "Dibatalkan",
      ).length,
  )
