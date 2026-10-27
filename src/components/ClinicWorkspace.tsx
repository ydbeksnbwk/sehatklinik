"use client"

import {
  useEffect,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react"
import { useClinic } from "../context/ClinicContext"
import PublicSite from "./PublicSite"
import BrandArtwork from "./BrandArtwork"
import {
  DEMO_DATE,
  doctorsSeed,
  patientsSeed,
  schedulesSeed,
  servicesSeed,
  visitsSeed,
  remaining,
  dateLabel,
  queueLabel,
  type Role,
  type Visit,
  type Patient,
  type Examination,
} from "../clinic-data"

type IconType = ComponentType<{
  name: string
  size?: number
}>
const menus: Record<Exclude<Role, "Publik">, [string, string][]> = {
  Admin: [
    ["Dashboard", "grid"],
    ["Data Dokter", "users"],
    ["Data Layanan", "heart"],
    ["Jadwal Praktik", "calendar"],
    ["Manajemen Pengguna", "users"],
    ["Profil Klinik", "clinic"],
    ["Rekap Kunjungan", "chart"],
  ],
  Petugas: [
    ["Dashboard", "grid"],
    ["Antrean Hari Ini", "clock"],
    ["Pendaftaran Walk-in", "plus"],
    ["Data Pasien", "users"],
  ],
  Dokter: [
    ["Dashboard", "grid"],
    ["Antrean Saya", "clock"],
    ["Riwayat Pasien", "file"],
  ],
  Pasien: [
    ["Dashboard", "grid"],
    ["Pendaftaran Kunjungan", "plus"],
    ["Antrean Saya", "clock"],
    ["Riwayat Kunjungan", "file"],
    ["Profil Saya", "users"],
  ],
}
const queueStates = [
  "Menunggu",
  "Dipanggil",
  "Sedang Diperiksa",
  "Selesai",
  "Dilewati",
  "Dibatalkan",
]
function Badge({ text }: { text: string }) {
  return (
    <span
      className={`badge ${
        ["Selesai", "Aktif", "Hadir"].includes(text)
          ? "green"
          : ["Dibatalkan", "Nonaktif"].includes(text)
            ? "red"
            : ["Menunggu", "Terdaftar", "Dilewati"].includes(text)
              ? "orange"
              : "blue"
      }`}
    >
      <i />
      {text}
    </span>
  )
}
type FieldProps = {
  label: string
  children: ReactNode
}
function Field({ label, children }: FieldProps) {
  return (
    <label>
      {label}
      {children}
    </label>
  )
}

type Props = {
  Icon: IconType
  initialPage?: string
  initialRole?: Role
}

export default function ClinicWorkspace({
  Icon,
  initialPage,
  initialRole,
}: Props) {
  const clinicContext = useClinic()
  const {
    role,
    setRole,
    page,
    setPage,
    visits,
    setVisits,
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
  } = clinicContext

  useEffect(() => {
    if (initialRole && role !== initialRole) {
      setRole(initialRole)
    }
    if (initialPage && page !== initialPage) {
      setPage(initialPage)
    }
  }, [initialRole, initialPage])

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      if (path === "/") {
        setRole("Publik")
        setPage("Beranda")
      } else if (path === "/layanan") {
        setRole("Publik")
        setPage("Layanan")
      } else if (path === "/dokter") {
        setRole("Publik")
        setPage("Dokter")
      } else if (path === "/jadwal") {
        setRole("Publik")
        setPage("Jadwal")
      } else if (path === "/lokasi") {
        setRole("Publik")
        setPage("Lokasi")
      } else if (path === "/login") {
        setRole("Publik")
        setPage("Login")
      } else if (path === "/daftar") {
        setRole("Publik")
        setPage("Daftar")
      } else if (path === "/admin") {
        setRole("Admin")
        setPage("Dashboard")
      } else if (path === "/petugas") {
        setRole("Petugas")
        setPage("Dashboard")
      } else if (path === "/dokter-dashboard") {
        setRole("Dokter")
        setPage("Dashboard")
      } else if (path === "/pasien") {
        setRole("Pasien")
        setPage("Dashboard")
      } else if (path.startsWith("/dashboard")) {
        const params = new URLSearchParams(window.location.search)
        const tab = params.get("tab")
        if (tab) setPage(tab)
        else setPage("Dashboard")
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [setRole, setPage])
  useEffect(() => {
    if (!selected && !editor) return
    const previousFocus = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      )
    focusable()[0]?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null)
        setEditor(null)
      }
      if (event.key !== "Tab") return
      const elements = focusable()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("keydown", handleKey)
      previousFocus?.focus()
    }
  }, [selected, editor])
  const patient = patients.find((p) => p.id === "RM-00128")!
  const doctorName = (id: string) =>
    doctors.find((d) => d.id === id)?.name || "Dokter"
  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name || "Layanan"
  const patientName = (id: string) =>
    patients.find((p) => p.id === id)?.name || "Pasien"
  const session = (id: string) => schedules.find((s) => s.id === id)
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
      const routeMap: Record<string, string> = {
        Beranda: "/",
        Layanan: "/layanan",
        Dokter: "/dokter",
        Jadwal: "/jadwal",
        Lokasi: "/lokasi",
        Login: "/login",
        Daftar: "/daftar",
        Dashboard: "/dashboard",
      }
      const path =
        routeMap[target] || `/dashboard?tab=${encodeURIComponent(target)}`
      if (window.location.pathname !== path) {
        window.history.pushState(null, "", path)
      }
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }
  const switchRole = (value: string) => {
    setRole(value as Role)
    setSelected(null)
    setEditor(null)
    setBooking((b) => ({ ...b, patient: "RM-00128" }))
    if (typeof window !== "undefined") {
      const nextPath = value === "Publik" ? "/" : "/dashboard"
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath)
      }
    }
    navigate(value === "Publik" ? "Beranda" : "Dashboard")
  }
  const scoped = visits.filter((v) =>
    role === "Pasien"
      ? v.patient === patient.id
      : role === "Dokter"
        ? v.doctor === "d1"
        : true,
  )
  const today = scoped.filter((v) => v.date === DEMO_DATE)
  const active = scoped.filter(
    (v) => !["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
  )
  const detail = scoped.find((v) => v.id === selected)
  const canMedical = role === "Dokter" || role === "Pasien"
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
          },
    )
  }
  const updateVisit = (id: string, changes: Partial<Visit>) =>
    setVisits((previous) =>
      previous.map((v) => (v.id === id ? { ...v, ...changes } : v)),
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
        "Tindakan tidak tersedia. Periksa status kunjungan dan isi alasan bila diperlukan.",
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
    const schedule = session(booking.schedule)
    if (
      !schedule ||
      !schedule.active ||
      schedule.doctor !== booking.doctor ||
      new Date(`${booking.date}T12:00:00`).getDay() !== schedule.day
    ) {
      setError("Pilih sesi aktif yang sesuai hari kunjungan.")
      return
    }
    if (
      visits.some(
        (v) =>
          v.patient === booking.patient &&
          v.schedule === schedule.id &&
          v.date === booking.date &&
          v.status !== "Dibatalkan",
      )
    ) {
      setError(
        "Pasien sudah memiliki kunjungan aktif pada dokter, sesi, dan tanggal ini.",
      )
      return
    }
    if (!remaining(schedule, booking.date, visits)) {
      setError("Kuota sesi sudah penuh. Silakan pilih sesi lain.")
      return
    }
    const number =
      Math.max(
        0,
        ...visits
          .filter((v) => v.doctor === booking.doctor && v.date === booking.date)
          .map((v) => v.number),
      ) + 1
    const next: Visit = {
      id: `KJ-${booking.date.replace(/-/g, "")}-${String(visits.length + 1).padStart(3, "0")}`,
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
      !detail ||
      role !== "Dokter" ||
      detail.queue !== "Sedang Diperiksa" ||
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
        "Tekanan darah di luar rentang simulasi: sistolik 60–250, diastolik 30–150, dan sistolik harus lebih tinggi.",
      )
      return
    }
    setError("")
    updateVisit(detail.id, { examination: exam })
    setSavedExam(true)
    notify("Pemeriksaan tersimpan dalam simulasi.")
  }
  const showError = error && (
    <div className="ws-error" role="alert">
      <Icon name="help" size={18} />
      {error}
    </div>
  )
  const showEditor = (type: string, id?: string) => {
    setEditor({ type, id })
    setError("")
  }
  const statCards = (
    items: {
      title: string
      value: number
      icon: string
      sub: string
      color: string
    }[],
  ) => (
    <div className="stats">
      {items.map((s) => (
        <section className="stat" key={s.title}>
          <div className="stat-top">
            <span>{s.title}</span>
            <span className={`icon-tile ${s.color}`}>
              <Icon name={s.icon} />
            </span>
          </div>
          <div className="stat-value">
            {s.value.toString().padStart(2, "0")}
          </div>
          <div className="stat-bottom">{s.sub}</div>
        </section>
      ))}
    </div>
  )
  const statScope =
    role === "Admin"
      ? page === "Rekap Kunjungan"
        ? scoped.filter(
            (v) =>
              v.date >= range.from &&
              v.date <= range.to &&
              (!filter || v.queue === filter) &&
              (!doctorFilter || v.doctor === doctorFilter) &&
              (!serviceFilter || v.service === serviceFilter) &&
              `${patientName(v.patient)} ${v.patient} ${v.id}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
        : scoped
      : today
  const stats = statCards([
    {
      title: role === "Admin" ? "Total kunjungan" : "Kunjungan hari ini",
      value: statScope.length,
      icon: "calendar",
      sub:
        role === "Admin"
          ? page === "Rekap Kunjungan"
            ? "Sesuai periode dan filter terpilih"
            : "Seluruh periode data simulasi"
          : "Senin, 26 Oktober 2026",
      color: "blue",
    },
    {
      title: "Menunggu",
      value: statScope.filter((v) => v.queue === "Menunggu").length,
      icon: "clock",
      sub: "Terdaftar dan sudah hadir",
      color: "amber",
    },
    {
      title: "Selesai",
      value: statScope.filter((v) => v.queue === "Selesai").length,
      icon: "check",
      sub: "Kunjungan telah diselesaikan",
      color: "green",
    },
    {
      title: "Dibatalkan",
      value: statScope.filter((v) => v.status === "Dibatalkan").length,
      icon: "close",
      sub: "Tidak mengurangi sisa kuota",
      color: "red",
    },
  ])
  const visitTable = (items: Visit[], title: string, report = false) => {
    const filtered = items.filter(
      (v) =>
        `${patientName(v.patient)} ${v.patient} ${v.id}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!filter || v.queue === filter) &&
        (!doctorFilter || v.doctor === doctorFilter) &&
        (!serviceFilter || v.service === serviceFilter) &&
        (!report || (v.date >= range.from && v.date <= range.to)),
    )
    const maxPage = Math.max(1, Math.ceil(filtered.length / 6))
    const current = Math.min(pagination, maxPage)
    return (
      <section className="panel queue-panel">
        <div className="panel-heading">
          <div>
            <h3>
              {title}
              <span className="count">{filtered.length} kunjungan</span>
            </h3>
            <p>
              {role === "Admin"
                ? "Data administratif saja. Isi pemeriksaan tidak ditampilkan."
                : "Status kunjungan dan antrean ditampilkan secara terpisah."}
            </p>
          </div>
          <Icon name="file" size={18} />
        </div>
        {report && (
          <div className="ws-report-range">
            <Field label="Dari tanggal">
              <input
                type="date"
                value={range.from}
                onChange={(e) => {
                  setRange({ ...range, from: e.target.value })
                  setPagination(1)
                }}
              />
            </Field>
            <Field label="Sampai tanggal">
              <input
                type="date"
                min={range.from}
                value={range.to}
                onChange={(e) => {
                  setRange({ ...range, to: e.target.value })
                  setPagination(1)
                }}
              />
            </Field>
            <div>
              <b>{filtered.length}</b>
              <small>kunjungan pada periode terpilih</small>
            </div>
          </div>
        )}
        <div className="table-tools">
          <div className="search">
            <Icon name="search" size={17} />
            <input
              aria-label="Cari kunjungan"
              placeholder="Cari nama, no. RM, atau referensi…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination(1)
              }}
            />
          </div>
          <div className="filters">
            {role !== "Dokter" && (
              <select
                aria-label="Filter dokter"
                value={doctorFilter}
                onChange={(e) => {
                  setDoctorFilter(e.target.value)
                  setPagination(1)
                }}
              >
                <option value="">Semua dokter</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Filter layanan"
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value)
                setPagination(1)
              }}
            >
              <option value="">Semua layanan</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter status antrean"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setPagination(1)
              }}
            >
              <option value="">Semua status</option>
              {queueStates.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Antrean / Referensi",
                  "Pasien",
                  "Dokter & layanan",
                  "Tanggal / Sumber",
                  "Kunjungan",
                  "Antrean",
                  "Detail",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 6, current * 6).map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="queue-number">{queueLabel(v)}</span>
                    <small>{v.id}</small>
                  </td>
                  <td>
                    <div className="person">
                      <span className="avatar blue">
                        {patientName(v.patient)
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <div>
                        <b>{patientName(v.patient)}</b>
                        <small>{v.patient}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <b>{doctorName(v.doctor)}</b>
                    <small>{serviceName(v.service)}</small>
                  </td>
                  <td>
                    {dateLabel(v.date)}
                    <small>{v.source}</small>
                  </td>
                  <td>
                    <Badge text={v.status} />
                  </td>
                  <td>
                    <Badge text={v.queue} />
                  </td>
                  <td>
                    <button
                      className="square"
                      aria-label={`Detail ${v.id}`}
                      onClick={() => openVisit(v)}
                    >
                      <Icon name="arrow" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <Icon name="search" size={30} />
              <h3>Belum ada kunjungan yang cocok</h3>
              <p>Ubah pencarian atau filter untuk melihat data lainnya.</p>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length
              ? `${(current - 1) * 6 + 1}–${Math.min(current * 6, filtered.length)}`
              : "0"}{" "}
            dari {filtered.length} kunjungan
          </span>
          <div>
            <button
              aria-label="Halaman sebelumnya"
              disabled={current === 1}
              onClick={() => setPagination(current - 1)}
            >
              ‹
            </button>
            {Array.from({ length: maxPage }, (_, i) => (
              <button
                key={i}
                className={current === i + 1 ? "active" : ""}
                onClick={() => setPagination(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              aria-label="Halaman berikutnya"
              disabled={current === maxPage}
              onClick={() => setPagination(current + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </section>
    )
  }
  const schedulePanel = (
    <section className="panel ws-sessions">
      <div className="panel-heading">
        <div>
          <h3>Jadwal & ketersediaan</h3>
          <p>Senin, 26 Oktober 2026 · Kuota per sesi</p>
        </div>
        <Icon name="calendar" size={19} />
      </div>
      {schedules
        .filter((s) => role !== "Dokter" || s.doctor === "d1")
        .map((s) => {
          const left = remaining(s, DEMO_DATE, visits)
          return (
            <div className="ws-session" key={s.id}>
              <span className="avatar blue">
                {doctorName(s.doctor)
                  .split(" ")
                  .slice(1, 3)
                  .map((n) => n[0])
                  .join("")}
              </span>
              <div>
                <b>{doctorName(s.doctor)}</b>
                <small>
                  {s.start} – {s.end}
                </small>
                <div className="ws-quota-track">
                  <span
                    style={{ width: `${((s.quota - left) / s.quota) * 100}%` }}
                  />
                </div>
              </div>
              <span className={left ? "ws-quota" : "ws-quota full"}>
                {left ? `${left}/${s.quota} tersisa` : "Penuh"}
              </span>
            </div>
          )
        })}
    </section>
  )
  const workflow = (
    <section className="panel ws-workflow">
      <div className="panel-heading">
        <div>
          <h3>Alur pelayanan klinik</h3>
          <p>Kunjungan tertib, informasi tetap terjaga.</p>
        </div>
      </div>
      <div className="ws-workflow-steps">
        {[
          ["Terdaftar", "Nomor antrean terbit", "calendar"],
          ["Hadir", "Check-in oleh petugas", "users"],
          ["Dipanggil", "Pasien menuju ruang", "bell"],
          ["Diperiksa", "Hanya oleh dokter", "heart"],
          ["Selesai", "Ringkasan untuk pasien", "check"],
        ].map((s, i) => (
          <div key={s[0]}>
            <span>
              <Icon name={s[2]} size={18} />
            </span>
            <b>{s[0]}</b>
            <small>{s[1]}</small>
            {i < 4 && <Icon name="arrow" size={14} />}
          </div>
        ))}
      </div>
    </section>
  )
  const patientCard = (v: Visit) => (
    <section className="panel ws-ticket" key={v.id}>
      <div className="panel-heading">
        <div>
          <h3>Nomor antrean Anda</h3>
          <p>{v.id}</p>
        </div>
        <Badge text={v.queue} />
      </div>
      <div className="ticket">{queueLabel(v)}</div>
      <div className="confirmation">
        <h3>{doctorName(v.doctor)}</h3>
        <p>
          {serviceName(v.service)} · {dateLabel(v.date)}
        </p>
        <p>
          {session(v.schedule)?.start} – {session(v.schedule)?.end} WIB
        </p>
        <div className="ws-ticket-meta">
          <span>
            Kunjungan <Badge text={v.status} />
          </span>
          <span>
            Pendaftaran <b>{v.source}</b>
          </span>
        </div>
        <div className="notice">
          <Icon name="clock" size={19} />
          {v.status === "Terdaftar"
            ? "Lakukan check-in di loket sebelum antrean dapat dipanggil."
            : v.queue === "Dipanggil"
              ? "Anda dipanggil. Silakan menuju ruang pemeriksaan."
              : v.queue === "Sedang Diperiksa"
                ? "Pemeriksaan Anda sedang berlangsung."
                : "Anda sudah check-in. Silakan menunggu panggilan."}
        </div>
        <ol className="patient-queue-progress" aria-label="Tahapan antrean">
          {["Terdaftar", "Check-in", "Dipanggil", "Diperiksa", "Selesai"].map(
            (label, index) => {
              const current =
                v.queue === "Sedang Diperiksa"
                  ? 3
                  : v.queue === "Dipanggil"
                    ? 2
                    : v.status === "Hadir"
                      ? 1
                      : 0
              return (
                <li
                  key={label}
                  className={
                    index < current
                      ? "complete"
                      : index === current
                        ? "current"
                        : ""
                  }
                  aria-current={index === current ? "step" : undefined}
                >
                  <span>
                    {index < current ? (
                      <Icon name="check" size={15} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <small>{label}</small>
                </li>
              )
            },
          )}
        </ol>
        <button className="primary" onClick={() => openVisit(v)}>
          Lihat Detail Kunjungan
          <Icon name="arrow" size={16} />
        </button>
        {v.queue === "Menunggu" && (
          <button className="danger-link" onClick={() => openVisit(v)}>
            Batalkan kunjungan
          </button>
        )}
      </div>
    </section>
  )
  const patientDashboard = (
    <>
      <div className="patient-welcome">
        <div>
          <span className="eyebrow">RUANG SEHAT ANDA</span>
          <h2>Lebih mudah merawat diri.</h2>
          <p>
            Daftar kunjungan, pantau antrean, dan baca riwayat Anda di satu
            tempat.
          </p>
          <button
            className="primary"
            onClick={() => navigate("Pendaftaran Kunjungan")}
          >
            <Icon name="plus" size={17} />
            Daftar Kunjungan
          </button>
        </div>
        <Icon name="heart" size={115} />
      </div>
      {statCards([
        {
          title: "Seluruh kunjungan",
          value: scoped.length,
          icon: "calendar",
          sub: "Riwayat pelayanan Anda",
          color: "blue",
        },
        {
          title: "Kunjungan aktif",
          value: active.length,
          icon: "clock",
          sub: "Terdaftar atau sedang dilayani",
          color: "amber",
        },
        {
          title: "Kunjungan selesai",
          value: scoped.filter((v) => v.queue === "Selesai").length,
          icon: "check",
          sub: "Ringkasan tersedia di riwayat",
          color: "green",
        },
        {
          title: "Dibatalkan",
          value: scoped.filter((v) => v.queue === "Dibatalkan").length,
          icon: "close",
          sub: "Kunjungan yang dibatalkan",
          color: "red",
        },
      ])}
      <div className="patient-overview-grid">
        <section className="panel patient-next-visit">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RENCANA PERAWATAN</span>
              <h3>Kunjungan berikutnya</h3>
            </div>
            <Icon name="calendar" size={21} />
          </div>
          {active.length ? (
            (() => {
              const next = [...active].sort(
                (a, b) => a.date.localeCompare(b.date) || a.number - b.number,
              )[0]
              return (
                <div className="patient-panel-body">
                  <div className="patient-appointment-date">
                    <Icon name="calendar" size={22} />
                    <div>
                      <b>{dateLabel(next.date)}</b>
                      <small>
                        {session(next.schedule)?.start} –{" "}
                        {session(next.schedule)?.end} WIB
                      </small>
                    </div>
                    <Badge text={next.queue} />
                  </div>
                  <h2>{doctorName(next.doctor)}</h2>
                  <p className="muted">
                    {serviceName(next.service)} · {next.id}
                  </p>
                  <div className="notice">
                    <Icon name="help" size={19} />
                    {next.status === "Terdaftar"
                      ? "Kunjungan sudah terdaftar. Lakukan check-in di loket saat tiba di klinik."
                      : "Buka Antrean Saya untuk melihat tahapan pelayanan dan detail tiket Anda."}
                  </div>
                  <button
                    className="primary"
                    onClick={() => navigate("Antrean Saya")}
                  >
                    Pantau Antrean
                    <Icon name="arrow" size={17} />
                  </button>
                </div>
              )
            })()
          ) : (
            <div className="empty">
              <Icon name="calendar" size={30} />
              <h3>Belum ada kunjungan aktif</h3>
              <p>Atur waktu perawatan Anda melalui pendaftaran kunjungan.</p>
              <button
                className="primary"
                onClick={() => navigate("Pendaftaran Kunjungan")}
              >
                Daftar Kunjungan
              </button>
            </div>
          )}
        </section>
        <section className="panel patient-shortcuts">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">DALAM SATU RUANG</span>
              <h3>Akses cepat</h3>
            </div>
          </div>
          <div className="patient-panel-body">
            {[
              [
                "Pendaftaran Kunjungan",
                "calendar",
                "Daftar kunjungan",
                "Pilih layanan, dokter, dan sesi.",
              ],
              [
                "Antrean Saya",
                "clock",
                "Pantau antrean",
                "Lihat tiket dan tahapan pelayanan.",
              ],
              [
                "Profil Saya",
                "users",
                "Profil pribadi",
                "Lihat data diri dan kontak Anda.",
              ],
            ].map(([target, icon, label, description]) => (
              <button
                className="patient-shortcut"
                key={target}
                onClick={() => navigate(target)}
              >
                <span className="icon-tile blue">
                  <Icon name={icon} size={19} />
                </span>
                <span>
                  <b>{label}</b>
                  <small>{description}</small>
                </span>
                <Icon name="arrow" size={17} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="panel patient-recent-visits">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PERJALANAN SEHAT ANDA</span>
            <h3>Riwayat terakhir</h3>
          </div>
          <button
            className="text-button"
            onClick={() => navigate("Riwayat Kunjungan")}
          >
            Semua riwayat
            <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="patient-panel-body">
          {scoped.some((v) =>
            ["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
          ) ? (
            [...scoped]
              .filter((v) =>
                ["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
              )
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 3)
              .map((v) => (
                <button
                  className="patient-history-row"
                  key={v.id}
                  onClick={() => openVisit(v)}
                >
                  <span className="icon-tile blue">
                    <Icon name="file" size={19} />
                  </span>
                  <span>
                    <b>{serviceName(v.service)}</b>
                    <small>
                      {doctorName(v.doctor)} · {dateLabel(v.date)}
                    </small>
                  </span>
                  <Badge text={v.queue} />
                  <Icon name="arrow" size={17} />
                </button>
              ))
          ) : (
            <p className="muted">
              Riwayat akan tampil setelah Anda menjalani kunjungan.
            </p>
          )}
        </div>
      </section>
    </>
  )
  const patientQueue = (
    <div className="patient-queue-layout">
      <div className="patient-queue-tickets">
        {active.length ? (
          active.map(patientCard)
        ) : (
          <section className="panel empty">
            <Icon name="clock" size={34} />
            <h3>Tidak ada antrean aktif</h3>
            <p>
              Kunjungan yang selesai atau dibatalkan tersedia pada Riwayat
              Kunjungan.
            </p>
            <button
              className="primary"
              onClick={() => navigate("Pendaftaran Kunjungan")}
            >
              Daftar Kunjungan
            </button>
          </section>
        )}
      </div>
      <aside className="patient-queue-sidebar">
        <section className="panel patient-queue-guide">
          <span className="icon-tile blue">
            <Icon name="clock" size={23} />
          </span>
          <span className="eyebrow">PANDUAN ANTREAN</span>
          <h3>
            Datang lebih tenang,
            <br />
            ikuti setiap tahapnya.
          </h3>
          <ol>
            <li>
              <b>Tunjukkan bukti pendaftaran</b>
              <p>Bawa nomor referensi dan identitas Anda ke loket.</p>
            </li>
            <li>
              <b>Lakukan check-in</b>
              <p>
                Antrean baru dapat dipanggil setelah kehadiran dikonfirmasi
                petugas.
              </p>
            </li>
            <li>
              <b>Tunggu panggilan dokter</b>
              <p>Saat status Dipanggil, silakan menuju ruang pemeriksaan.</p>
            </li>
          </ol>
          <div className="notice">
            <Icon name="help" size={18} />
            Nomor antrean berlaku per dokter dan tanggal. Nomor berbeda dokter
            tidak dapat dibandingkan.
          </div>
          <p className="patient-queue-footnote">
            Pembatalan hanya tersedia sebelum dipanggil. Perubahan status
            mengikuti data simulasi pada sesi ini.
          </p>
        </section>
      </aside>
    </div>
  )
  const registration = (
    <div className="ws-booking-grid">
      <section className="panel form-panel">
        <div className="steps">
          {["Layanan & dokter", "Tanggal & sesi", "Konfirmasi"].map((s, i) => (
            <span key={s} className={step >= i + 1 ? "current" : ""}>
              <b>{i + 1}</b>
              {s}
            </span>
          ))}
        </div>
        {receipt ? (
          <div className="confirmation">
            <span className="success-icon">
              <Icon name="check" size={42} />
            </span>
            <h2>Pendaftaran berhasil</h2>
            <p>{receipt.id}</p>
            <div className="ticket">{queueLabel(receipt)}</div>
            <h3>{patientName(receipt.patient)}</h3>
            <p>
              {doctorName(receipt.doctor)} · {serviceName(receipt.service)}
            </p>
            <p>
              {dateLabel(receipt.date)} · {session(receipt.schedule)?.start} –{" "}
              {session(receipt.schedule)?.end}
            </p>
            <div className="component-row ws-center">
              <Badge text={receipt.status} />
              <Badge text={receipt.queue} />
            </div>
            <p>
              Simpan nomor referensi ini dan lakukan check-in saat tiba di
              klinik.
            </p>
            <button
              className="primary"
              onClick={() =>
                navigate(
                  role === "Petugas" ? "Antrean Hari Ini" : "Antrean Saya",
                )
              }
            >
              Lihat Antrean
              <Icon name="arrow" size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={submitBooking}>
            <span className="eyebrow">LANGKAH {step} DARI 3</span>
            <h3>
              {step === 1
                ? "Pilih perawatan yang Anda butuhkan"
                : step === 2
                  ? "Temukan waktu yang sesuai"
                  : "Periksa kembali kunjungan Anda"}
            </h3>
            <p className="muted">
              {role === "Petugas"
                ? "Pendaftaran walk-in menggunakan data pasien, tanpa memerlukan akun."
                : "Nomor antrean dibuat otomatis per dokter dan tanggal."}
            </p>
            {step === 1 ? (
              <>
                {role === "Petugas" && (
                  <>
                    <Field label="Pasien">
                      <select
                        value={booking.patient}
                        onChange={(e) =>
                          setBooking({ ...booking, patient: e.target.value })
                        }
                      >
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.id}
                            {!p.account ? " · Tanpa akun" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => showEditor("Pasien")}
                    >
                      + Catat pasien baru tanpa akun
                    </button>
                  </>
                )}
                <Field label="Layanan">
                  <select
                    value={booking.service}
                    onChange={(e) => {
                      const doctor = doctors.find(
                        (d) => d.active && d.services.includes(e.target.value),
                      )
                      setBooking({
                        ...booking,
                        service: e.target.value,
                        doctor: doctor?.id || "",
                        schedule: "",
                      })
                    }}
                  >
                    {services
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.duration} menit
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Dokter">
                  <select
                    required
                    value={booking.doctor}
                    onChange={(e) =>
                      setBooking({
                        ...booking,
                        doctor: e.target.value,
                        schedule: "",
                      })
                    }
                  >
                    <option value="">Pilih dokter</option>
                    {doctors
                      .filter(
                        (d) => d.active && d.services.includes(booking.service),
                      )
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Keluhan utama">
                  <textarea
                    required
                    maxLength={1000}
                    placeholder="Ceritakan keluhan dan sejak kapan dirasakan…"
                    value={booking.complaint}
                    onChange={(e) =>
                      setBooking({ ...booking, complaint: e.target.value })
                    }
                  />
                </Field>
              </>
            ) : step === 2 ? (
              <>
                <Field label="Tanggal kunjungan">
                  <input
                    type="date"
                    required
                    min={DEMO_DATE}
                    value={booking.date}
                    onChange={(e) =>
                      setBooking({
                        ...booking,
                        date: e.target.value,
                        schedule: "",
                      })
                    }
                  />
                </Field>
                <Field label="Sesi praktik">
                  <select
                    required
                    value={booking.schedule}
                    onChange={(e) =>
                      setBooking({ ...booking, schedule: e.target.value })
                    }
                  >
                    <option value="">Pilih sesi praktik</option>
                    {schedules
                      .filter(
                        (s) =>
                          s.active &&
                          s.doctor === booking.doctor &&
                          s.day ===
                            new Date(`${booking.date}T12:00:00`).getDay(),
                      )
                      .map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={remaining(s, booking.date, visits) === 0}
                        >
                          {s.start} – {s.end} ·{" "}
                          {remaining(s, booking.date, visits)
                            ? `${remaining(s, booking.date, visits)} dari ${s.quota} kuota tersisa`
                            : "Penuh"}
                        </option>
                      ))}
                  </select>
                </Field>
                {!schedules.some(
                  (s) =>
                    s.active &&
                    s.doctor === booking.doctor &&
                    s.day === new Date(`${booking.date}T12:00:00`).getDay(),
                ) && (
                  <div className="notice">
                    Tidak ada sesi pada tanggal ini. Jadwal demo tersedia setiap
                    Senin.
                  </div>
                )}
                <div className="notice">
                  <Icon name="clock" />
                  Kuota penuh tidak dapat dipilih. Jadwal penuh dokter lain juga
                  ditampilkan pada panel ketersediaan.
                </div>
              </>
            ) : (
              <div className="ws-summary">
                <div>
                  <span>Pasien</span>
                  <b>{patientName(booking.patient)}</b>
                </div>
                <div>
                  <span>Layanan</span>
                  <b>{serviceName(booking.service)}</b>
                </div>
                <div>
                  <span>Dokter</span>
                  <b>{doctorName(booking.doctor)}</b>
                </div>
                <div>
                  <span>Jadwal</span>
                  <b>
                    {dateLabel(booking.date)}
                    <small>
                      {session(booking.schedule)?.start} –{" "}
                      {session(booking.schedule)?.end} WIB
                    </small>
                  </b>
                </div>
                <div>
                  <span>Keluhan</span>
                  <b>{booking.complaint}</b>
                </div>
                <div>
                  <span>Sumber</span>
                  <b>{role === "Petugas" ? "Walk-in" : "Online"}</b>
                </div>
                <div className="notice">
                  <Icon name="shield" size={18} />
                  Kunjungan aktif ganda pada sesi yang sama tidak diperbolehkan.
                </div>
              </div>
            )}
            {showError}
            <div className="form-actions">
              {step > 1 && (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setStep(step - 1)
                    setError("")
                  }}
                >
                  Kembali
                </button>
              )}
              <button className="primary" disabled={busy} type="submit">
                {step === 3 ? "Konfirmasi Pendaftaran" : "Lanjutkan"}
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        )}
      </section>
      <div>
        {schedulePanel}
        <div className="notice">
          <Icon name="help" size={20} />
          Simulasi menggunakan tanggal 26 Oktober 2026. Data akan kembali ke
          awal setelah halaman dimuat ulang.
        </div>
      </div>
    </div>
  )
  const saveEditor = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editor) return
    const data = new FormData(e.currentTarget)
    const get = (key: string) => String(data.get(key) || "").trim()
    const active = get("active") !== "Nonaktif"
    if (editor.type === "Pasien") {
      const value: Patient = {
        id: editor.id || `RM-${String(128 + patients.length).padStart(5, "0")}`,
        name: get("name"),
        phone: get("phone"),
        birth: get("birth"),
        gender: get("gender"),
        address: get("address"),
        emergency: get("emergency"),
        account: false,
      }
      setPatients((p) =>
        editor.id
          ? p.map((item) =>
              item.id === editor.id
                ? { ...value, account: item.account }
                : item,
            )
          : [...p, value],
      )
      if (!editor.id) setBooking((b) => ({ ...b, patient: value.id }))
    } else if (editor.type === "Dokter") {
      if (doctors.some((d) => d.sip === get("sip") && d.id !== editor.id)) {
        setError("Nomor SIP sudah terdaftar.")
        return
      }
      const linked = data.getAll("services").map(String)
      if (!linked.length) {
        setError("Pilih setidaknya satu layanan untuk dokter.")
        return
      }
      const value = {
        id: editor.id || `d${Date.now()}`,
        name: get("name"),
        specialty: get("specialty"),
        sip: get("sip"),
        services: linked,
        active,
      }
      setDoctors((d) =>
        editor.id
          ? d.map((item) => (item.id === editor.id ? value : item))
          : [...d, value],
      )
    } else if (editor.type === "Layanan") {
      if (
        services.some(
          (s) =>
            s.name.toLowerCase() === get("name").toLowerCase() &&
            s.id !== editor.id,
        )
      ) {
        setError("Nama layanan sudah digunakan.")
        return
      }
      const value = {
        id: editor.id || `s${Date.now()}`,
        name: get("name"),
        description: get("description"),
        duration: Number(get("duration")),
        active,
      }
      setServices((s) =>
        editor.id
          ? s.map((item) => (item.id === editor.id ? value : item))
          : [...s, value],
      )
    } else if (editor.type === "Jadwal") {
      if (get("start") >= get("end")) {
        setError("Jam selesai harus setelah jam mulai.")
        return
      }
      if (
        active &&
        schedules.some(
          (s) =>
            s.id !== editor.id &&
            s.active &&
            s.doctor === get("doctor") &&
            s.day === Number(get("day")) &&
            s.start < get("end") &&
            s.end > get("start"),
        )
      ) {
        setError("Jadwal bentrok dengan sesi aktif dokter yang sama.")
        return
      }
      const value = {
        id: editor.id || `j${Date.now()}`,
        doctor: get("doctor"),
        day: Number(get("day")),
        start: get("start"),
        end: get("end"),
        quota: Number(get("quota")),
        active,
      }
      setSchedules((s) =>
        editor.id
          ? s.map((item) => (item.id === editor.id ? value : item))
          : [...s, value],
      )
    } else if (editor.type === "Pengguna") {
      if (users.some((u) => u.email === get("email"))) {
        setError("Email sudah digunakan.")
        return
      }
      setUsers((u) => [
        ...u,
        {
          name: get("name"),
          email: get("email"),
          role: get("role"),
          active: true,
        },
      ])
    }
    setEditor(null)
    setError("")
    notify(
      "Data demo berhasil diperbarui. Perubahan hanya berlaku selama sesi ini.",
    )
  }
  const editRecord =
    editor?.type === "Dokter" ? doctors.find((d) => d.id === editor.id) : null
  const editService =
    editor?.type === "Layanan" ? services.find((s) => s.id === editor.id) : null
  const editSchedule =
    editor?.type === "Jadwal" ? schedules.find((s) => s.id === editor.id) : null
  const editPatient =
    editor?.type === "Pasien" ? patients.find((p) => p.id === editor.id) : null
  const management = () => {
    if (page === "Pendaftaran Kunjungan" || page === "Pendaftaran Walk-in")
      return registration
    if (page === "Antrean Saya" && role === "Pasien") return patientQueue
    if (page === "Antrean Hari Ini" || page === "Antrean Saya")
      return visitTable(
        today,
        role === "Dokter" ? "Antrean dokter Anda hari ini" : "Antrean hari ini",
      )
    if (page === "Riwayat Kunjungan" || page === "Riwayat Pasien")
      return visitTable(
        scoped.filter((v) =>
          ["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
        ),
        role === "Pasien"
          ? "Riwayat kunjungan Anda"
          : "Riwayat pasien yang Anda tangani",
      )
    if (page === "Rekap Kunjungan")
      return (
        <>
          {stats}
          {visitTable(scoped, "Rekap administratif kunjungan", true)}
        </>
      )
    if (page === "Data Pasien") {
      const list = patients.filter((p) =>
        `${p.name} ${p.id} ${p.phone}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>
                Data pasien <span className="count">{list.length} pasien</span>
              </h3>
              <p>Pasien berakun maupun walk-in. Tanpa akses isi pemeriksaan.</p>
            </div>
            <button className="primary" onClick={() => showEditor("Pasien")}>
              <Icon name="plus" size={16} />
              Pasien Baru
            </button>
          </div>
          <div className="table-tools">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                placeholder="Cari nama, nomor RM, atau telepon…"
                aria-label="Cari pasien"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pasien</th>
                  <th>No. rekam medis</th>
                  <th>Telepon</th>
                  <th>Tipe pasien</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                      <small>{p.gender}</small>
                    </td>
                    <td>{p.id}</td>
                    <td>{p.phone}</td>
                    <td>
                      <Badge
                        text={p.account ? "Berakun" : "Walk-in · Tanpa akun"}
                      />
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => showEditor("Pasien", p.id)}
                      >
                        Edit administrasi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && (
              <div className="empty">
                Pasien tidak ditemukan. Anda dapat mencatat pasien baru.
              </div>
            )}
          </div>
        </section>
      )
    }
    if (page === "Data Dokter")
      return (
        <>
          <div className="section-toolbar">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                aria-label="Cari dokter"
                placeholder="Cari dokter atau spesialisasi…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="primary" onClick={() => showEditor("Dokter")}>
              <Icon name="plus" size={16} />
              Tambah Dokter
            </button>
          </div>
          <div className="doctor-cards">
            {doctors
              .filter((d) =>
                `${d.name} ${d.specialty}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((d) => (
                <section className="panel doctor-card" key={d.id}>
                  <span className="avatar large blue">
                    {d.name
                      .split(" ")
                      .slice(1, 3)
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <Badge text={d.active ? "Aktif" : "Nonaktif"} />
                  <h3>{d.name}</h3>
                  <p>{d.specialty}</p>
                  <small className="ws-sip">No. SIP: {d.sip}</small>
                  <div className="ws-tags">
                    {d.services.map((s) => (
                      <span key={s}>{serviceName(s)}</span>
                    ))}
                  </div>
                  <button
                    className="secondary"
                    onClick={() => showEditor("Dokter", d.id)}
                  >
                    Edit Dokter & Layanan
                    <Icon name="arrow" size={15} />
                  </button>
                </section>
              ))}
          </div>
          {!doctors.some((d) =>
            `${d.name} ${d.specialty}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ) && <div className="panel empty">Dokter tidak ditemukan.</div>}
        </>
      )
    if (page === "Data Layanan")
      return (
        <>
          <div className="section-toolbar">
            <h3>{services.length} layanan klinik</h3>
            <button className="primary" onClick={() => showEditor("Layanan")}>
              <Icon name="plus" size={16} />
              Tambah Layanan
            </button>
          </div>
          <div className="doctor-cards">
            {services.map((s) => (
              <section className="panel doctor-card" key={s.id}>
                <span className="icon-tile blue">
                  <Icon name="heart" size={25} />
                </span>
                <Badge text={s.active ? "Aktif" : "Nonaktif"} />
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <p>
                  <Icon name="clock" size={15} />
                  {s.duration} menit per kunjungan
                </p>
                <button
                  className="secondary"
                  onClick={() => showEditor("Layanan", s.id)}
                >
                  Edit Layanan
                </button>
              </section>
            ))}
          </div>
        </>
      )
    if (page === "Jadwal Praktik")
      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Jadwal praktik & kuota</h3>
              <p>Sesi dokter tidak boleh bentrok pada hari yang sama.</p>
            </div>
            <button className="primary" onClick={() => showEditor("Jadwal")}>
              <Icon name="plus" size={16} />
              Tambah Jadwal
            </button>
          </div>
          <div className="table-scroll ws-spaced-table">
            <table>
              <thead>
                <tr>
                  {[
                    "Dokter",
                    "Hari",
                    "Jam praktik",
                    "Kuota / sesi",
                    "Sisa hari demo",
                    "Status",
                    "Aksi",
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{doctorName(s.doctor)}</b>
                    </td>
                    <td>
                      {
                        [
                          "Minggu",
                          "Senin",
                          "Selasa",
                          "Rabu",
                          "Kamis",
                          "Jumat",
                          "Sabtu",
                        ][s.day]
                      }
                    </td>
                    <td>
                      {s.start} – {s.end}
                    </td>
                    <td>{s.quota} pasien</td>
                    <td>
                      {s.day === 1
                        ? `${remaining(s, DEMO_DATE, visits)} tersisa`
                        : "—"}
                    </td>
                    <td>
                      <Badge text={s.active ? "Aktif" : "Nonaktif"} />
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => showEditor("Jadwal", s.id)}
                      >
                        Edit Jadwal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )
    if (page === "Manajemen Pengguna")
      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Akun & peran pengguna</h3>
              <p>Akun staf dibuat oleh admin. Pasien mendaftar mandiri.</p>
            </div>
            <button className="primary" onClick={() => showEditor("Pengguna")}>
              <Icon name="plus" size={16} />
              Tambah Akun Staf
            </button>
          </div>
          <div className="table-scroll ws-spaced-table">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.email}>
                    <td>
                      <b>{u.name}</b>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      <Badge text={u.active ? "Aktif" : "Nonaktif"} />
                    </td>
                    <td>
                      <button
                        className="text-button"
                        disabled={i === 0}
                        onClick={() => {
                          setUsers((previous) =>
                            previous.map((item, index) =>
                              index === i
                                ? { ...item, active: !item.active }
                                : item,
                            ),
                          )
                          notify("Status akun demo diperbarui.")
                        }}
                      >
                        {i === 0
                          ? "Akun Anda"
                          : u.active
                            ? "Nonaktifkan"
                            : "Aktifkan"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="notice ws-inset">
            <Icon name="shield" size={20} />
            Ini simulasi tampilan akun. Pembuatan akun dan pembatasan akses
            server belum terhubung.
          </div>
        </section>
      )
    if (page === "Profil Saya" && !editingProfile)
      return (
        <div className="patient-profile-layout">
          <section className="panel patient-profile-identity">
            <span className="avatar large blue">
              {patient.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </span>
            <h2>{patient.name}</h2>
            <p className="muted">{patient.id}</p>
            <Badge text="Pasien" />
            <div className="patient-profile-fixed">
              <Icon name="shield" size={19} />
              <p>
                Nomor rekam medis dan peran dikelola klinik, tidak dapat diubah
                melalui profil.
              </p>
            </div>
          </section>
          <section className="panel patient-profile-details">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PROFIL PRIBADI</span>
                <h3>Informasi profil Anda</h3>
                <p>
                  Data ditampilkan hanya-baca. Pilih Edit Profil untuk melakukan
                  perubahan.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => setEditingProfile(true)}
              >
                <Icon name="users" size={17} />
                Edit Profil
              </button>
            </div>
            <div className="patient-panel-body">
              <h3 className="patient-detail-heading">
                <Icon name="users" size={18} />
                Data diri
              </h3>
              <dl className="patient-profile-fields">
                {[
                  ["Nama lengkap", patient.name],
                  ["Nomor rekam medis", patient.id],
                  ["Tanggal lahir", dateLabel(patient.birth)],
                  ["Jenis kelamin", patient.gender],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Belum diisi"}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="patient-detail-heading">
                <Icon name="clinic" size={18} />
                Kontak & alamat
              </h3>
              <dl className="patient-profile-fields">
                {[
                  ["Nomor telepon", patient.phone],
                  ["Kontak darurat", patient.emergency],
                  ["Alamat", patient.address],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className={label === "Alamat" ? "full-width" : ""}
                  >
                    <dt>{label}</dt>
                    <dd>{value || "Belum diisi"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      )
    if (page === "Profil Saya" || page === "Profil Klinik")
      return (
        <section className="panel form-panel">
          <span className="eyebrow">
            {role === "Admin"
              ? "IDENTITAS & LOKASI KLINIK"
              : "INFORMASI PRIBADI"}
          </span>
          <h3>{role === "Pasien" ? "Edit Profil" : page}</h3>
          <p className="muted">
            {role === "Admin"
              ? "Informasi untuk halaman publik klinik."
              : `${patient.id} · Peran pasien tidak dapat diubah.`}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const data = new FormData(e.currentTarget)
              const get = (key: string) => String(data.get(key) || "")
              if (role === "Admin")
                setClinic({
                  name: get("name"),
                  description: get("description"),
                  address: get("address"),
                  phone: get("phone"),
                  latitude: get("latitude"),
                  longitude: get("longitude"),
                  hours: get("hours"),
                })
              else
                setPatients((p) =>
                  p.map((item) =>
                    item.id === patient.id
                      ? {
                          ...item,
                          name: get("name"),
                          phone: get("phone"),
                          birth: get("birth"),
                          gender: get("gender"),
                          address: get("address"),
                          emergency: get("emergency"),
                        }
                      : item,
                  ),
                )
              setEditingProfile(false)
              notify("Profil demo berhasil diperbarui untuk sesi ini.")
            }}
          >
            <Field label="Nama">
              <input
                name="name"
                required
                defaultValue={role === "Admin" ? clinic.name : patient.name}
              />
            </Field>
            {role === "Admin" ? (
              <Field label="Deskripsi">
                <textarea
                  name="description"
                  required
                  defaultValue={clinic.description}
                />
              </Field>
            ) : (
              <div className="ws-form-grid">
                <Field label="Tanggal lahir">
                  <input
                    name="birth"
                    required
                    type="date"
                    max={DEMO_DATE}
                    defaultValue={patient.birth}
                  />
                </Field>
                <Field label="Jenis kelamin">
                  <select name="gender" defaultValue={patient.gender}>
                    <option>Laki-laki</option>
                    <option>Perempuan</option>
                  </select>
                </Field>
              </div>
            )}
            <Field label="Alamat">
              <textarea
                name="address"
                required
                defaultValue={
                  role === "Admin" ? clinic.address : patient.address
                }
              />
            </Field>
            <Field label="Nomor telepon">
              <input
                name="phone"
                required
                type="tel"
                defaultValue={role === "Admin" ? clinic.phone : patient.phone}
              />
            </Field>
            {role === "Admin" ? (
              <>
                <div className="ws-form-grid">
                  <Field label="Latitude">
                    <input
                      required
                      name="latitude"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      defaultValue={clinic.latitude}
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      required
                      name="longitude"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      defaultValue={clinic.longitude}
                    />
                  </Field>
                </div>
                <Field label="Jam operasional">
                  <input required name="hours" defaultValue={clinic.hours} />
                </Field>
              </>
            ) : (
              <Field label="Kontak darurat">
                <input
                  name="emergency"
                  type="tel"
                  defaultValue={patient.emergency}
                />
              </Field>
            )}
            <div className="form-actions">
              {role === "Pasien" && (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setEditingProfile(false)}
                >
                  Batal
                </button>
              )}
              <button className="primary" type="submit">
                Simpan Perubahan
                <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        </section>
      )
    return (
      <>
        {stats}
        {role === "Admin" ? (
          <>
            <div className="ws-overview">
              <section className="panel ws-distribution">
                <div className="panel-heading">
                  <div>
                    <h3>Ringkasan per layanan</h3>
                    <p>Seluruh periode · {visits.length} kunjungan simulasi</p>
                  </div>
                  <Icon name="chart" size={18} />
                </div>
                {services.map((s) => {
                  const count = visits.filter((v) => v.service === s.id).length
                  return (
                    <div className="ws-distribution-row" key={s.id}>
                      <div>
                        <span>{s.name}</span>
                        <b>
                          {count} <small>kunjungan</small>
                        </b>
                      </div>
                      <div className="ws-quota-track">
                        <span
                          style={{
                            width: `${(count / Math.max(visits.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
                <button
                  className="schedule-link"
                  onClick={() => navigate("Rekap Kunjungan")}
                >
                  Buka rekap dengan filter periode
                  <Icon name="arrow" size={15} />
                </button>
              </section>
              {schedulePanel}
            </div>
            {workflow}
            {visitTable(scoped, "Kunjungan terbaru")}
          </>
        ) : (
          <>
            {workflow}
            <div className="ws-overview ws-operational">
              {visitTable(
                today,
                role === "Dokter"
                  ? "Pasien Anda hari ini"
                  : "Antrean pelayanan hari ini",
              )}
              {schedulePanel}
            </div>
          </>
        )}
      </>
    )
  }
  if (role === "Publik")
    return (
      <PublicSite
        Icon={Icon}
        page={page}
        navigate={navigate}
        onBook={() => navigate("Login")}
        onLogin={() => switchRole("Pasien")}
        onRole={switchRole}
        doctors={doctors}
        services={services}
        schedules={schedules}
        visits={visits}
        clinic={clinic}
      />
    )
  return (
    <div className={`app ws-app ${mobile ? "nav-open" : ""}`}>
      {mobile && (
        <button
          className="ws-mobile-shade"
          aria-label="Tutup navigasi"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar">
        <button
          className="brand ws-brand"
          aria-label="SehatKlinik dashboard"
          onClick={() => navigate("Dashboard")}
        >
          <BrandArtwork />
        </button>
        <div className="workspace">
          <span className="workspace-icon">
            <Icon name="clinic" size={19} />
          </span>
          <div>
            <b>{clinic.name}</b>
            <small>Jakarta Selatan</small>
          </div>
        </div>
        <span className="nav-label">RUANG {role.toUpperCase()}</span>
        <nav aria-label="Navigasi dashboard">
          {menus[role].map(([m, icon]) => (
            <button
              key={m}
              className={m === page ? "active" : ""}
              onClick={() => navigate(m)}
            >
              <Icon name={icon} size={19} />
              <span>{m}</span>
              {m === page && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-symbol">
              <Icon name="shield" size={22} />
            </span>
            <b>Akses sesuai peran</b>
            <p>
              {role === "Admin" || role === "Petugas"
                ? "Isi pemeriksaan dan tindakan medis tidak ditampilkan di ruang ini."
                : role === "Dokter"
                  ? "Hanya kunjungan yang Anda tangani ditampilkan di sini."
                  : "Hanya data kunjungan dan riwayat milik Anda."}
            </p>
          </div>
          <button className="sidebar-link" onClick={() => switchRole("Publik")}>
            <Icon name="logout" size={18} />
            Kembali ke Website
          </button>
          <div className="sidebar-foot">
            <span className="green-dot" /> Prototipe interaktif
            <small>Data fiktif · Tidak untuk pelayanan nyata</small>
          </div>
        </div>
      </aside>
      <div className="main-wrapper">
        <header className="topbar">
          <button
            className="mobile-menu square"
            aria-label="Buka navigasi"
            onClick={() => setMobile(!mobile)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            Klinik <span>/</span>
            <b>
              {role === "Admin"
                ? "Administrasi"
                : role === "Dokter"
                  ? "Ruang Dokter"
                  : role === "Petugas"
                    ? "Pelayanan Pasien"
                    : "Ruang Pasien"}
            </b>
          </div>
          <div className="topbar-right">
            <div className="role-select">
              <span className="preview-dot" />
              <span className="ws-preview-label">Pratinjau</span>
              <select
                aria-label="Pratinjau peran"
                value={role}
                onChange={(e) => switchRole(e.target.value)}
              >
                {["Publik", "Pasien", "Petugas", "Dokter", "Admin"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <span className="top-divider" />
            <div className="profile">
              <span className="avatar blue">
                {role === "Pasien"
                  ? patient.name.split(" ").map(part => part[0]).join("").slice(0, 2)
                  : role === "Dokter"
                    ? "NP"
                    : role === "Petugas"
                      ? "DW"
                      : "RK"}
              </span>
              <div>
                <b>
                  {role === "Pasien"
                    ? patient.name
                    : role === "Dokter"
                      ? "dr. Nadia Putri"
                      : role === "Petugas"
                        ? "Dina Wulandari"
                        : "Rina Kusuma"}
                </b>
                <small>{role === "Admin" ? "Administrator" : role}</small>
              </div>
            </div>
          </div>
        </header>
        <main className="content">
          <div className="ws-demo-strip">
            <Icon name="help" size={15} />
            <span>
              Mode prototipe · Data fiktif, tidak tersimpan setelah refresh.
              Pemilih peran hanya untuk pratinjau desain.
            </span>
            <span className="ws-demo-date">26 OKT 2026</span>
          </div>
          <div className="page-heading">
            <div className="cinema-workspace-art" aria-hidden="true">
              <span className="cinema-workspace-orbit" />
              <img src="/images/sehatklinik-symbol.png" alt="" />
            </div>
            <div>
              <div className="page-overline">
                <span />
                SEHATKLINIK / {role.toUpperCase()}
              </div>
              <h1>
                {page === "Dashboard"
                  ? `Selamat pagi, ${
                      role === "Dokter"
                        ? "dr. Nadia"
                        : role === "Pasien"
                          ? patient.name.split(" ")[0]
                          : role === "Petugas"
                            ? "Dina"
                            : "Rina"
                    }.`
                  : page}
              </h1>
              <p>
                {page === "Dashboard"
                  ? role === "Admin"
                    ? "Gambaran pelayanan klinik, tanpa membuka isi rekam medis."
                    : role === "Dokter"
                      ? "Fokus pada pasien Anda. Kami bantu merapikan alurnya."
                      : role === "Petugas"
                        ? "Sambut pasien dan kelola alur pelayanan hari ini."
                        : "Kunjungan dan informasi kesehatan Anda, dalam satu ruang."
                  : "Informasi terstruktur untuk pelayanan yang lebih baik."}
              </p>
            </div>
            <div className="heading-actions">
              <span className="secondary date-button">
                <Icon name="calendar" size={16} />
                Senin, 26 Oktober 2026
              </span>
              {page === "Dashboard" &&
                (role === "Petugas" || role === "Pasien") && (
                  <button
                    className="primary"
                    onClick={() =>
                      navigate(
                        role === "Petugas"
                          ? "Pendaftaran Walk-in"
                          : "Pendaftaran Kunjungan",
                      )
                    }
                  >
                    <Icon name="plus" size={16} />
                    {role === "Petugas" ? "Daftar Walk-in" : "Daftar Kunjungan"}
                  </button>
                )}
            </div>
          </div>
          {page === "Dashboard" && role === "Pasien"
            ? patientDashboard
            : management()}
          <footer className="content-footer">
            <span>© 2026 SehatKlinik · Sistem Informasi Klinik Kesehatan</span>
            <span>
              <Icon name="shield" size={13} />
              Prototipe berdasarkan PRD & ERD · Data simulasi
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
          <button aria-label="Tutup notifikasi" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal ws-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="visit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">DETAIL KUNJUNGAN</span>
                <h2 id="visit-title">{patientName(detail.patient)}</h2>
                <p>
                  {detail.patient} · {detail.id}
                </p>
              </div>
              <button
                className="square"
                aria-label="Tutup detail"
                onClick={() => setSelected(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="ws-detail-status">
              <span className="queue-number">{queueLabel(detail)}</span>
              <span>
                Kunjungan <Badge text={detail.status} />
              </span>
              <span>
                Antrean <Badge text={detail.queue} />
              </span>
            </div>
            <div className="ws-summary">
              <div>
                <span>Dokter & layanan</span>
                <b>
                  {doctorName(detail.doctor)}
                  <small>{serviceName(detail.service)}</small>
                </b>
              </div>
              <div>
                <span>Jadwal & sumber</span>
                <b>
                  {dateLabel(detail.date)} · {session(detail.schedule)?.start} –{" "}
                  {session(detail.schedule)?.end}
                  <small>{detail.source}</small>
                </b>
              </div>
              {canMedical && (
                <div>
                  <span>Keluhan</span>
                  <b>{detail.complaint}</b>
                </div>
              )}
              {detail.reason && (
                <div>
                  <span>Alasan</span>
                  <b>{detail.reason}</b>
                </div>
              )}
            </div>
            {!canMedical && (
              <div className="notice">
                <Icon name="shield" size={19} />
                Anda hanya melihat informasi administratif. Pemeriksaan dan
                tindakan medis tidak ditampilkan.
              </div>
            )}
            {role === "Dokter" &&
              detail.queue === "Sedang Diperiksa" &&
              exam && (
                <form onSubmit={saveExamination}>
                  <div className="ws-subheading">
                    <h3>Pemeriksaan medis</h3>
                    <Badge text={savedExam ? "Tersimpan" : "Draf"} />
                  </div>
                  <Field label="Anamnesis">
                    <textarea
                      required
                      value={exam.anamnesis}
                      onChange={(e) => {
                        setExam({ ...exam, anamnesis: e.target.value })
                        setSavedExam(false)
                      }}
                    />
                  </Field>
                  <div className="ws-form-grid three">
                    <Field label="Tekanan darah (mmHg)">
                      <input
                        required
                        pattern="[0-9]{2,3}/[0-9]{2,3}"
                        placeholder="120/80"
                        value={exam.pressure}
                        onChange={(e) => {
                          setExam({ ...exam, pressure: e.target.value })
                          setSavedExam(false)
                        }}
                      />
                    </Field>
                    <Field label="Suhu (°C)">
                      <input
                        required
                        type="number"
                        min="30"
                        max="45"
                        step="0.1"
                        value={exam.temperature}
                        onChange={(e) => {
                          setExam({ ...exam, temperature: e.target.value })
                          setSavedExam(false)
                        }}
                      />
                    </Field>
                    <Field label="Berat badan (kg)">
                      <input
                        required
                        type="number"
                        min="1"
                        max="500"
                        step="0.1"
                        value={exam.weight}
                        onChange={(e) => {
                          setExam({ ...exam, weight: e.target.value })
                          setSavedExam(false)
                        }}
                      />
                    </Field>
                  </div>
                  <Field label="Diagnosis">
                    <textarea
                      required
                      value={exam.diagnosis}
                      onChange={(e) => {
                        setExam({ ...exam, diagnosis: e.target.value })
                        setSavedExam(false)
                      }}
                    />
                  </Field>
                  <Field label="Catatan pemeriksaan">
                    <textarea
                      value={exam.notes}
                      onChange={(e) => {
                        setExam({ ...exam, notes: e.target.value })
                        setSavedExam(false)
                      }}
                    />
                  </Field>
                  <div className="ws-subheading">
                    <h3>
                      Tindakan{" "}
                      <span className="count">
                        Opsional · {exam.actions.length}
                      </span>
                    </h3>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setExam({
                          ...exam,
                          actions: [
                            ...exam.actions,
                            { name: "", description: "", advice: "" },
                          ],
                        })
                        setSavedExam(false)
                      }}
                    >
                      + Tambah Tindakan
                    </button>
                  </div>
                  {exam.actions.map((action, i) => (
                    <div className="ws-action-card" key={i}>
                      <div className="ws-subheading">
                        <b>Tindakan {i + 1}</b>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setExam({
                              ...exam,
                              actions: exam.actions.filter(
                                (_, index) => index !== i,
                              ),
                            })
                            setSavedExam(false)
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                      {[
                        ["name", "Nama tindakan"],
                        ["description", "Keterangan"],
                        ["advice", "Saran lanjutan"],
                      ].map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            required={key === "name"}
                            value={action[(key as keyof typeof action)]}
                            onChange={(e) => {
                              setExam({
                                ...exam,
                                actions: exam.actions.map((item, index) =>
                                  index === i
                                    ? { ...item, [key]: e.target.value }
                                    : item,
                                ),
                              })
                              setSavedExam(false)
                            }}
                          />
                        </Field>
                      ))}
                    </div>
                  ))}
                  <div className="modal-actions">
                    <button className="secondary" type="submit">
                      <Icon name="file" size={16} />
                      Simpan Pemeriksaan
                    </button>
                    <button
                      className="primary"
                      type="button"
                      disabled={!savedExam}
                      onClick={() => {
                        updateVisit(detail.id, {
                          status: "Selesai",
                          queue: "Selesai",
                        })
                        setSelected(null)
                        notify(
                          "Kunjungan selesai. Ringkasan tersedia pada riwayat pasien.",
                        )
                      }}
                    >
                      Selesaikan Kunjungan
                      <Icon name="check" size={16} />
                    </button>
                  </div>
                  <p className="ws-form-hint">
                    Simpan pemeriksaan terlebih dahulu sebelum menyelesaikan
                    kunjungan.
                  </p>
                </form>
              )}
            {canMedical &&
              detail.examination &&
              (role === "Pasien" || detail.queue === "Selesai") && (
                <section className="ws-medical-summary">
                  <div className="ws-subheading">
                    <h3>Ringkasan pemeriksaan</h3>
                    <Badge text="Hanya-baca" />
                  </div>
                  <p className="muted">
                    Dicatat oleh {doctorName(detail.doctor)} ·{" "}
                    {dateLabel(detail.date)}
                  </p>
                  <div className="ws-summary">
                    {[
                      ["Anamnesis", detail.examination.anamnesis],
                      [
                        "Tanda vital",
                        `${detail.examination.pressure} mmHg · ${detail.examination.temperature} °C · ${detail.examination.weight} kg`,
                      ],
                      ["Diagnosis", detail.examination.diagnosis],
                      ["Catatan", detail.examination.notes],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <b>{value || "—"}</b>
                      </div>
                    ))}
                  </div>
                  <h3>Tindakan & saran</h3>
                  {detail.examination.actions.length ? (
                    detail.examination.actions.map((a, i) => (
                      <div className="ws-action-card" key={i}>
                        <b>{a.name}</b>
                        <p>{a.description}</p>
                        <p>{a.advice}</p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Tidak ada tindakan tambahan.</p>
                  )}
                </section>
              )}
            {((role === "Petugas" &&
              ["Menunggu", "Dipanggil"].includes(detail.queue)) ||
              (role === "Pasien" && detail.queue === "Menunggu")) && (
              <Field label="Alasan pembatalan / pelewatan (wajib untuk tindakan tersebut)">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tuliskan alasan…"
                />
              </Field>
            )}
            {showError}
            <div className="modal-actions">
              {role === "Petugas" &&
                detail.status === "Terdaftar" &&
                detail.queue === "Menunggu" && (
                  <button
                    className="primary"
                    onClick={() => transition(detail, "checkin")}
                  >
                    Konfirmasi Kehadiran
                  </button>
                )}
              {["Petugas", "Dokter"].includes(role) &&
                detail.status === "Hadir" &&
                detail.queue === "Menunggu" && (
                  <button
                    className="primary"
                    onClick={() => transition(detail, "call")}
                  >
                    Panggil Pasien
                  </button>
                )}
              {role === "Dokter" && detail.queue === "Dipanggil" && (
                <button
                  className="primary"
                  onClick={() => transition(detail, "start")}
                >
                  Mulai Pemeriksaan
                </button>
              )}
              {role === "Petugas" && detail.queue === "Dipanggil" && (
                <button
                  className="secondary"
                  disabled={!reason.trim()}
                  onClick={() => transition(detail, "skip")}
                >
                  Lewati Antrean
                </button>
              )}
              {((role === "Pasien" && detail.queue === "Menunggu") ||
                (role === "Petugas" &&
                  ["Menunggu", "Dipanggil"].includes(detail.queue))) && (
                <button
                  className="destructive"
                  disabled={!reason.trim()}
                  onClick={() => transition(detail, "cancel")}
                >
                  Batalkan Kunjungan
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {editor && (
        <div className="modal-backdrop" onClick={() => setEditor(null)}>
          <section
            className="modal ws-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  DATA {editor.type.toUpperCase()}
                </span>
                <h2 id="editor-title">
                  {editor.id ? "Edit" : "Tambah"} {editor.type}
                </h2>
              </div>
              <button
                className="square"
                aria-label="Tutup formulir"
                onClick={() => setEditor(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={saveEditor}>
              {["Pasien", "Dokter", "Layanan", "Pengguna"].includes(
                editor.type,
              ) && (
                <Field label="Nama">
                  <input
                    name="name"
                    required
                    defaultValue={
                      editPatient?.name ||
                      editRecord?.name ||
                      editService?.name ||
                      ""
                    }
                  />
                </Field>
              )}
              {editor.type === "Pasien" && (
                <>
                  <div className="notice">
                    <Icon name="users" size={19} />
                    Nomor rekam medis otomatis. Pasien walk-in tidak memerlukan
                    akun.
                  </div>
                  <div className="ws-form-grid">
                    <Field label="Tanggal lahir">
                      <input
                        name="birth"
                        required
                        type="date"
                        max={DEMO_DATE}
                        defaultValue={editPatient?.birth}
                      />
                    </Field>
                    <Field label="Jenis kelamin">
                      <select name="gender" defaultValue={editPatient?.gender}>
                        <option>Laki-laki</option>
                        <option>Perempuan</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Nomor telepon">
                    <input
                      name="phone"
                      required
                      type="tel"
                      pattern="[0-9+() -]{8,16}"
                      defaultValue={editPatient?.phone}
                    />
                  </Field>
                  <Field label="Alamat">
                    <textarea
                      name="address"
                      required
                      defaultValue={editPatient?.address}
                    />
                  </Field>
                  <Field label="Kontak darurat">
                    <input
                      name="emergency"
                      type="tel"
                      defaultValue={editPatient?.emergency}
                    />
                  </Field>
                </>
              )}
              {editor.type === "Dokter" && (
                <>
                  <Field label="Spesialisasi">
                    <input
                      name="specialty"
                      required
                      defaultValue={editRecord?.specialty}
                    />
                  </Field>
                  <Field label="Nomor SIP (unik)">
                    <input name="sip" required defaultValue={editRecord?.sip} />
                  </Field>
                  <fieldset className="ws-checklist">
                    <legend>Layanan yang ditangani</legend>
                    {services.map((s) => (
                      <label key={s.id}>
                        <input
                          name="services"
                          type="checkbox"
                          value={s.id}
                          defaultChecked={editRecord?.services.includes(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              {editor.type === "Layanan" && (
                <>
                  <Field label="Deskripsi">
                    <textarea
                      name="description"
                      required
                      defaultValue={editService?.description}
                    />
                  </Field>
                  <Field label="Durasi (menit)">
                    <input
                      name="duration"
                      type="number"
                      required
                      min="1"
                      max="480"
                      defaultValue={editService?.duration || 30}
                    />
                  </Field>
                </>
              )}
              {editor.type === "Jadwal" && (
                <>
                  <Field label="Dokter">
                    <select name="doctor" defaultValue={editSchedule?.doctor}>
                      {doctors
                        .filter(
                          (d) => d.active || d.id === editSchedule?.doctor,
                        )
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Hari praktik">
                    <select name="day" defaultValue={editSchedule?.day ?? 1}>
                      {[
                        "Minggu",
                        "Senin",
                        "Selasa",
                        "Rabu",
                        "Kamis",
                        "Jumat",
                        "Sabtu",
                      ].map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="ws-form-grid">
                    <Field label="Jam mulai">
                      <input
                        name="start"
                        required
                        type="time"
                        defaultValue={editSchedule?.start || "08:00"}
                      />
                    </Field>
                    <Field label="Jam selesai">
                      <input
                        name="end"
                        required
                        type="time"
                        defaultValue={editSchedule?.end || "12:00"}
                      />
                    </Field>
                  </div>
                  <Field label="Kuota per sesi">
                    <input
                      name="quota"
                      required
                      type="number"
                      min="1"
                      defaultValue={editSchedule?.quota || 5}
                    />
                  </Field>
                  <div className="notice">
                    Jadwal bentrok ditolak. Kuota harus lebih dari nol.
                  </div>
                </>
              )}
              {editor.type === "Pengguna" && (
                <>
                  <Field label="Email staf">
                    <input name="email" required type="email" />
                  </Field>
                  <Field label="Peran">
                    <select name="role">
                      <option>Petugas</option>
                      <option>Dokter</option>
                    </select>
                  </Field>
                  <div className="notice">
                    Simulasi akun staf saja. Tidak membuat kredensial atau
                    mengirim undangan.
                  </div>
                </>
              )}
              {["Dokter", "Layanan", "Jadwal"].includes(editor.type) && (
                <Field label="Status">
                  <select
                    name="active"
                    defaultValue={
                      (editRecord || editService || editSchedule)?.active ===
                      false
                        ? "Nonaktif"
                        : "Aktif"
                    }
                  >
                    <option>Aktif</option>
                    <option>Nonaktif</option>
                  </select>
                </Field>
              )}
              {showError}
              <div className="form-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setEditor(null)}
                >
                  Batal
                </button>
                <button className="primary" type="submit">
                  Simpan Data Demo
                  <Icon name="check" size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
