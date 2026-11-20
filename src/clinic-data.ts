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

export const formatNotificationMessage = (
  rawPesan: string,
  doctors?: Doctor[],
  visits?: Visit[],
): string => {
  if (!rawPesan) return ""
  let formatted = String(rawPesan).replace(/^\[SEED\]\s*/i, "")

  // Tentukan indeks dokter dari pencocokan nama dokter dalam pesan
  let doctorIdx = -1
  if (doctors && doctors.length > 0) {
    for (let i = 0; i < doctors.length; i++) {
      const doc = doctors[i]
      if (!doc?.name) continue
      if (formatted.toLowerCase().includes(doc.name.toLowerCase())) {
        doctorIdx = i
        break
      }
      const cleanDocName = doc.name
        .replace(/^(?:drg?\.\s*|dr\.\s*)/i, "")
        .split(",")[0]
        .trim()
      if (
        cleanDocName.length > 3 &&
        formatted.toLowerCase().includes(cleanDocName.toLowerCase())
      ) {
        doctorIdx = i
        break
      }
    }
  }

  const formatQueueTicket = (rawNum: number | string, docIndex: number) => {
    const n = typeof rawNum === "string" ? parseInt(rawNum, 10) : rawNum
    const numPart = String(isNaN(n) ? rawNum : n).padStart(3, "0")
    const prefix = docIndex >= 0 ? String(docIndex + 1).padStart(2, "0") : "01"
    return `${prefix}-${numPart}`
  }

  // Pola: "Kunjungan <UUID> (<label>)" -> "Kunjungan <label>"
  formatted = formatted.replace(
    /Kunjungan\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*\(([^)]+)\)/gi,
    "Kunjungan $2",
  )

  // Pola: "<UUID> (<label>)" -> "<label>"
  formatted = formatted.replace(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*\(([^)]+)\)/gi,
    "$2",
  )

  // Seragamkan format tanggal di pesan (DD-MM-YYYY atau YYYY-MM-DD) menggunakan dateLabel(...)
  formatted = formatted.replace(
    /\b(\d{2})-(\d{2})-(\d{4})\b/g,
    (_, day, month, year) => {
      const dNum = parseInt(day, 10)
      const mNum = parseInt(month, 10)
      const yNum = parseInt(year, 10)
      if (
        dNum >= 1 &&
        dNum <= 31 &&
        mNum >= 1 &&
        mNum <= 12 &&
        yNum >= 2000 &&
        yNum <= 2099
      ) {
        return dateLabel(`${year}-${month}-${day}`)
      }
      return `${day}-${month}-${year}`
    },
  )
  formatted = formatted.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (_, year, month, day) => {
      const dNum = parseInt(day, 10)
      const mNum = parseInt(month, 10)
      const yNum = parseInt(year, 10)
      if (
        dNum >= 1 &&
        dNum <= 31 &&
        mNum >= 1 &&
        mNum <= 12 &&
        yNum >= 2000 &&
        yNum <= 2099
      ) {
        return dateLabel(`${year}-${month}-${day}`)
      }
      return `${year}-${month}-${day}`
    },
  )

  // Konversi pola nomor antrean mentah dari backend ke format tiket queueLabel (contoh: "01-001", "02-001")
  formatted = formatted.replace(
    /(nomor\s+antrean(?:\s+Anda)?(?:\s*:)?\s*|antrean(?:\s+nomor)?(?:\s*:)?\s*)(\d+)\b(?!-\d)/gi,
    (_, prefix, num) => {
      return `${prefix}${formatQueueTicket(num, doctorIdx)}`
    },
  )

  // Pola UUID: ganti dengan queueLabel jika cocok dengan kunjungan lokal
  if (visits && visits.length > 0) {
    formatted = formatted.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      (uuid) => {
        const v = visits.find(
          (vis) => vis.id.toLowerCase() === uuid.toLowerCase(),
        )
        if (v) {
          const dIdx = doctors ? doctors.findIndex((d) => d.id === v.doctor) : -1
          return queueLabel(v, dIdx)
        }
        return ""
      },
    )
  }

  // Hapus sisa UUID panjang / hex ID apa pun yang masih muncul di dalam pesan
  formatted = formatted.replace(/#[0-9a-f]{6,}/gi, "")
  formatted = formatted.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "",
  )
  formatted = formatted.replace(/\b[0-9a-f]{16,}\b/gi, "")

  // Bersihkan kurung kosong, pemisah ganda, dan spasi berlebih
  formatted = formatted
    .replace(/\(\s*\)/g, "")
    .replace(/·\s*·/g, "·")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.:;)])/g, "$1")
    .trim()

  return formatted
}

