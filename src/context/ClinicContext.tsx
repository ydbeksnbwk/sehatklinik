"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react"
import {
  DEMO_DATE,
  doctorsSeed,
  patientsSeed,
  schedulesSeed,
  servicesSeed,
  visitsSeed,
  notificationsSeed,
  notificationJobsSeed,
  clinicDetailSeed,
  remaining,
  type Role,
  type Visit,
  type Patient,
  type Doctor,
  type Service,
  type Schedule,
  type Examination,
  type NotificationItem,
  type NotificationJob,
  type NotificationType,
  type ClinicProfileDetail,
} from "../clinic-data"

export type ClinicUser = {
  name: string
  email: string
  role: string
  active: boolean
}

export type ClinicProfile = {
  name: string
  description: string
  address: string
  phone: string
  latitude: string
  longitude: string
  hours: string
  emergencyPhone?: string
  whatsapp?: string
  email?: string
  tagline?: string
  history?: string
  vision?: string
  mission?: string[]
  values?: { title: string; subtitle?: string; desc: string; icon: string }[]
  accreditation?: string
  accreditationNumber?: string
  facilities?: { name: string; category?: string; desc: string; icon: string }[]
  stats?: { value: string; label: string; sub: string }[]
}

export type BookingState = {
  patient: string
  service: string
  doctor: string
  date: string
  schedule: string
  complaint: string
}

type ClinicContextType = {
  role: Role
  setRole: (role: Role) => void
  switchRole: (role: string) => void
  page: string
  setPage: (page: string) => void
  navigate: (target: string) => void

  visits: Visit[]
  setVisits: React.Dispatch<React.SetStateAction<Visit[]>>
  updateVisit: (id: string, changes: Partial<Visit>) => void
  transition: (v: Visit, target: string) => void

  patients: Patient[]
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>

  doctors: Doctor[]
  setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>

  services: Service[]
  setServices: React.Dispatch<React.SetStateAction<Service[]>>

  schedules: Schedule[]
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>>

  users: ClinicUser[]
  setUsers: React.Dispatch<React.SetStateAction<ClinicUser[]>>

  clinic: ClinicProfile
  setClinic: React.Dispatch<React.SetStateAction<ClinicProfile>>

  // Notification State & Operations (SRS & API Contract)
  notifications: NotificationItem[]
  notificationJobs: NotificationJob[]
  notificationDrawerOpen: boolean
  setNotificationDrawerOpen: (val: boolean) => void
  webPushPermission: "default" | "granted" | "denied"
  unreadCount: number
  addNotification: (
    notif: Omit<NotificationItem, "id" | "timestamp" | "isRead">,
    pushBrowser?: boolean
  ) => void
  markNotificationAsRead: (id: string) => void
  markAllNotificationsAsRead: () => void
  deleteNotification: (id: string) => void
  clearAllNotifications: () => void
  requestWebPushPermission: () => Promise<void>
  sendDemoPushNotification: (customType?: NotificationType) => void
  retryNotificationJob: (id: string) => void

  mobile: boolean
  setMobile: (val: boolean) => void

  search: string
  setSearch: (val: string) => void
  filter: string
  setFilter: (val: string) => void
  doctorFilter: string
  setDoctorFilter: (val: string) => void
  serviceFilter: string
  setServiceFilter: (val: string) => void
  range: { from: string; to: string }
  setRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>
  pagination: number
  setPagination: (val: number) => void

  selected: string | null
  setSelected: (id: string | null) => void
  editor: { type: string; id?: string } | null
  setEditor: (val: { type: string; id?: string } | null) => void

  toast: string
  setToast: (val: string) => void
  notify: (message: string) => void

  error: string
  setError: (val: string) => void
  reason: string
  setReason: (val: string) => void

  exam: Examination | null
  setExam: (val: Examination | null) => void
  savedExam: boolean
  setSavedExam: (val: boolean) => void

  step: number
  setStep: (val: number) => void
  booking: BookingState
  setBooking: React.Dispatch<React.SetStateAction<BookingState>>
  receipt: Visit | null
  setReceipt: (val: Visit | null) => void
  busy: boolean
  setBusy: (val: boolean) => void
  editingProfile: boolean
  setEditingProfile: (val: boolean) => void

  // Helper getters
  patient: Patient
  doctorName: (id: string) => string
  serviceName: (id: string) => string
  patientName: (id: string) => string
  session: (id: string) => Schedule | undefined
  scopedVisits: Visit[]
  todayVisits: Visit[]
  activeVisits: Visit[]
  selectedVisit: Visit | undefined

  // Operations
  openVisit: (v: Visit) => void
  submitBooking: (e: FormEvent<HTMLFormElement>) => void
  saveExamination: (e: FormEvent<HTMLFormElement>) => void
  showEditor: (type: string, id?: string) => void
  resetToDefaults: () => void
}

