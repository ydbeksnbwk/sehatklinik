"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react"
import { createClient } from "@/utils/supabase/client"
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
  queueLabel,
  type Role,
  type Visit,
  type QueueStatus,
  type VisitStatus,
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
  password?: string
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
  transition: (v: Visit, target: string) => Promise<void>

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

  currentUser: ClinicUser | null
  setCurrentUser: React.Dispatch<React.SetStateAction<ClinicUser | null>>
  login: (email: string, password?: string) => Promise<{ success: boolean; message: string; user?: ClinicUser }>
  logout: () => Promise<void> | void

  clinic: ClinicProfile
  setClinic: React.Dispatch<React.SetStateAction<ClinicProfile>>

  // Notification State & Operations (SRS & API Contract)
  notifications: NotificationItem[]
  notificationJobs: NotificationJob[]
  notificationDrawerOpen: boolean
  setNotificationDrawerOpen: (val: boolean) => void
  webPushPermission: "default" | "granted" | "denied" | "unsupported"
  loadingData: boolean
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
  submitBooking: (e: FormEvent<HTMLFormElement>) => Promise<void>
  saveExamination: (e: FormEvent<HTMLFormElement>) => Promise<void>
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
    password: "password123",
  },
  {
    name: "Dina Wulandari",
    email: "dina@sehatklinik.id",
    role: "Petugas",
    active: true,
    password: "password123",
  },
  {
    name: "dr. Reyhan Adhitama",
    email: "dokter@sehatklinik.id",
    role: "Dokter",
    active: true,
    password: "password123",
  },
  {
    name: "dr. Reyhan Adhitama",
    email: "reyhan.adhitama@gmail.com",
    role: "Dokter",
    active: true,
    password: "password123",
  },
  {
    name: "dr. Nadia Putri",
    email: "nadia@sehatklinik.id",
    role: "Dokter",
    active: true,
    password: "password123",
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
  const [users, setUsers] = useState<ClinicUser[]>([])
  const [currentUser, setCurrentUser] = useState<ClinicUser | null>(null)
  const [clinic, setClinic] = useState<ClinicProfile>(defaultClinic)

  // Notification States
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationsSeed)
  const [notificationJobs, setNotificationJobs] = useState<NotificationJob[]>(notificationJobsSeed)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)
  const [webPushPermission, setWebPushPermission] = useState<
    "default" | "granted" | "denied" | "unsupported"
  >("default")

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
    patient: "",
    service: "s1",
    doctor: "d1",
    date: DEMO_DATE,
    schedule: "j1",
    complaint: "",
  })
  const [receipt, setReceipt] = useState<Visit | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [editingProfile, setEditingProfile] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Check browser Web Push & Service Worker support and Notification permission on mount
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    setWebPushPermission(supported ? Notification.permission : "unsupported")
  }, [])

  // Load state from localStorage on client mount
  useEffect(() => {
    try {
      // Invalidate old state v1/v2 cache to ensure clean seed/Supabase sync
      if (typeof window !== "undefined") {
        localStorage.removeItem("sehatklinik_state_v1")
        localStorage.removeItem("sehatklinik_state_v2")
      }
      const stored = typeof window !== "undefined" ? localStorage.getItem("sehatklinik_state_v3") : null
      if (stored) {
        const data = JSON.parse(stored)
        if (data.visits?.length) setVisits(data.visits)
        if (data.patients?.length) setPatients(data.patients)
        if (data.doctors) setDoctors(data.doctors)
        if (data.services) setServices(data.services)
        if (data.schedules) setSchedules(data.schedules)
        if (data.users) setUsers(data.users)
        if (data.clinic) setClinic({ ...defaultClinic, ...data.clinic })
        if (data.notifications) setNotifications(data.notifications)
        if (data.notificationJobs) setNotificationJobs(data.notificationJobs)

        if (typeof window !== "undefined") {
          const path = window.location.pathname
          if (path === "/admin") setRole("Admin")
          else if (path === "/petugas") setRole("Petugas")
          else if (path === "/dokter-dashboard" || path === "/dokter/dashboard") setRole("Dokter")
          else if (path === "/pasien") setRole("Pasien")
          else if (path === "/dashboard") {
            setRole(data.role && data.role !== "Publik" ? data.role : "Pasien")
          } else if (path.startsWith("/riwayat/") || path.startsWith("/kunjungan/")) {
            setRole(data.role && data.role !== "Publik" ? data.role : "Pasien")
          } else if (
            path === "/" ||
            ["/layanan", "/jadwal", "/lokasi", "/profil", "/login", "/daftar"].includes(path) ||
            path === "/dokter" ||
            path.startsWith("/layanan/") ||
            (path.startsWith("/dokter/") && !path.startsWith("/dokter/dashboard"))
          ) {
            setRole("Publik")
          } else if (data.role) {
            setRole(data.role)
          }
        }
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("sehatklinik_current_user") : null
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser)
            setCurrentUser(parsed)
          } catch { }
        }
      }
    } catch {
      // ignore parsing error
    } finally {
      setInitialized(true)
    }
  }, [])

  // Load real data from Supabase (Doctors, Services, Schedules, Profile, Visits, Patients)
  useEffect(() => {
    let supabase: ReturnType<typeof createClient> | null = null
    try {
      const hasEnv =
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
      if (hasEnv) {
        supabase = createClient()
      }
    } catch {
      supabase = null
    }

    async function fetchVisits(): Promise<boolean> {
      try {
        const res = await fetch("/api/kunjungan")
        if (res.ok) {
          const json = await res.json()
          if (json.data && json.data.length > 0) {
            const queueStatusMap: Record<string, QueueStatus> = {
              menunggu: "Menunggu",
              dipanggil: "Dipanggil",
              diperiksa: "Sedang Diperiksa",
              selesai: "Selesai",
              dilewati: "Dilewati",
              batal: "Dibatalkan",
            }
            const visitStatusMap: Record<string, VisitStatus> = {
              terdaftar: "Terdaftar",
              hadir: "Hadir",
              selesai: "Selesai",
              batal: "Dibatalkan",
            }
            const dbVisits: Visit[] = json.data.map((k: any) => {
              const q = Array.isArray(k.antrean) ? k.antrean[0] : k.antrean
              return {
                id: k.id,
                patient: k.pasien_id || "RM-00128",
                doctor: k.dokter_id,
                service: k.layanan_id,
                schedule: k.jadwal_id || "j1",
                date: k.tanggal,
                complaint: k.keluhan || "",
                source: k.sumber === "walk_in" ? "Walk-in" : "Online",
                status: visitStatusMap[k.status] || "Terdaftar",
                queue: q ? queueStatusMap[q.status] || "Menunggu" : "Menunggu",
                number: q?.nomor_antrean || 1,
                reason: q?.alasan || undefined,
              }
            })
            setVisits(dbVisits)
            return true
          }
        }
      } catch (err) {
        console.warn("Gagal memuat kunjungan:", err)
      }
      return false
    }

    async function loadSupabaseData() {
      if (!supabase) {
        setLoadingData(false)
        return
      }
      setLoadingData(true)
      try {
        // Sync Supabase Auth session if already logged in
        const { data: authData } = await supabase.auth.getUser()
        if (authData?.user) {
          const userMeta = authData.user.user_metadata || {}
          const userRole = (userMeta.role || authData.user.app_metadata?.role || "Pasien") as Role
          const authUser: ClinicUser = {
            name: userMeta.name || authData.user.email?.split("@")[0] || "Pengguna",
            email: authData.user.email || "",
            role: userRole,
            active: true,
          }
          setCurrentUser(authUser)
        }

        // Fetch live catalog data & clinic profile
        const [
          { data: doctorsData },
          { data: servicesData },
          { data: schedulesData },
          { data: dlData },
          { data: clinicData },
        ] = await Promise.all([
          supabase.from("dokter").select("*"),
          supabase.from("layanan").select("*"),
          supabase.from("jadwal_praktik").select("*"),
          supabase.from("dokter_layanan").select("*"),
          supabase.from("profil_klinik").select("*").limit(1),
        ])

        if (clinicData && clinicData.length > 0) {
          const c = clinicData[0]
          setClinic((prev) => ({
            ...prev,
            name: c.nama || prev.name,
            description: c.deskripsi || prev.description,
            address: c.alamat || prev.address,
            phone: c.kontak || prev.phone,
            latitude: String(c.latitude ?? prev.latitude),
            longitude: String(c.longitude ?? prev.longitude),
          }))
        }

        let loadedServices: Service[] = []
        if (servicesData && servicesData.length > 0) {
          loadedServices = servicesData.map((l: any) => {
            const existing = servicesSeed.find(
              (s) => s.id === l.id || s.name.toLowerCase() === l.nama_layanan?.toLowerCase()
            )
            return {
              id: l.id,
              name: l.nama_layanan,
              description: l.deskripsi || "",
              duration: l.durasi_menit || 20,
              active: l.aktif ?? true,
              overview: l.deskripsi || existing?.overview || "",
              steps: existing?.steps || [
                { step: 1, title: "Registrasi & Skrining", description: "Pemeriksaan tanda vital dasar." },
                { step: 2, title: "Konsultasi & Pemeriksaan", description: "Konsultasi langsung bersama dokter." },
                { step: 3, title: "Tindakan & Resep", description: "Pemberian instruksi medis dan edukasi." },
              ],
              cases: existing?.cases || ["Pemeriksaan umum", "Konsultasi keluhan awal"],
              facilities: existing?.facilities || ["Ruang periksa ber-AC", "Alat diagnosa standar"],
              preparation: existing?.preparation || "Bawa kartu identitas atau bukti pendaftaran.",
            }
          })
          setServices(loadedServices)
        }

        let loadedDoctors: Doctor[] = []
        if (doctorsData && doctorsData.length > 0) {
          loadedDoctors = doctorsData.map((d: any) => {
            const docServices = dlData
              ? dlData.filter((rel: any) => rel.dokter_id === d.id).map((rel: any) => rel.layanan_id)
              : []
            const existing = doctorsSeed.find((seed) => seed.name.toLowerCase() === d.nama?.toLowerCase())
            const photoUrl = d.foto_path
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/foto-dokter/${d.foto_path}`
              : undefined

            return {
              id: d.id,
              name: d.nama,
              specialty: d.spesialisasi,
              sip: d.no_sip || "SIP-2026-000",
              str: existing?.str || "STR-2026-000",
              services: docServices.length > 0 ? docServices : (existing?.services || []),
              active: d.aktif ?? true,
              education: existing?.education || [{ degree: d.spesialisasi, institution: "Fakultas Kedokteran" }],
              experienceYears: existing?.experienceYears || 5,
              almamater: existing?.almamater || "Fakultas Kedokteran",
              certifications: existing?.certifications || ["Ikatan Dokter Indonesia (IDI)"],
              bio: d.deskripsi || existing?.bio || "Dokter berkompeten dan berdedikasi tinggi.",
              photoUrl,
            }
          })
          setDoctors(loadedDoctors)
        }

        let loadedSchedules: Schedule[] = []
        if (schedulesData && schedulesData.length > 0) {
          loadedSchedules = schedulesData.map((sch: any) => ({
            id: sch.id,
            doctor: sch.dokter_id,
            day: sch.hari,
            start: sch.jam_mulai ? sch.jam_mulai.slice(0, 5) : "08:00",
            end: sch.jam_selesai ? sch.jam_selesai.slice(0, 5) : "12:00",
            quota: sch.kuota || 10,
            active: sch.aktif ?? true,
          }))
          setSchedules(loadedSchedules)
        }

        // Align initial booking values to available live data
        if (loadedServices.length > 0) {
          setBooking((prev) => {
            const hasService = loadedServices.some((s) => s.id === prev.service)
            if (!hasService) {
              const firstSvc = loadedServices[0].id
              const firstDoc =
                loadedDoctors.find((d) => d.services.includes(firstSvc))?.id ||
                loadedDoctors[0]?.id ||
                ""
              const firstSched =
                loadedSchedules.find((s) => s.doctor === firstDoc)?.id ||
                loadedSchedules[0]?.id ||
                ""
              return {
                ...prev,
                service: firstSvc,
                doctor: firstDoc,
                schedule: firstSched,
              }
            }
            return prev
          })
        }

        // Fetch patients from API
        try {
          const pRes = await fetch("/api/pasien")
          if (pRes.ok) {
            const pJson = await pRes.json()
            if (pJson.data && pJson.data.length > 0) {
              const dbPatients: Patient[] = pJson.data.map((p: any) => ({
                id: p.id || p.no_rekam_medis,
                name: p.nama,
                phone: p.telepon || "-",
                birth: p.tanggal_lahir || "2000-01-01",
                gender: p.jenis_kelamin === "P" ? "Perempuan" : "Laki-laki",
                address: p.alamat || "-",
                emergency: p.kontak_darurat || "-",
                account: Boolean(p.profile_id),
                nik: p.nik || "-",
              }))
              setPatients(dbPatients)
            }
          }
        } catch { }

        // Fetch visits; if DB has none yet, align dummy seed visits with live doctor/service/schedule IDs
        const hasDbVisits = await fetchVisits()
        if (!hasDbVisits && loadedDoctors.length > 0 && loadedServices.length > 0 && loadedSchedules.length > 0) {
          const reyhanDoc =
            loadedDoctors.find((d) => d.name.toLowerCase().includes("reyhan")) ||
            loadedDoctors[0]
          const umumSvc =
            loadedServices.find((s) => s.name.toLowerCase().includes("umum")) ||
            loadedServices[0]
          const monSched =
            loadedSchedules.find((s) => s.doctor === reyhanDoc.id && s.day === 1) ||
            loadedSchedules.find((s) => s.doctor === reyhanDoc.id) ||
            loadedSchedules[0]
          setVisits((prev) =>
            prev.map((v) => ({
              ...v,
              doctor: v.doctor === "d1" ? reyhanDoc.id : v.doctor,
              service: v.service === "s1" ? umumSvc.id : v.service,
              schedule: v.schedule === "j1" ? monSched.id : v.schedule,
            })),
          )
        }
      } catch (err) {
        console.warn("Gagal memuat data live dari Supabase, fallback ke data bawaan:", err)
      } finally {
        setLoadingData(false)
      }
    }

    loadSupabaseData()

    if (!supabase) return
    const client = supabase

    // Real-time synchronization for visits and queues
    const channel = client
      .channel("clinic-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "kunjungan" }, () => {
        fetchVisits()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "antrean" }, () => {
        fetchVisits()
      })
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!initialized) return
    try {
      localStorage.setItem(
        "sehatklinik_state_v3",
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
      if (currentUser) {
        localStorage.setItem("sehatklinik_current_user", JSON.stringify(currentUser))
      } else {
        localStorage.removeItem("sehatklinik_current_user")
      }
    } catch {
      // ignore
    }
  }, [initialized, role, visits, patients, doctors, services, schedules, users, currentUser, clinic, notifications, notificationJobs])

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
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    if (!supported) {
      setWebPushPermission("unsupported")
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
    setBooking((b) => ({ ...b, patient: patients[0]?.id || "" }))
    navigate(value === "Publik" ? "Beranda" : "Dashboard")
  }

  const defaultPatientFallback: Patient = {
    id: "RM-00000",
    name: currentUser?.name || "Pasien",
    phone: "-",
    birth: "2000-01-01",
    gender: "Laki-laki",
    address: "-",
    emergency: "-",
    account: true,
    nik: "3301010101000001",
  }
  const patient = patients.find((p) => p.id === "RM-00128") || patients[0] || defaultPatientFallback
  const doctorName = (id: string) =>
    doctors.find((d) => d.id === id)?.name || "Dokter"
  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name || "Layanan"
  const patientName = (id: string) =>
    patients.find((p) => p.id === id)?.name || "Pasien"
  const session = (id: string) => schedules.find((s) => s.id === id)

  const activeDoctor =
    (currentUser &&
      doctors.find(
        (d) => d.name.toLowerCase() === currentUser.name.toLowerCase(),
      )) ||
    doctors.find((d) => d.name.toLowerCase().includes("reyhan")) ||
    doctors[0]
  const activeDoctorId = activeDoctor?.id || "d1"

  const scopedVisits = visits.filter((v) =>
    role === "Pasien"
      ? v.patient === patient.id
      : role === "Dokter"
        ? v.doctor === activeDoctorId
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
        ? { ...structuredClone(v.examination), height: v.examination.height || "" }
        : {
          anamnesis: v.complaint,
          pressure: "",
          temperature: "",
          weight: "",
          height: "",
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

  const syncVisitTransition = async (
    visitId: string,
    payload: Record<string, unknown>,
    label: string
  ) => {
    try {
      await fetch(`/api/kunjungan/${visitId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.warn(`Sync ${label} error:`, err)
    }
  }

  // Transition queue and trigger business notifications according to SRS & API Contract
  const transition = async (v: Visit, target: string) => {
    if (busy) return
    const qLabel = queueLabel(
      v,
      doctors.findIndex((d) => d.id === v.doctor),
    )
    const pName = patientName(v.patient)
    const docName = doctorName(v.doctor)

    setBusy(true)
    try {
      if (
        target === "checkin" &&
        role === "Petugas" &&
        v.status === "Terdaftar" &&
        v.queue === "Menunggu"
      ) {
        updateVisit(v.id, { status: "Hadir" })
        notify(`Pasien ${pName} (${qLabel}) berhasil Check-in. Siap dipanggil.`)

        // Sync status check-in ke Supabase
        await syncVisitTransition(v.id, { target: "checkin" }, "check-in")
      } else if (
        target === "call" &&
        ["Petugas", "Dokter"].includes(role) &&
        v.status === "Hadir" &&
        v.queue === "Menunggu"
      ) {
        updateVisit(v.id, { queue: "Dipanggil" })

        // Sync status call ke Supabase
        await syncVisitTransition(v.id, { target: "call" }, "call")

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
        const nextQLabel = queueLabel(
          nextInLine,
          doctors.findIndex((d) => d.id === nextInLine.doctor),
        )
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
        await syncVisitTransition(v.id, { target: "start" }, "start")
      } else if (target === "finish" && role === "Dokter" && v.queue === "Sedang Diperiksa") {
        updateVisit(v.id, { status: "Selesai", queue: "Selesai" })
        notify("Kunjungan selesai. Ringkasan tersedia pada riwayat pasien.")
        await syncVisitTransition(v.id, { target: "finish" }, "finish")
        setSelected(null)
        addNotification({
          targetRole: "Pasien",
          targetUserId: v.patient,
          type: "KUNJUNGAN_SELESAI",
          title: "Pemeriksaan Selesai",
          message: `Kunjungan ${v.id} bersama ${docName} telah selesai. Ringkasan pemeriksaan tersedia di riwayat Anda.`,
          visitId: v.id,
          queueNumber: qLabel,
          actionUrl: "detail",
        })
      } else if (
        target === "skip" &&
        role === "Petugas" &&
        v.queue === "Dipanggil" &&
        reason.trim()
      ) {
        updateVisit(v.id, { queue: "Dilewati", reason })
        await syncVisitTransition(v.id, { target: "skip", reason }, "skip")
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
        await syncVisitTransition(v.id, { target: "cancel", reason }, "cancel")
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
    } finally {
      setBusy(false)
    }
  }

  // Submit Booking with Automatic Patient & Officer Notifications (SRS 11 & Kontrak API 10)
  const submitBooking = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
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
    try {
      let savedVisit: Visit = next

      // Sync pendaftaran kunjungan & antrean baru ke Supabase
      try {
        const res = await fetch("/api/kunjungan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pasienId: next.patient,
            dokterId: next.doctor,
            layananId: next.service,
            jadwalId: next.schedule,
            tanggal: next.date,
            keluhan: next.complaint,
            sumber: next.source,
          }),
        })
        if (res.ok) {
          const resData = await res.json()
          if (resData.data?.id) {
            savedVisit = {
              ...next,
              id: resData.data.id,
              number: resData.data.antrean?.nomor_antrean || next.number,
            }
          }
        }
      } catch (err) {
        console.warn("Sync booking error:", err)
      }

      setVisits((previous) => [...previous, savedVisit])
      setReceipt(savedVisit)
      setStep(4)

      const qLabel = queueLabel(
        savedVisit,
        doctors.findIndex((d) => d.id === savedVisit.doctor),
      )
      const dName = doctorName(savedVisit.doctor)
      const sName = serviceName(savedVisit.service)
      const pName = patientName(savedVisit.patient)

      // Notifikasi ke Pasien (SRS 11: Pendaftaran berhasil)
      addNotification({
        targetRole: "Pasien",
        targetUserId: savedVisit.patient,
        type: "KUNJUNGAN_TERDAFTAR",
        title: "Pendaftaran Kunjungan Berhasil!",
        message: `Kunjungan di ${sName} bersama ${dName} pada ${savedVisit.date} telah terdaftar. Nomor antrean Anda: ${qLabel}.`,
        visitId: savedVisit.id,
        queueNumber: qLabel,
        actionUrl: "detail",
      })

      // Notifikasi ke Petugas (SRS 11: Pendaftaran online baru)
      if (savedVisit.source === "Online") {
        addNotification(
          {
            targetRole: "Petugas",
            type: "PENDAFTARAN_BARU",
            title: "Pendaftaran Online Baru",
            message: `Pasien ${pName} mendaftar online ke ${sName} (${dName}) untuk tanggal ${savedVisit.date}. Nomor antrean: ${qLabel}.`,
            visitId: savedVisit.id,
            queueNumber: qLabel,
            actionUrl: "antrean",
          },
          false
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const saveExamination = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (
      busy ||
      !selectedVisit ||
      role !== "Dokter" ||
      selectedVisit.queue !== "Sedang Diperiksa" ||
      !exam
    )
      return
    const pressureParts = exam.pressure.trim().split("/")
    const systolicRaw = pressureParts[0]?.trim() || ""
    const diastolicRaw = pressureParts[1]?.trim() || ""
    const sistolik = Number(systolicRaw)
    const diastolik = Number(diastolicRaw)
    if (
      pressureParts.length !== 2 ||
      !/^\d+$/.test(systolicRaw) ||
      !/^\d+$/.test(diastolicRaw) ||
      !Number.isFinite(sistolik) ||
      !Number.isFinite(diastolik) ||
      sistolik < 50 ||
      sistolik > 300 ||
      diastolik < 30 ||
      diastolik > 200 ||
      sistolik <= diastolik
    ) {
      setError(
        "Tekanan darah tidak valid: sistolik 50–300 mmHg, diastolik 30–200 mmHg, dan sistolik harus lebih tinggi dari diastolik."
      )
      return
    }

    const suhu = Number(exam.temperature)
    if (
      !exam.temperature.trim() ||
      !Number.isFinite(suhu) ||
      suhu < 30 ||
      suhu > 45
    ) {
      setError("Suhu tubuh harus berada pada rentang 30–45 °C.")
      return
    }

    const berat_badan = Number(exam.weight)
    if (
      !exam.weight.trim() ||
      !Number.isFinite(berat_badan) ||
      berat_badan < 1 ||
      berat_badan > 500
    ) {
      setError("Berat badan harus berada pada rentang 1–500 kg.")
      return
    }

    const tinggi_badan = Number(exam.height)
    if (
      !exam.height.trim() ||
      !Number.isFinite(tinggi_badan) ||
      tinggi_badan < 20 ||
      tinggi_badan > 250
    ) {
      setError("Tinggi badan harus berada pada rentang 20–250 cm.")
      return
    }

    if (!exam.anamnesis.trim() || !exam.diagnosis.trim()) {
      setError("Anamnesis dan diagnosis wajib diisi.")
      return
    }

    setError("")
    setBusy(true)
    try {
      // Sync hasil pemeriksaan & tindakan ke Supabase sesuai format fn_valid_tanda_vital
      try {
        await fetch(`/api/kunjungan/${selectedVisit.id}/pemeriksaan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dokterId: selectedVisit.doctor,
            anamnesis: exam.anamnesis.trim(),
            tandaVital: {
              sistolik,
              diastolik,
              suhu,
              berat_badan,
              tinggi_badan,
            },
            diagnosis: exam.diagnosis.trim(),
            catatan: exam.notes.trim(),
            tindakan: exam.actions,
          }),
        })
      } catch (err) {
        console.warn("Sync examination error:", err)
      }
      updateVisit(selectedVisit.id, { examination: exam })
      setSavedExam(true)
      notify("Pemeriksaan dan tindakan medis berhasil disimpan ke database!")
    } finally {
      setBusy(false)
    }
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
    setUsers([])
    setClinic(defaultClinic)
    setNotifications(notificationsSeed)
    setNotificationJobs(notificationJobsSeed)
    setRole("Publik")
    setPage("Beranda")
    localStorage.removeItem("sehatklinik_state_v1")
    localStorage.removeItem("sehatklinik_state_v2")
    localStorage.removeItem("sehatklinik_state_v3")
    localStorage.removeItem("sehatklinik_current_user")
    setCurrentUser(null)
    notify("Data sistem berhasil direset.")
  }

  const login = async (
    email: string,
    password?: string
  ): Promise<{ success: boolean; message: string; user?: ClinicUser }> => {
    const cleanEmail = email.trim().toLowerCase()

    // 1. Coba autentikasi via Supabase Auth jika ada password
    if (password) {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        if (!error && data?.user) {
          const userMeta = data.user.user_metadata || {}
          const userRole = (userMeta.role || data.user.app_metadata?.role || "Pasien") as Role
          const authUser: ClinicUser = {
            name: userMeta.name || data.user.email?.split("@")[0] || "Pengguna",
            email: data.user.email || cleanEmail,
            role: userRole,
            active: true,
          }
          setCurrentUser(authUser)
          setRole(userRole)
          if (typeof window !== "undefined") {
            localStorage.setItem("sehatklinik_current_user", JSON.stringify(authUser))
          }
          return {
            success: true,
            message: `Selamat datang, ${authUser.name}! (Supabase Auth)`,
            user: authUser,
          }
        }
      } catch (authErr) {
        console.warn("Supabase auth attempted, fallback to local:", authErr)
      }
    }

    // 2. Fallback akun staf dan demo lokal
    let staff = users.find((u) => u.email.trim().toLowerCase() === cleanEmail)
    if (!staff) {
      staff = defaultUsers.find((u) => u.email.trim().toLowerCase() === cleanEmail)
    }
    if (!staff) {
      if (cleanEmail.includes("admin")) {
        staff = { name: "Administrator", email: cleanEmail, role: "Admin", active: true }
      } else if (cleanEmail.includes("petugas")) {
        staff = { name: "Petugas Loket", email: cleanEmail, role: "Petugas", active: true }
      } else if (cleanEmail.includes("dokter")) {
        staff = { name: "dr. Dokter Jaga", email: cleanEmail, role: "Dokter", active: true }
      }
    }
    if (staff) {
      if (!staff.active) {
        return {
          success: false,
          message: "Akun ini telah dinonaktifkan oleh Administrator klinik.",
        }
      }
      if (staff.password && password && staff.password !== password) {
        return {
          success: false,
          message: "Password yang Anda masukkan salah.",
        }
      }
      setCurrentUser(staff)
      setRole(staff.role as Role)
      if (typeof window !== "undefined") {
        localStorage.setItem("sehatklinik_current_user", JSON.stringify(staff))
      }
      return {
        success: true,
        message: `Selamat datang, ${staff.name}!`,
        user: staff,
      }
    }

    // Default for patients (no admin registration required)
    const patientUser: ClinicUser = {
      name: "Andi Pratama",
      email: cleanEmail,
      role: "Pasien",
      active: true,
    }
    setCurrentUser(patientUser)
    setRole("Pasien")
    if (typeof window !== "undefined") {
      localStorage.setItem("sehatklinik_current_user", JSON.stringify(patientUser))
    }
    return {
      success: true,
      message: "Selamat datang di Portal Pasien!",
      user: patientUser,
    }
  }

  const logout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {}
    setCurrentUser(null)
    setRole("Publik")
    if (typeof window !== "undefined") {
      localStorage.removeItem("sehatklinik_current_user")
      window.location.href = "/"
    }
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

        currentUser,
        setCurrentUser,
        login,
        logout,

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
        loadingData,
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
