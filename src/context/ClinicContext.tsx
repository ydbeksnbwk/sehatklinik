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
  remaining,
  type Role,
  type Visit,
  type Patient,
  type Doctor,
  type Service,
  type Schedule,
  type Examination,
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
  name: "Klinik Sehat Sentosa",
  description: "Pelayanan kesehatan untuk seluruh keluarga.",
  address: "Jl. Melati No. 18, Jakarta Selatan",
  phone: "021-555-0123",
  latitude: "-6.2615",
  longitude: "106.8106",
  hours: "Senin – Sabtu, 08.00 – 20.00 WIB",
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
        if (data.clinic) setClinic(data.clinic)
        if (typeof window !== "undefined") {
          const path = window.location.pathname
          if (path === "/admin") setRole("Admin")
          else if (path === "/petugas") setRole("Petugas")
          else if (path === "/dokter-dashboard") setRole("Dokter")
          else if (path === "/pasien") setRole("Pasien")
          else if (path === "/dashboard") {
            setRole(data.role && data.role !== "Publik" ? data.role : "Pasien")
          } else if (
            ["/layanan", "/dokter", "/jadwal", "/lokasi", "/login", "/daftar"].includes(path)
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
        })
      )
    } catch {
      // ignore
    }
  }, [initialized, role, visits, patients, doctors, services, schedules, users, clinic])

  // Dialog ESC listener
  useEffect(() => {
    if (!selected && !editor) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null)
        setEditor(null)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [selected, editor])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 4500)
  }

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

  const transition = (v: Visit, target: string) => {
    if (
      target === "checkin" &&
      role === "Petugas" &&
      v.status === "Terdaftar" &&
      v.queue === "Menunggu"
    )
      updateVisit(v.id, { status: "Hadir" })
    else if (
      target === "call" &&
      ["Petugas", "Dokter"].includes(role) &&
      v.status === "Hadir" &&
      v.queue === "Menunggu"
    )
      updateVisit(v.id, { queue: "Dipanggil" })
    else if (target === "start" && role === "Dokter" && v.queue === "Dipanggil")
      updateVisit(v.id, { queue: "Sedang Diperiksa" })
    else if (
      target === "skip" &&
      role === "Petugas" &&
      v.queue === "Dipanggil" &&
      reason.trim()
    )
      updateVisit(v.id, { queue: "Dilewati", reason })
    else if (
      target === "cancel" &&
      ((role === "Pasien" && v.queue === "Menunggu") ||
        (role === "Petugas" && ["Menunggu", "Dipanggil"].includes(v.queue))) &&
      reason.trim()
    )
      updateVisit(v.id, { queue: "Dibatalkan", status: "Dibatalkan", reason })
    else {
      setError(
        "Tindakan tidak tersedia. Periksa status kunjungan dan isi alasan bila diperlukan."
      )
      return
    }
    notify("Status kunjungan berhasil diperbarui dalam simulasi.")
    setError("")
  }

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