const defaultClinic: ClinicProfile = {
  name: clinicDetailSeed.name,
  description: clinicDetailSeed.description,
  address: clinicDetailSeed.address,
  phone: clinicDetailSeed.phone,
  latitude: clinicDetailSeed.latitude,
  longitude: clinicDetailSeed.longitude,
  hours: clinicDetailSeed.hours,
  emergencyPhone: clinicDetailSeed.emergencyPhone,
  whatsapp: clinicDetailSeed.whatsapp,
  email: clinicDetailSeed.email,
  tagline: clinicDetailSeed.tagline,
  history: clinicDetailSeed.history,
  vision: clinicDetailSeed.vision,
  mission: clinicDetailSeed.mission,
  values: clinicDetailSeed.values,
  accreditation: clinicDetailSeed.accreditation,
  accreditationNumber: clinicDetailSeed.accreditationNumber,
  facilities: clinicDetailSeed.facilities,
  stats: clinicDetailSeed.stats,
}

const defaultUsers: ClinicUser[] = [
  {
    name: "Rina Kusuma",
    email: "rina@sehatklinik.id",
    role: "Admin",
    active: true,
  },
  {
    name: "Dina Wulandari",
    email: "dina@sehatklinik.id",
    role: "Petugas",
    active: true,
  },
  {
    name: "dr. Nadia Putri",
    email: "nadia@sehatklinik.id",
    role: "Dokter",
    active: true,
  },
]

const ClinicContext = createContext<ClinicContextType | null>(null)

