export const DEMO_DATE = "2026-10-26"
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
}
export type Doctor = {
  id: string
  name: string
  specialty: string
  sip: string
  services: string[]
  active: boolean
}
export type Service = {
  id: string
  name: string
  description: string
  duration: number
  active: boolean
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
  reason?: string
  examination?: Examination
}
export const servicesSeed: Service[] = [
  {
    id: "s1",
    name: "Poli Umum",
    description: "Pemeriksaan kesehatan dan penanganan keluhan sehari-hari.",
    duration: 30,
    active: true,
  },
  {
    id: "s2",
    name: "Poli Gigi",
    description: "Pemeriksaan dan perawatan kesehatan gigi serta mulut.",
    duration: 45,
    active: true,
  },
  {
    id: "s3",
    name: "Poli Anak",
    description: "Konsultasi kesehatan dan tumbuh kembang anak.",
    duration: 30,
    active: true,
  },
  {
    id: "s4",
    name: "Konsultasi Gizi",
    description: "Pendampingan pola makan sesuai kebutuhan kesehatan.",
    duration: 30,
    active: true,
  },
  {
    id: "s5",
    name: "Pemeriksaan Berkala",
    description: "Evaluasi kondisi kesehatan dan konsultasi pencegahan.",
    duration: 45,
    active: true,
  },
]
export const doctorsSeed: Doctor[] = [
  {
    id: "d1",
    name: "dr. Nadia Putri",
    specialty: "Dokter Umum",
    sip: "SIP-2026-001",
    services: ["s1", "s5"],
    active: true,
  },
  {
    id: "d2",
    name: "drg. Budi Santoso",
    specialty: "Dokter Gigi",
    sip: "SIP-2026-002",
    services: ["s2"],
    active: true,
  },
  {
    id: "d3",
    name: "dr. Sarah Amelia, Sp.A",
    specialty: "Spesialis Anak",
    sip: "SIP-2026-003",
    services: ["s3"],
    active: true,
  },
  {
    id: "d4",
    name: "dr. Fajar Ramadhan, Sp.GK",
    specialty: "Spesialis Gizi Klinik",
    sip: "SIP-2026-004",
    services: ["s4"],
    active: true,
  },
  {
    id: "d5",
    name: "dr. Maya Lestari",
    specialty: "Dokter Umum",
    sip: "SIP-2026-005",
    services: ["s1", "s5"],
    active: true,
  },
]
export const schedulesSeed: Schedule[] = doctorsSeed.map((d, i) => ({
  id: `j${i + 1}`,
  doctor: d.id,
  day: 1,
  start: i === 2 ? "09:00" : "08:00",
  end: "12:00",
  quota: i === 0 ? 3 : i === 1 ? 2 : 5,
  active: true,
}))
export const patientsSeed: Patient[] = [
  {
    id: "RM-00128",
    name: "Andi Pratama",
    phone: "081234560001",
    birth: "1995-04-12",
    gender: "Laki-laki",
    address: "Jl. Melati No. 8, Jakarta Selatan",
    emergency: "081234569001",
    account: true,
  },
  {
    id: "RM-00129",
    name: "Siti Permata",
    phone: "081234560002",
    birth: "1997-07-20",
    gender: "Perempuan",
    address: "Jakarta Selatan",
    emergency: "081234569002",
    account: true,
  },
  {
    id: "RM-00130",
    name: "Bambang Wijaya",
    phone: "081234560003",
    birth: "1980-03-11",
    gender: "Laki-laki",
    address: "Jakarta Selatan",
    emergency: "",
    account: false,
  },
  {
    id: "RM-00131",
    name: "Dewi Lestari",
    phone: "081234560004",
    birth: "2018-02-14",
    gender: "Perempuan",
    address: "Jakarta Selatan",
    emergency: "081234569004",
    account: false,
  },
  {
    id: "RM-00132",
    name: "Rizky Ramadhan",
    phone: "081234560005",
    birth: "1992-11-02",
    gender: "Laki-laki",
    address: "Jakarta Selatan",
    emergency: "",
    account: true,
  },
]
const exam = (i: number): Examination => ({
  anamnesis: "Keluhan ringan sejak dua hari, tanpa riwayat alergi.",
  pressure: "120/80",
  temperature: "36.7",
  weight: "65",
  diagnosis: "Keluhan membaik, kondisi umum stabil.",
  notes: "Istirahat cukup dan kembali bila keluhan berlanjut. Data simulasi.",
  actions: [
    {
      name: "Konsultasi kesehatan",
      description: "Evaluasi kondisi umum dan edukasi.",
      advice: "Jaga pola makan dan istirahat. Kontrol sesuai kebutuhan.",
    },
  ],
})
export const visitsSeed: Visit[] = [
  {
    id: "KJ-20261026-001",
    patient: "RM-00128",
    doctor: "d1",
    service: "s1",
    schedule: "j1",
    date: DEMO_DATE,
    complaint: "Demam ringan sejak kemarin",
    source: "Online",
    status: "Terdaftar",
    queue: "Menunggu",
    number: 1,
  },
  {
    id: "KJ-20261026-002",
    patient: "RM-00129",
    doctor: "d2",
    service: "s2",
    schedule: "j2",
    date: DEMO_DATE,
    complaint: "Pemeriksaan gigi",
    source: "Online",
    status: "Terdaftar",
    queue: "Menunggu",
    number: 1,
  },
  {
    id: "KJ-20261026-003",
    patient: "RM-00130",
    doctor: "d1",
    service: "s1",
    schedule: "j1",
    date: DEMO_DATE,
    complaint: "Sakit kepala",
    source: "Walk-in",
    status: "Hadir",
    queue: "Menunggu",
    number: 2,
  },
  {
    id: "KJ-20261026-004",
    patient: "RM-00132",
    doctor: "d2",
    service: "s2",
    schedule: "j2",
    date: DEMO_DATE,
    complaint: "Nyeri gigi",
    source: "Walk-in",
    status: "Hadir",
    queue: "Dipanggil",
    number: 2,
  },
  {
    id: "KJ-20261026-005",
    patient: "RM-00131",
    doctor: "d3",
    service: "s3",
    schedule: "j3",
    date: DEMO_DATE,
    complaint: "Batuk ringan",
    source: "Walk-in",
    status: "Hadir",
    queue: "Sedang Diperiksa",
    number: 1,
  },
  ...Array.from(
    { length: 5 },
    (_, i): Visit => ({
      id: `KJ-202610${23 - i}-00${i + 6}`,
      patient: patientsSeed[i].id,
      doctor: doctorsSeed[i % 3].id,
      service: servicesSeed[i % 3].id,
      schedule: `j${(i % 3) + 1}`,
      date: `2026-10-${23 - i}`,
      complaint: "Konsultasi kesehatan",
      source: i % 2 ? "Walk-in" : "Online",
      status: "Selesai",
      queue: "Selesai",
      number: 1,
      examination: exam(i),
    }),
  ),
  {
    id: "KJ-20261024-011",
    patient: "RM-00130",
    doctor: "d1",
    service: "s1",
    schedule: "j1",
    date: "2026-10-24",
    complaint: "Kontrol",
    source: "Walk-in",
    status: "Hadir",
    queue: "Dilewati",
    number: 3,
    reason: "Tidak hadir saat dipanggil",
  },
  {
    id: "KJ-20261024-012",
    patient: "RM-00132",
    doctor: "d2",
    service: "s2",
    schedule: "j2",
    date: "2026-10-24",
    complaint: "Kontrol gigi",
    source: "Online",
    status: "Dibatalkan",
    queue: "Dibatalkan",
    number: 4,
    reason: "Berhalangan hadir",
  },
]
export const queueLabel = (v: Visit) =>
  `${v.doctor.replace("d", "").padStart(2, "0")}-${String(v.number).padStart(3, "0")}`
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
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
