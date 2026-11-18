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