// Soft chime sound helper
function playChime() {
  if (typeof window === "undefined") return
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(587.33, now) // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.35)
  } catch {
    // Ignore audio autoplay restrictions
  }
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("Publik")
  const [page, setPage] = useState("Beranda")

  const [visits, setVisits] = useState<Visit[]>(visitsSeed)
  const [patients, setPatients] = useState<Patient[]>(patientsSeed)
  const [doctors, setDoctors] = useState<Doctor[]>(doctorsSeed)
  const [services, setServices] = useState<Service[]>(servicesSeed)
  const [schedules, setSchedules] = useState<Schedule[]>(schedulesSeed)
  const [users, setUsers] = useState<ClinicUser[]>(defaultUsers)
  const [clinic, setClinic] = useState<ClinicProfile>(defaultClinic)

  // Notification States
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationsSeed)
  const [notificationJobs, setNotificationJobs] = useState<NotificationJob[]>(notificationJobsSeed)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)
  const [webPushPermission, setWebPushPermission] = useState<"default" | "granted" | "denied">("default")

  const [mobile, setMobile] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("")
  const [doctorFilter, setDoctorFilter] = useState("")
  const [serviceFilter, setServiceFilter] = useState("")
  const [range, setRange] = useState({ from: "2026-10-01", to: DEMO_DATE })
  const [pagination, setPagination] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ type: string; id?: string } | null>(null)
  const [toast, setToast] = useState("")
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const [exam, setExam] = useState<Examination | null>(null)
  const [savedExam, setSavedExam] = useState(false)
  const [step, setStep] = useState(1)
  const [booking, setBooking] = useState<BookingState>({
    patient: "RM-00128",
    service: "s1",
    doctor: "d1",
    date: DEMO_DATE,
    schedule: "j1",
    complaint: "",
  })
  const [receipt, setReceipt] = useState<Visit | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Check browser Notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setWebPushPermission(Notification.permission)
    }
  }, [])

  // Load state from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sehatklinik_state_v1")
      if (stored) {
        const data = JSON.parse(stored)
        if (data.visits) setVisits(data.visits)
        if (data.patients) setPatients(data.patients)
        if (data.doctors) setDoctors(data.doctors)
        if (data.services) setServices(data.services)
        if (data.schedules) setSchedules(data.schedules)
        if (data.users) setUsers(data.users)
        if (data.clinic) setClinic({ ...defaultClinic, ...data.clinic })
        if (data.notifications) {
          const isUpdatedFormat = data.notifications.some(
            (n: { id: string; message?: string }) =>
              n.id === "notif-001-selesai" && n.message?.includes(" - ")
          )
          setNotifications(isUpdatedFormat ? data.notifications : notificationsSeed)
        }
        if (data.notificationJobs) setNotificationJobs(data.notificationJobs)

        if (typeof window !== "undefined") {
          const path = window.location.pathname
          if (path === "/admin") setRole("Admin")
          else if (path === "/petugas") setRole("Petugas")
          else if (path === "/dokter-dashboard" || path === "/dokter/dashboard") setRole("Dokter")
          else if (path === "/pasien") setRole("Pasien")
          else if (path === "/dashboard") {
            setRole(data.role && data.role !== "Publik" ? data.role : "Pasien")
          } else if (
            ["/layanan", "/jadwal", "/lokasi", "/profil", "/login", "/daftar"].includes(path) || path === "/dokter"
          ) {
            setRole("Publik")
          } else if (data.role) {
            setRole(data.role)
          }
        }
      }
    } catch {
      // ignore parsing error
    } finally {
      setInitialized(true)
    }
  }, [])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!initialized) return
    try {
      localStorage.setItem(
        "sehatklinik_state_v1",
        JSON.stringify({
          role,
          visits,
          patients,
          doctors,
          services,
          schedules,
          users,
          clinic,
          notifications,
          notificationJobs,
        })
      )
    } catch {
      // ignore
    }
  }, [initialized, role, visits, patients, doctors, services, schedules, users, clinic, notifications, notificationJobs])

  // Dialog ESC listener
  useEffect(() => {
    if (!selected && !editor && !notificationDrawerOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null)
        setEditor(null)
        setNotificationDrawerOpen(false)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [selected, editor, notificationDrawerOpen])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 4500)
  }

  // Add Notification with Outbox Pattern according to SRS
  const addNotification = (
    notif: Omit<NotificationItem, "id" | "timestamp" | "isRead">,
    pushBrowser = true
  ) => {
    const newId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const newTimestamp = new Date().toISOString()
    const item: NotificationItem = {
      ...notif,
      id: newId,
      timestamp: newTimestamp,
      isRead: false,
    }

    // Add Outbox Job Record (sesuai SRS Bab 3 & 4: tabel notifikasi_job)
    const jobId = `job-${Date.now()}`
    const job: NotificationJob = {
      id: jobId,
      profileId: notif.targetUserId || (notif.targetRole === "Petugas" ? "USR-PETUGAS" : "USR-SYSTEM"),
      recipientName:
        notif.targetRole === "Pasien"
          ? patient.name
          : notif.targetRole === "Petugas"
          ? "Petugas Loket"
          : notif.targetRole === "Dokter"
          ? "dr. Nadia Putri"
          : "Admin / Sistem",
      recipientRole: notif.targetRole === "Semua" ? "Pasien" : notif.targetRole,
      eventType: notif.type,
      visitId: notif.visitId || "KJ-SISTEM",
      queueNumber: notif.queueNumber,
      status: "berhasil",
      attempts: 1,
      error: null,
      createdAt: newTimestamp,
      processedAt: newTimestamp,
    }

    setNotifications((prev) => [item, ...prev])
    setNotificationJobs((prev) => [job, ...prev])

    // Play subtle audio cue
    playChime()

    // Trigger Browser Web Push if permitted
    if (pushBrowser && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(notif.title, {
            body: notif.message,
            icon: "/images/sehatklinik-symbol.png",
          })
        } catch {
          // ignore notification trigger errors
        }
      }
    }

    // Also surface as a toast
    notify(`🔔 ${notif.title}: ${notif.message.slice(0, 60)}...`)
  }

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    notify("Semua notifikasi telah ditandai sebagai dibaca.")
  }

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
    notify("Seluruh riwayat notifikasi telah dibersihkan.")
  }

  const requestWebPushPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      notify("Browser ini tidak mendukung Web Push Notification.")
      return
    }
    try {
      const permission = await Notification.requestPermission()
      setWebPushPermission(permission)
      if (permission === "granted") {
        notify("Izin Web Push berhasil diaktifkan! Notifikasi akan dikirim secara real-time.")
        addNotification({
          targetRole: "Semua",
          type: "INFO",
          title: "Web Push Berhasil Diaktifkan",
          message: "Anda akan menerima pemberitahuan langsung saat giliran antrean dipanggil atau pendaftaran diverifikasi.",
        })
      } else if (permission === "denied") {
        notify("Izin notifikasi ditolak oleh browser. Anda tetap dapat melihat notifikasi di dalam aplikasi.")
      }
    } catch {
      notify("Gagal meminta izin notifikasi browser.")
    }
  }

  const sendDemoPushNotification = (customType?: NotificationType) => {
    const type = customType || "ANTREAN_DIPANGGIL"
    if (type === "ANTREAN_DIPANGGIL") {
      addNotification({
        targetRole: "Pasien",
        targetUserId: patient.id,
        type: "ANTREAN_DIPANGGIL",
        title: "Giliran Anda Telah Tiba!",
        message: `Nomor antrean 01-001 (dr. Nadia Putri - Poli Umum) sekarang dipanggil. Silakan menuju Ruang Periksa 1.`,
        visitId: "KJ-20261026-001",
        queueNumber: "01-001",
        actionUrl: "detail",
      })
    } else if (type === "GILIRAN_MENDEKAT") {
      addNotification({
        targetRole: "Pasien",
        targetUserId: patient.id,
        type: "GILIRAN_MENDEKAT",
        title: "Giliran Antrean Hampir Tiba",
        message: "Satu pasien lagi sebelum nomor giliran Anda. Mohon bersiap di ruang tunggu.",
        visitId: "KJ-20261026-001",
        queueNumber: "01-001",
        actionUrl: "detail",
      })
    } else if (type === "PENDAFTARAN_BARU") {
      addNotification({
        targetRole: "Petugas",
        type: "PENDAFTARAN_BARU",
        title: "Pendaftaran Online Masuk",
        message: "Pasien baru mendaftar untuk konsultasi Poli Anak pada sesi jam 09.00 WIB.",
        actionUrl: "antrean",
      })
    } else {
      addNotification({
        targetRole: "Semua",
        type: "INFO",
        title: "Uji Coba Sistem Notifikasi Web Push",
        message: "Koneksi worker pengiriman notifikasi BullMQ + Redis terverifikasi aman dan responsif sesuai SRS.",
      })
    }
  }

  const retryNotificationJob = (jobId: string) => {
    setNotificationJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: "berhasil",
              attempts: j.attempts + 1,
              error: null,
              processedAt: new Date().toISOString(),
            }
          : j
      )
    )
    notify(`Pekerjaan notifikasi ${jobId} berhasil diproses ulang (retry sukses).`)
  }

  // Active unread notifications for current role
  const unreadCount = notifications.filter(
    (n) => !n.isRead && (n.targetRole === "Semua" || n.targetRole === role)
  ).length

  const navigate = (target: string) => {
    setPage(target)
    setEditingProfile(false)
    setMobile(false)
    setSearch("")
    setFilter("")
    setDoctorFilter("")
    setServiceFilter("")
    setPagination(1)
    setStep(1)
    setReceipt(null)
    setError("")
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const switchRole = (value: string) => {
    setRole(value as Role)
    setSelected(null)
    setEditor(null)
    setBooking((b) => ({ ...b, patient: "RM-00128" }))
    navigate(value === "Publik" ? "Beranda" : "Dashboard")
  }

  const patient = patients.find((p) => p.id === "RM-00128") || patients[0]
  const doctorName = (id: string) =>
    doctors.find((d) => d.id === id)?.name || "Dokter"
  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name || "Layanan"
  const patientName = (id: string) =>
    patients.find((p) => p.id === id)?.name || "Pasien"
  const session = (id: string) => schedules.find((s) => s.id === id)

  const scopedVisits = visits.filter((v) =>
    role === "Pasien"
      ? v.patient === patient.id
      : role === "Dokter"
      ? v.doctor === "d1"
      : true
  )
  const todayVisits = scopedVisits.filter((v) => v.date === DEMO_DATE)
  const activeVisits = scopedVisits.filter(
    (v) => !["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue)
  )
  const selectedVisit = scopedVisits.find((v) => v.id === selected)

  const openVisit = (v: Visit) => {
    setSelected(v.id)
    setError("")
    setReason("")
    setSavedExam(Boolean(v.examination))
    setExam(
      v.examination
        ? structuredClone(v.examination)
        : {
            anamnesis: v.complaint,
            pressure: "",
            temperature: "",
            weight: "",
            diagnosis: "",
            notes: "",
            actions: [],
          }
    )
  }

  const updateVisit = (id: string, changes: Partial<Visit>) =>
    setVisits((previous) =>
      previous.map((v) => (v.id === id ? { ...v, ...changes } : v))
    )

  // Transition queue and trigger business notifications according to SRS & API Contract
  const transition = (v: Visit, target: string) => {
    const qLabel = `${v.doctor.replace("d", "").padStart(2, "0")}-${String(v.number).padStart(3, "0")}`
    const pName = patientName(v.patient)
    const docName = doctorName(v.doctor)

    if (
      target === "checkin" &&
      role === "Petugas" &&
      v.status === "Terdaftar" &&
      v.queue === "Menunggu"
    ) {
      updateVisit(v.id, { status: "Hadir" })
      notify(`Pasien ${pName} (${qLabel}) berhasil Check-in. Siap dipanggil.`)
    } else if (
      target === "call" &&
      ["Petugas", "Dokter"].includes(role) &&
      v.status === "Hadir" &&
      v.queue === "Menunggu"
    ) {
      updateVisit(v.id, { queue: "Dipanggil" })

      // Trigger ANTREAN_DIPANGGIL notification for the patient
      addNotification({
        targetRole: "Pasien",
        targetUserId: v.patient,
        type: "ANTREAN_DIPANGGIL",
        title: "Giliran Anda Telah Dipanggil!",
        message: `Nomor antrean ${qLabel} (${docName}) dipanggil ke ruang periksa. Silakan segera masuk.`,
        visitId: v.id,
        queueNumber: qLabel,
        actionUrl: "detail",
      })

      // Find the NEXT waiting patient for this doctor and send GILIRAN_MENDEKAT notification (SRS 11)
      const nextInLine = todayVisits.find(
        (other) =>
          other.id !== v.id &&
          other.doctor === v.doctor &&
          other.status === "Hadir" &&
          other.queue === "Menunggu"
      )
      if (nextInLine) {
        const nextQLabel = `${nextInLine.doctor.replace("d", "").padStart(2, "0")}-${String(nextInLine.number).padStart(3, "0")}`
        addNotification(
          {
            targetRole: "Pasien",
            targetUserId: nextInLine.patient,
            type: "GILIRAN_MENDEKAT",
            title: "Giliran Antrean Anda Hampir Tiba",
            message: `Nomor antrean sebelum Anda (${qLabel}) sedang dipanggil. Mohon bersiap di ruang tunggu untuk nomor Anda ${nextQLabel}.`,
            visitId: nextInLine.id,
            queueNumber: nextQLabel,
            actionUrl: "detail",
          },
          false
        )
      }
    } else if (target === "start" && role === "Dokter" && v.queue === "Dipanggil") {
      updateVisit(v.id, { queue: "Sedang Diperiksa" })
      notify(`Pemeriksaan untuk antrean ${qLabel} dimulai.`)
    } else if (
      target === "skip" &&
      role === "Petugas" &&
      v.queue === "Dipanggil" &&
      reason.trim()
    ) {
      updateVisit(v.id, { queue: "Dilewati", reason })
      addNotification({
        targetRole: "Pasien",
        targetUserId: v.patient,
        type: "KUNJUNGAN_DIBATALKAN",
        title: "Antrean Dilewati",
        message: `Nomor antrean ${qLabel} dilewati karena: ${reason}. Silakan hubungi loket petugas untuk jadwal ulang.`,
        visitId: v.id,
        queueNumber: qLabel,
        actionUrl: "detail",
      })
    } else if (
      target === "cancel" &&
      ((role === "Pasien" && v.queue === "Menunggu") ||
        (role === "Petugas" && ["Menunggu", "Dipanggil"].includes(v.queue))) &&
      reason.trim()
    ) {
      updateVisit(v.id, { queue: "Dibatalkan", status: "Dibatalkan", reason })
      addNotification({
        targetRole: "Pasien",
        targetUserId: v.patient,
        type: "KUNJUNGAN_DIBATALKAN",
        title: "Kunjungan Dibatalkan",
        message: `Kunjungan ${v.id} (${qLabel}) dibatalkan. Alasan: ${reason}. Kuota jadwal telah dikembalikan.`,
        visitId: v.id,
        queueNumber: qLabel,
        actionUrl: "detail",
      })
    } else {
      setError(
        "Tindakan tidak tersedia. Periksa status kunjungan dan isi alasan bila diperlukan."
      )
      return
    }
    setError("")
  }

  // Submit Booking with Automatic Patient & Officer Notifications (SRS 11 & Kontrak API 10)
  const submitBooking = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    if (step < 3) {
      setStep(step + 1)
      return
    }
    const sched = session(booking.schedule)
    if (
      !sched ||
      !sched.active ||
      sched.doctor !== booking.doctor ||
      new Date(`${booking.date}T12:00:00`).getDay() !== sched.day
    ) {
      setError("Pilih sesi aktif yang sesuai hari kunjungan.")
      return
    }
    if (
      visits.some(
        (v) =>
          v.patient === booking.patient &&
          v.schedule === sched.id &&
          v.date === booking.date &&
          v.status !== "Dibatalkan"
      )
    ) {
      setError(
        "Pasien sudah memiliki kunjungan aktif pada dokter, sesi, dan tanggal ini."
      )
      return
    }
    if (!remaining(sched, booking.date, visits)) {
      setError("Kuota sesi sudah penuh. Silakan pilih sesi lain.")
      return
    }
    const number =
      Math.max(
        0,
        ...visits
          .filter((v) => v.doctor === booking.doctor && v.date === booking.date)
          .map((v) => v.number)
      ) + 1
    const next: Visit = {
      id: `KJ-${booking.date.replace(/-/g, "")}-${String(
        visits.length + 1
      ).padStart(3, "0")}`,
      ...booking,
      number,
      source: role === "Petugas" ? "Walk-in" : "Online",
      status: "Terdaftar",
      queue: "Menunggu",
    }
    setBusy(true)
    setVisits((previous) => [...previous, next])
    setReceipt(next)
    setStep(4)
    setBusy(false)

    const qLabel = `${next.doctor.replace("d", "").padStart(2, "0")}-${String(next.number).padStart(3, "0")}`
    const dName = doctorName(next.doctor)
    const sName = serviceName(next.service)
    const pName = patientName(next.patient)

    // Notifikasi ke Pasien (SRS 11: Pendaftaran berhasil)
    addNotification({
      targetRole: "Pasien",
      targetUserId: next.patient,
      type: "KUNJUNGAN_TERDAFTAR",
      title: "Pendaftaran Kunjungan Berhasil!",
      message: `Kunjungan di ${sName} bersama ${dName} pada ${next.date} telah terdaftar. Nomor antrean Anda: ${qLabel}.`,
      visitId: next.id,
      queueNumber: qLabel,
      actionUrl: "detail",
    })

    // Notifikasi ke Petugas (SRS 11: Pendaftaran online baru)
    if (next.source === "Online") {
      addNotification(
        {
          targetRole: "Petugas",
          type: "PENDAFTARAN_BARU",
          title: "Pendaftaran Online Baru",
          message: `Pasien ${pName} mendaftar online ke ${sName} (${dName}) untuk tanggal ${next.date}. Nomor antrean: ${qLabel}.`,
          visitId: next.id,
          queueNumber: qLabel,
          actionUrl: "antrean",
        },
        false
      )
    }
  }

  const saveExamination = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (
      !selectedVisit ||
      role !== "Dokter" ||
      selectedVisit.queue !== "Sedang Diperiksa" ||
      !exam
    )
      return
    const [systolic, diastolic] = exam.pressure.split("/").map(Number)
    if (
      systolic < 60 ||
      systolic > 250 ||
      diastolic < 30 ||
      diastolic > 150 ||
      systolic <= diastolic
    ) {
      setError(
        "Tekanan darah di luar rentang simulasi: sistolik 60–250, diastolik 30–150, dan sistolik harus lebih tinggi."
      )
      return
    }
    setError("")
    updateVisit(selectedVisit.id, { examination: exam })
    setSavedExam(true)
    notify("Pemeriksaan tersimpan dalam simulasi.")
  }

  const showEditor = (type: string, id?: string) => {
    setEditor({ type, id })
    setError("")
  }

  const resetToDefaults = () => {
    setVisits(visitsSeed)
    setPatients(patientsSeed)
    setDoctors(doctorsSeed)
    setServices(servicesSeed)
    setSchedules(schedulesSeed)
    setUsers(defaultUsers)
    setClinic(defaultClinic)
    setNotifications(notificationsSeed)
    setNotificationJobs(notificationJobsSeed)
    setRole("Publik")
    setPage("Beranda")
    localStorage.removeItem("sehatklinik_state_v1")
    notify("Data sistem berhasil direset ke data awal seed.")
  }

  return (
    <ClinicContext.Provider
      value={{
        role,
        setRole,
        switchRole,
        page,
        setPage,
        navigate,

        visits,
        setVisits,
        updateVisit,
        transition,

        patients,
        setPatients,

        doctors,
        setDoctors,

        services,
        setServices,

        schedules,
        setSchedules,

        users,
        setUsers,

        clinic,
        setClinic,

        notifications,
        notificationJobs,
        notificationDrawerOpen,
        setNotificationDrawerOpen,
        webPushPermission,
        unreadCount,
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        clearAllNotifications,
        requestWebPushPermission,
        sendDemoPushNotification,
        retryNotificationJob,

        mobile,
        setMobile,

        search,
        setSearch,
        filter,
        setFilter,
        doctorFilter,
        setDoctorFilter,
        serviceFilter,
        setServiceFilter,
        range,
        setRange,
        pagination,
        setPagination,

        selected,
        setSelected,
        editor,
        setEditor,

        toast,
        setToast,
        notify,

        error,
        setError,
        reason,
        setReason,

        exam,
        setExam,
        savedExam,
        setSavedExam,

        step,
        setStep,
        booking,
        setBooking,
        receipt,
        setReceipt,
        busy,
        setBusy,
        editingProfile,
        setEditingProfile,

        patient,
        doctorName,
        serviceName,
        patientName,
        session,
        scopedVisits,
        todayVisits,
        activeVisits,
        selectedVisit,

        openVisit,
        submitBooking,
        saveExamination,
        showEditor,
        resetToDefaults,
      }}
    >
      {children}
    </ClinicContext.Provider>
  )
}

export function useClinic() {
  const context = useContext(ClinicContext)
  if (!context) {
    throw new Error("useClinic must be used within a ClinicProvider")
  }
  return context
}
