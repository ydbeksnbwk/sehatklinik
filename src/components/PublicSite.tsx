"use client"

import { useEffect, useState, type ComponentType } from "react"
import { useRouter } from "next/navigation"
import BrandArtwork from "./BrandArtwork"
import CinematicArtwork from "./CinematicArtwork"
import ClinicMap from "./ClinicMap"
import { useClinic } from "../context/ClinicContext"
import { formatDateIndonesian } from "@/lib/date"
import {
  DEMO_DATE,
  dateLabel,
  remaining,
  type Doctor,
  type Service,
  type Schedule,
  type Visit,
} from "../clinic-data"

type Props = {
  Icon: ComponentType<{
    name: string
    size?: number
  }>
  page: string
  initialDetailId?: string
  navigate: (page: string) => void
  onBook: () => void
  onLogin: () => void
  onRole: (role: string) => void
  doctors: Doctor[]
  services: Service[]
  schedules: Schedule[]
  visits: Visit[]
  clinic: {
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
}

export const getDoctorFallback = (name?: string) => {
  const isFemale = /nadira|annisa|alea|siti|putri|sarah|maya/i.test(name || "")
  return isFemale ? "/images/avatar-female.jpg" : "/images/avatar-male.jpg"
}

export const getErrorMessage = (err: any): string => {
  if (!err) return ""
  if (typeof err === "string") return err
  if (err.fields && typeof err.fields === "object") {
    const list = Object.values(err.fields).flat().filter(Boolean)
    if (list.length > 0) return list.join(", ")
  }
  if (typeof err.message === "string") return err.message
  return "Terjadi kesalahan saat pendaftaran. Silakan coba lagi."
}

const photo = (id?: string | null, width = 700) => {
  if (!id) return ""
  if (id.startsWith("http://") || id.startsWith("https://") || id.startsWith("/")) {
    return id
  }
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`
}

export default function PublicSite({
  Icon,
  page,
  initialDetailId,
  navigate,
  onBook,
  onLogin,
  onRole,
  doctors,
  services,
  schedules,
  visits,
  clinic,
}: Props) {
  const { login } = useClinic()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [authSuccess, setAuthSuccess] = useState("")
  const [regName, setRegName] = useState("")
  const [regNik, setRegNik] = useState("")
  const [regBirth, setRegBirth] = useState("2000-01-01")
  const [regGender, setRegGender] = useState("L")
  const [regPhone, setRegPhone] = useState("")
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
  const [doctorDetail, setDoctorDetail] = useState<Doctor | null>(null)
  const [serviceDetail, setServiceDetail] = useState<Service | null>(null)
  const [scheduleDate, setScheduleDate] = useState(DEMO_DATE)
  const [scheduleDoctor, setScheduleDoctor] = useState("")

  useEffect(() => {
    setLoginError("")
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get("registered") === "1") {
        setAuthSuccess("Pendaftaran akun pasien berhasil. Silakan masuk menggunakan akun baru Anda.")
      }
    }
  }, [page])

  useEffect(() => {
    if (!doctorDetail && !serviceDetail) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDoctorDetail()
        closeServiceDetail()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [doctorDetail, serviceDetail, page])

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setAuthSuccess("")
    setIsSubmittingAuth(true)

    try {
      if (page === "Registrasi") {
        const cleanPhone = regPhone.replace(/[^0-9+]/g, "")
        const genderCode = regGender === "Perempuan" || regGender === "P" ? "P" : "L"
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: loginEmail,
            password: loginPassword,
            nama: regName,
            nik: regNik,
            telepon: cleanPhone,
            tanggalLahir: regBirth,
            jenisKelamin: genderCode,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) {
          setLoginError(getErrorMessage(json.error || "Gagal melakukan registrasi."))
          setIsSubmittingAuth(false)
          return
        }

        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "sehatklinik_flash",
            "Pendaftaran akun pasien berhasil! Selamat datang di Klinik Sehat Sentosa."
          )
        }
      }

      await executeLogin(loginEmail, loginPassword)
    } catch (err: any) {
      setLoginError(getErrorMessage(err))
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  const executeLogin = async (emailTarget?: string, passTarget?: string) => {
    const targetEmail = emailTarget || loginEmail
    const targetPass = passTarget || loginPassword
    setLoginError("")
    const res = await login(targetEmail, targetPass)
    if (!res.success) {
      if (page === "Registrasi") {
        setAuthSuccess(
          "Pendaftaran akun pasien berhasil! Silakan masuk menggunakan email dan password Anda."
        )
        setLoginPassword("")
        go("Login")
      } else {
        setLoginError(getErrorMessage(res.message))
      }
      return
    }
    const roleRoutes: Record<string, string> = {
      Admin: "/admin",
      Petugas: "/petugas",
      Dokter: "/dokter-dashboard",
      Pasien: "/pasien",
    }
    const targetRole = res.user?.role || "Pasien"
    let dest = roleRoutes[targetRole] || "/pasien"

    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search)
      const redirectParam = sp.get("redirect")
      if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
        dest = redirectParam
      }
      try {
        router.replace(dest)
      } catch {
        window.location.replace(dest)
      }
    }
  }

  const getServiceExtendedMeta = (srv: Service) => {
    const key = srv.name.toLowerCase()
    if (key.includes("umum")) {
      return {
        summary:
          "Konsultasi awal untuk memahami keluhan sehari-hari, menilai kondisi umum, dan menentukan langkah perawatan berikutnya.",
        scopes: [
          "Wawancara keluhan dan riwayat kesehatan",
          "Pemeriksaan fisik serta tanda vital sesuai kebutuhan",
          "Edukasi kesehatan dan rencana tindak lanjut",
        ],
        preparations: [
          "Bawa kartu identitas (KTP/SIM) dan bukti pendaftaran.",
          "Siapkan informasi alergi, obat yang sedang digunakan, dan riwayat keluhan.",
        ],
        flow: [
          { step: "01", desc: "Dokter mendengarkan keluhan dan riwayat kesehatan Anda." },
          { step: "02", desc: "Pemeriksaan fisik dan tanda vital dilakukan sesuai kondisi." },
          { step: "03", desc: "Penjelasan hasil, terapi obat, serta saran kontrol atau rujukan." },
        ],
        alert:
          "Penanganan disesuaikan dengan hasil pemeriksaan. Bila diperlukan layanan spesialis di luar kemampuan klinik, dokter akan menyarankan rujukan.",
      }
    }
    if (key.includes("gigi")) {
      return {
        summary:
          "Pemeriksaan dan perawatan kesehatan gigi serta rongga mulut secara terpadu untuk mengatasi keluhan dan mencegah komplikasi.",
        scopes: [
          "Pemeriksaan kesehatan gigi, gusi, dan rongga mulut",
          "Pembersihan karang gigi serta penambalan sesuai indikasi",
          "Edukasi kebersihan gigi harian dan saran perawatan lanjutan",
        ],
        preparations: [
          "Bawa identitas dan bukti pendaftaran kunjungan.",
          "Informasikan riwayat keluhan gigi atau alergi obat anestesi kepada dokter.",
        ],
        flow: [
          { step: "01", desc: "Penyampaian keluhan atau tujuan pemeriksaan gigi." },
          { step: "02", desc: "Pemeriksaan klinis rongga mulut dan tindakan sesuai kebutuhan." },
          { step: "03", desc: "Penjelasan hasil, anjuran perawatan, dan jadwal kontrol berkala." },
        ],
        alert:
          "Tindakan khusus atau bedah minor gigi membutuhkan konfirmasi kondisi klinis dan kesiapan pasien terlebih dahulu.",
      }
    }
    if (key.includes("anak")) {
      return {
        summary:
          "Pendampingan kesehatan anak melalui konsultasi hangat bersama orang tua atau wali dan pemeriksaan sesuai tahap usia.",
        scopes: [
          "Konsultasi keluhan kesehatan anak (demam, batuk, alergi)",
          "Pemantauan tumbuh kembang dan status nutrisi anak",
          "Edukasi perawatan di rumah dan rencana tindak lanjut",
        ],
        preparations: [
          "Anak wajib didampingi oleh orang tua atau wali.",
          "Bawa buku kesehatan anak (KIA) dan catatan obat bila tersedia.",
        ],
        flow: [
          { step: "01", desc: "Orang tua atau wali menjelaskan keluhan serta kebiasaan anak." },
          { step: "02", desc: "Dokter memeriksa anak dengan pendekatan ramah anak." },
          { step: "03", desc: "Keluarga menerima penjelasan hasil, resep, dan rencana pantau." },
        ],
        alert:
          "Imunisasi tertentu dan pemeriksaan penunjang laboratorium dikonfirmasi ketersediaannya sesuai jadwal dokter spesialis.",
      }
    }
    if (key.includes("kebidanan") || key.includes("kandungan")) {
      return {
        summary:
          "Konsultasi kesehatan reproduksi wanita serta pemantauan kehamilan secara komprehensif, tenang, dan terjaga privasinya.",
        scopes: [
          "Pemeriksaan kehamilan rutin dan evaluasi kondisi janin",
          "Konsultasi kesehatan reproduksi, siklus haid, dan KB",
          "Edukasi persiapan persalinan serta nutrisi ibu hamil",
        ],
        preparations: [
          "Bawa kartu identitas serta buku kontrol kehamilan (KIA) jika ada.",
          "Catat riwayat kehamilan atau keluhan yang ingin dikonsultasikan.",
        ],
        flow: [
          { step: "01", desc: "Wawancara riwayat kesehatan reproduksi atau usia kehamilan." },
          { step: "02", desc: "Pemeriksaan fisik dan evaluasi klinis oleh dokter Sp.OG." },
          { step: "03", desc: "Penjelasan kondisi serta jadwal kontrol kehamilan berikutnya." },
        ],
        alert:
          "Pemeriksaan penunjang lanjutan seperti USG detail atau laboratorium dijadwalkan sesuai indikasi dokter.",
      }
    }
    if (key.includes("gizi")) {
      return {
        summary:
          "Konsultasi untuk memahami kebiasaan makan dan menyusun arahan gizi yang realistis sesuai kondisi serta target kesehatan.",
        scopes: [
          "Evaluasi pola makan harian dan kebiasaan gaya hidup",
          "Penilaian status gizi dan komposisi tubuh",
          "Penyusunan panduan menu seimbang sesuai kebutuhan medis",
        ],
        preparations: [
          "Catat pola makan 2–3 hari terakhir bila memungkinkan.",
          "Bawa data berat badan atau hasil pemeriksaan lab sebelumnya jika ada.",
        ],
        flow: [
          { step: "01", desc: "Dokter meninjau tujuan konsultasi serta riwayat kesehatan." },
          { step: "02", desc: "Pola makan harian dan status gizi pasien dievaluasi." },
          { step: "03", desc: "Arahan pola makan realistis dan jadwal evaluasi dibahas bersama." },
        ],
        alert:
          "Rencana gizi bersifat personal dan bertahap; pencapaian target menyesuaikan kondisi klinis masing-masing pasien.",
      }
    }
    if (key.includes("berkala")) {
      return {
        summary:
          "Evaluasi kondisi kesehatan menyeluruh untuk mendeteksi faktor risiko sedini mungkin dan merencanakan pencegahan yang tepat.",
        scopes: [
          "Pemeriksaan tanda vital dan pengukuran antropometri",
          "Evaluasi faktor risiko gaya hidup dan riwayat keluarga",
          "Konsultasi hasil skrining dan saran pemeliharaan kesehatan",
        ],
        preparations: [
          "Bawa kartu identitas serta catatan hasil pemeriksaan sebelumnya bila ada.",
          "Istirahat cukup pada malam sebelum jadwal pemeriksaan.",
        ],
        flow: [
          { step: "01", desc: "Pencatatan data kesehatan awal dan pemeriksaan tanda vital." },
          { step: "02", desc: "Pemeriksaan fisik menyeluruh dan konsultasi bersama dokter." },
          { step: "03", desc: "Penyampaian kesimpulan skrining dan rekomendasi pencegahan." },
        ],
        alert:
          "Pemeriksaan laboratorium tambahan bersifat terpisah dan disesuaikan dengan anjuran dokter.",
      }
    }
    return {
      summary: srv.overview || srv.description,
      scopes: srv.cases?.length
        ? srv.cases
        : ["Konsultasi medis dan pemeriksaan kondisi klinis", "Edukasi kesehatan dan rencana terapi"],
      preparations: srv.preparation
        ? [srv.preparation, "Bawa kartu identitas serta bukti pendaftaran kunjungan."]
        : ["Bawa kartu identitas dan bukti pendaftaran kunjungan."],
      flow: srv.steps?.length
        ? srv.steps.slice(0, 3).map((st) => ({
            step: String(st.step).padStart(2, "0"),
            desc: st.description || st.title,
          }))
        : [
            { step: "01", desc: "Penyampaian keluhan dan riwayat kesehatan." },
            { step: "02", desc: "Pemeriksaan klinis oleh dokter sesuai layanan." },
            { step: "03", desc: "Penjelasan hasil dan rencana tindak lanjut." },
          ],
      alert: "Penanganan dan tindakan lanjutan disesuaikan dengan hasil pemeriksaan dokter.",
    }
  }

  const careServices = services
    .filter((s) => s.active)
    .map((s, i) => ({
      ...s,
      icon: ["heart", "shield", "users", "heart", "check"][i % 5],
      text: s.description,
      tag: `Durasi konsultasi ± ${s.duration} menit`,
    }))

  const portraits = [
    "/images/doctor-portrait-woman.jpg",
    "/images/doctor-portrait-man.jpg",
    "/images/doctor-care.jpg",
    "/images/doctor-portrait-man.jpg",
    "/images/doctor-portrait-woman.jpg",
  ]

  const physicians = doctors
    .filter((d) => d.active)
    .map((d, i) => {
      const schedule = schedules.find((s) => s.doctor === d.id && s.active)
      return {
        ...d,
        time: schedule
          ? `${schedule.start} – ${schedule.end}`
          : "Belum ada sesi",
        day: schedule
          ? ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
              schedule.day
            ]
          : "",
        image: d.photoUrl || portraits[i % portraits.length],
      }
    })

  const slugMatch = (itemId: string, itemName: string, target: string) => {
    const cleanTarget = target.trim().toLowerCase()
    const slug = itemName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return itemId.toLowerCase() === cleanTarget || slug === cleanTarget
  }

  const openServiceDetail = (s: Service) => {
    setDoctorDetail(null)
    setServiceDetail(s)
    if (typeof window !== "undefined") {
      const nextPath = `/layanan/${encodeURIComponent(s.id)}`
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath)
      }
    }
  }

  const closeServiceDetail = () => {
    setServiceDetail(null)
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/layanan/")) {
      window.history.pushState(null, "", page === "Beranda" ? "/" : "/layanan")
    }
  }

  const openDoctorDetail = (d: Doctor) => {
    setServiceDetail(null)
    setDoctorDetail(d)
    if (typeof window !== "undefined") {
      const nextPath = `/dokter/${encodeURIComponent(d.id)}`
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath)
      }
    }
  }

  const closeDoctorDetail = () => {
    setDoctorDetail(null)
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/dokter/") &&
      !window.location.pathname.startsWith("/dokter/dashboard")
    ) {
      window.history.pushState(null, "", page === "Beranda" ? "/" : "/dokter")
    }
  }

  useEffect(() => {
    const syncDetailFromUrl = () => {
      const path = typeof window !== "undefined" ? window.location.pathname : ""
      if (path.startsWith("/layanan/") || (page === "Layanan" && initialDetailId)) {
        const rawId = path.startsWith("/layanan/")
          ? decodeURIComponent(path.slice("/layanan/".length))
          : initialDetailId || ""
        const matched = careServices.find((s) => slugMatch(s.id, s.name, rawId)) || null
        setServiceDetail(matched)
        setDoctorDetail(null)
      } else if (
        (path.startsWith("/dokter/") && !path.startsWith("/dokter/dashboard")) ||
        (page === "Dokter" && initialDetailId)
      ) {
        const rawId = path.startsWith("/dokter/")
          ? decodeURIComponent(path.slice("/dokter/".length))
          : initialDetailId || ""
        const matched = physicians.find((d) => slugMatch(d.id, d.name, rawId)) || null
        setDoctorDetail(matched)
        setServiceDetail(null)
      } else {
        setServiceDetail(null)
        setDoctorDetail(null)
      }
    }

    syncDetailFromUrl()
    window.addEventListener("popstate", syncDetailFromUrl)
    return () => window.removeEventListener("popstate", syncDetailFromUrl)
  }, [page, initialDetailId, services, doctors, schedules])

  const go = (target: string) => {
    setServiceDetail(null)
    setDoctorDetail(null)
    navigate(target)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const Brand = () => (
    <button
      className="web-brand"
      onClick={() => go("Beranda")}
      aria-label="SehatKlinik beranda"
    >
      <BrandArtwork />
    </button>
  )

  const SectionTitle = ({
    eyebrow,
    title,
    text,
  }: {
    eyebrow: string
    title: string
    text: string
  }) => {
    const inner = ["Profil", "Layanan", "Dokter", "Jadwal", "Lokasi"].includes(page)
    return (
      <div className={`web-section-title ${inner ? "cinema-page-hero" : ""}`}>
        <div className="cinema-title-copy">
          <span className="web-eyebrow">
            {eyebrow}
          </span>
          {inner ? <h1>{title}</h1> : <h2>{title}</h2>}
          <p>{text}</p>
          {inner && (
            <div className="cinema-hero-assurance">
              <Icon name="shield" size={16} />
              <span>Perawatan sepenuh hati. Hidup lebih berarti.</span>
            </div>
          )}
        </div>
        {inner && <CinematicArtwork page={page} Icon={Icon} />}
        {inner && (
          <span className="cinema-section-number">
            SEHATKLINIK / {page.toUpperCase()}
          </span>
        )}
      </div>
    )
  }

  const ServiceCards = () => (
    <div className="web-services">
      {careServices.map((s, i) => (
        <article className="web-service" key={s.name}>
          <div className="web-service-top">
            <span className="web-service-icon">
              <Icon name={s.icon} size={27} />
            </span>
            <span className="web-index">0{i + 1}</span>
          </div>
          <h3>{s.name}</h3>
          <p>{s.text}</p>
          <span className="web-service-tag">{s.tag}</span>
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <button
              style={{ flex: 1, padding: "8px 10px", fontSize: "11px" }}
              onClick={() => openServiceDetail(s)}
            >
              Rincian Layanan <Icon name="arrow" size={14} />
            </button>
            <button
              style={{
                background: "#eff6ff",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
                padding: "8px 12px",
                fontSize: "11px",
                borderRadius: "8px",
              }}
              onClick={onBook}
            >
              Daftar
            </button>
          </div>
        </article>
      ))}
    </div>
  )

  const DoctorCards = () => (
    <div className="web-doctors">
      {physicians.map((d) => {
        const fallbackSrc = getDoctorFallback(d.name)
        const imgSrc = d.image ? photo(d.image) : fallbackSrc
        return (
          <article className="web-doctor" key={d.id}>
            <div className="web-doctor-photo">
              <img
                src={imgSrc}
                alt={`${d.name}, ${d.specialty}`}
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget
                  target.onerror = null
                  target.src = fallbackSrc
                }}
              />
              <span>
                {d.day ? "Jadwal tersedia" : "Hubungi klinik"}
              </span>
            </div>
            <div className="web-doctor-info">
              <span>{d.specialty}</span>
              <h3>{d.name}</h3>

              {/* Riwayat Pendidikan & Almamater */}
              <div className="doctor-edu-preview">
                <span className="doctor-almamater-pill">
                  <Icon name="education" size={14} />
                  {d.almamater}
                </span>
                <span className="doctor-exp-tag">
                  {d.experienceYears}+ Tahun Pengalaman Klinis · {d.sip}
                </span>
              </div>

              <p suppressHydrationWarning>
                <Icon name="calendar" size={15} /> {d.day} <span>·</span> {d.time}
              </p>
              <button onClick={() => openDoctorDetail(d)}>
                Profil & Pendidikan Dokter <Icon name="arrow" size={17} />
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )

  const isAuth = page === "Login" || page === "Registrasi"

  return (
    <div
      className={`web sky-site cinema-public ${
        page === "Beranda" ? "is-home" : "is-inner"
      } cinema-page-${page.toLowerCase()}`}
    >
      <header className="web-header">
        <div className="web-header-inner">
          <Brand />
          <nav
            className={`web-navigation ${menuOpen ? "is-open" : ""}`}
            aria-label="Navigasi website"
          >
            {["Beranda", "Profil", "Layanan", "Dokter", "Jadwal", "Lokasi"].map((p) => (
              <button
                key={p}
                className={page === p ? "selected" : ""}
                onClick={() => go(p)}
              >
                {p}
              </button>
            ))}
            <div className="web-nav-mobile-actions">
              <button
                type="button"
                className="web-nav-mobile-login"
                onClick={() => go("Login")}
              >
                Masuk
              </button>
              <button
                type="button"
                className="web-nav-mobile-cta"
                onClick={() => {
                  setMenuOpen(false)
                  onBook()
                }}
              >
                Daftar Kunjungan <Icon name="arrow" size={16} />
              </button>
            </div>
          </nav>
          <div className="web-header-actions">
            <button className="web-login" onClick={() => go("Login")}>
              Masuk
            </button>
            <button className="web-button" onClick={onBook}>
              Daftar Kunjungan <Icon name="arrow" size={16} />
            </button>
            <button
              className="web-menu"
              aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      <main>
        {isAuth ? (
          <section className="web-auth web-container">
            <div className="web-auth-intro">
              <span className="web-eyebrow">LEBIH DEKAT, LEBIH PEDULI</span>
              <h1>
                Kesehatan keluarga,
                <br />
                <em>dalam genggaman Anda.</em>
              </h1>
              <p>
                Satu akun untuk mendaftar kunjungan, memantau antrean, dan
                melihat riwayat kunjungan Anda.
              </p>
              <div className="web-auth-benefits">
                {[
                  "Daftar tanpa antre panjang",
                  "Pantau kunjungan dengan mudah",
                  "Informasi pribadi tetap terlindungi",
                ].map((t) => (
                  <span key={t}>
                    <Icon name="check" />
                    {t}
                  </span>
                ))}
              </div>
              <img
                src={photo("/images/clinic-consultation.jpg")}
                alt="Konsultasi yang hangat bersama dokter"
              />
            </div>
            <div className="web-auth-form">
              <span className="web-service-icon">
                <Icon name="heart" size={27} />
              </span>
              <h2>
                {page === "Login"
                  ? "Senang bertemu Anda lagi."
                  : "Mulai perjalanan sehat Anda."}
              </h2>
              <p>
                {page === "Login"
                  ? "Masuk ke akun pasien untuk melanjutkan."
                  : "Daftar sebagai pasien Klinik Sehat Sentosa."}
              </p>
              <div className="web-prototype-note">
                <Icon name="help" size={16} />
                {page === "Login"
                  ? "Staf (Petugas, Dokter, Admin) wajib login menggunakan akun yang didaftarkan Administrator. Pasien dapat langsung masuk."
                  : "Daftar sebagai pasien baru untuk kemudahan reservasi antrean dan riwayat medis."}
              </div>
              <form onSubmit={handleAuthSubmit}>
                {authSuccess && (
                  <div
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      color: "#065f46",
                      fontSize: "12px",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Icon name="check" size={16} />
                    <span>{getErrorMessage(authSuccess)}</span>
                  </div>
                )}
                {loginError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      color: "#b91c1c",
                      fontSize: "12px",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Icon name="help" size={16} />
                    <span>{getErrorMessage(loginError)}</span>
                  </div>
                )}
                {page === "Registrasi" && (
                  <>
                    <label>
                      Nama lengkap
                      <input
                        required
                        autoComplete="name"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Nama sesuai identitas"
                      />
                    </label>
                    <label>
                      NIK (Nomor Induk Kependudukan)
                      <input
                        required
                        type="text"
                        pattern="[0-9]{16}"
                        maxLength={16}
                        value={regNik}
                        onChange={(e) => setRegNik(e.target.value.replace(/\D/g, ""))}
                        placeholder="16 digit NIK sesuai KTP"
                      />
                    </label>
                    <div className="web-input-grid">
                      <label>
                        Tanggal lahir
                        <input
                          required
                          type="date"
                          value={regBirth}
                          onChange={(e) => setRegBirth(e.target.value)}
                        />
                      </label>
                      <label>
                        Jenis kelamin
                        <select
                          required
                          value={regGender}
                          onChange={(e) => setRegGender(e.target.value)}
                        >
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Nomor telepon
                      <input
                        required
                        type="tel"
                        pattern="[0-9+]{8,16}"
                        autoComplete="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                        placeholder="08xxxxxxxxxx"
                      />
                    </label>
                  </>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value)
                      setLoginError("")
                    }}
                    placeholder="nama@sehatklinik.id"
                  />
                </label>
                <label>
                  Password
                  <div className="web-password">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value)
                        setLoginError("")
                      }}
                      autoComplete={
                        page === "Login" ? "current-password" : "new-password"
                      }
                      placeholder="Minimal 8 karakter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Sembunyikan" : "Lihat"}
                    </button>
                  </div>
                </label>
                <button className="web-button" type="submit" disabled={isSubmittingAuth}>
                  {isSubmittingAuth
                    ? "Memproses..."
                    : page === "Login"
                      ? "Masuk ke Dashboard"
                      : "Daftar Akun Pasien"}
                  <Icon name="arrow" size={18} />
                </button>
              </form>
              <p className="web-auth-switch">
                {page === "Login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setLoginError("")
                    setAuthSuccess("")
                    go(page === "Login" ? "Registrasi" : "Login")
                  }}
                >
                  {page === "Login" ? "Daftar sekarang" : "Masuk di sini"}
                </button>
              </p>
              <small>
                <Icon name="shield" size={13} /> Data Anda dijaga dengan aman
                dan rahasia.
              </small>
            </div>
          </section>
        ) : page === "Profil" ? (
          /* =================================================================
             HALAMAN PROFIL KLINIK (SESUAI GAYA DOKTER & JADWAL)
             ================================================================= */
          <section className="web-container web-inner-page clinic-profile-page">
            <SectionTitle
              eyebrow="TENTANG SEHATKLINIK"
              title="Mengenal kami. Merasa lebih dekat."
              text="Pelayanan kesehatan untuk seluruh keluarga dengan komitmen mutu, keterbukaan komunikasi, dan kenyamanan di setiap kunjungan."
            />

            {/* Top Grid: Profil Utama & Informasi Kunjungan */}
            <div className="clinic-profile-top-grid">
              {/* Left Card: Profil Klinik */}
              <div className="clinic-profile-card clinic-profile-main-card">
                <span className="clinic-profile-eyebrow">RINGKASAN KLINIK</span>
                <h2 className="clinic-profile-title">Klinik Sehat Sentosa</h2>

                <div className="clinic-profile-content">
                  <p>
                    SehatKlinik dirancang sebagai ruang pelayanan kesehatan rawat jalan untuk membantu pasien dan keluarga memahami kondisi kesehatannya, mendapatkan konsultasi, dan merencanakan perawatan berikutnya.
                  </p>
                  <p>
                    Pelayanan dimulai dari pendaftaran, konfirmasi kehadiran, pemeriksaan oleh dokter, hingga ringkasan hasil kunjungan. Setiap tahap dibuat lebih jelas agar pasien tahu apa yang perlu dipersiapkan dan dilakukan.
                  </p>
                  <p>
                    Konsultasi tersedia sesuai layanan dan jadwal dokter yang aktif. Jika kondisi membutuhkan pemeriksaan atau penanganan di luar cakupan klinik, dokter dapat menyarankan rujukan ke fasilitas yang sesuai.
                  </p>
                </div>

                <div className="clinic-profile-notice">
                  <span className="clinic-notice-icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01" />
                    </svg>
                  </span>
                  <p>
                    Profil ini merupakan narasi ilustrasi prototipe klinik rawat jalan, bukan klaim sebagai rumah sakit atau layanan rawat inap.
                  </p>
                </div>
              </div>

              {/* Right Card: Informasi Kunjungan */}
              <div className="clinic-profile-card clinic-visit-info-card">
                <div className="clinic-visit-header">
                  <span className="clinic-visit-badge-icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="4" y="3" width="16" height="18" rx="2" />
                      <path d="M9 10h6" />
                      <path d="M12 7v6" />
                      <path d="M9 18h6" />
                    </svg>
                  </span>
                  <h2 className="clinic-visit-title">Informasi kunjungan</h2>
                </div>

                <div className="clinic-visit-meta-list">
                  <div className="clinic-visit-meta-item">
                    <span className="clinic-meta-label">Alamat</span>
                    <span className="clinic-meta-value">
                      Jl. Melati No. 18, Jakarta Selatan
                    </span>
                  </div>
                  <div className="clinic-visit-meta-item">
                    <span className="clinic-meta-label">Jam operasional</span>
                    <span className="clinic-meta-value">
                      Senin – Sabtu, 08.00 – 20.00 WIB
                    </span>
                  </div>
                  <div className="clinic-visit-meta-item">
                    <span className="clinic-meta-label">Informasi & pendaftaran</span>
                    <span className="clinic-meta-value">
                      021-555-0123
                    </span>
                  </div>
                  <div className="clinic-visit-meta-item">
                    <span className="clinic-meta-label">Jenis pelayanan</span>
                    <span className="clinic-meta-value">
                      Konsultasi dan pemeriksaan rawat jalan
                    </span>
                  </div>
                </div>

                <button
                  className="clinic-visit-action-btn"
                  onClick={() => go("Lokasi")}
                >
                  <span>Lokasi & petunjuk arah</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14m-5-5 5 5-5 5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Bottom Grid: 3 Pilar Utama (Visi, Misi, Nilai) */}
            <div className="clinic-profile-bottom-grid">
              <div className="clinic-profile-card clinic-pillar-card">
                <span className="clinic-pillar-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
                    <path d="M3 12h5l2-4 3 8 2-4h6" />
                  </svg>
                </span>
                <h3 className="clinic-pillar-title">Visi kami</h3>
                <p className="clinic-pillar-desc">
                  Menjadi ruang pelayanan kesehatan yang mudah dipahami, dekat dengan kebutuhan keluarga, dan berorientasi pada pasien.
                </p>
              </div>

              <div className="clinic-profile-card clinic-pillar-card">
                <span className="clinic-pillar-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <h3 className="clinic-pillar-title">Misi pelayanan</h3>
                <p className="clinic-pillar-desc">
                  Mendengarkan keluhan, menjelaskan hasil pemeriksaan dengan bahasa yang jelas, dan membantu pasien menentukan langkah berikutnya.
                </p>
              </div>

              <div className="clinic-profile-card clinic-pillar-card">
                <span className="clinic-pillar-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
                <h3 className="clinic-pillar-title">Nilai yang dijaga</h3>
                <p className="clinic-pillar-desc">
                  Kepedulian, komunikasi yang terbuka, serta penghormatan terhadap privasi informasi kesehatan pasien.
                </p>
              </div>
            </div>
          </section>
        ) : page === "Layanan" ? (
          /* =================================================================
             HALAMAN LAYANAN (SERVICES) SESUAI DESAIN USER
             ================================================================= */
          <section className="web-container web-inner-page services-page-wrap">
            <SectionTitle
              eyebrow="LAYANAN MEDIS"
              title="Perawatan tepat, untuk setiap kebutuhan."
              text="Pelayanan kesehatan menyeluruh dengan pendekatan yang personal, untuk setiap tahap kehidupan Anda."
            />

            {/* Overview Cards Grid (Klik kartu membuka pop-up detail layanan) */}
            <div className="services-cards-grid">
              {careServices.map((s, idx) => (
                <div key={s.id} className="service-new-card">
                  <div className="service-card-corner-curve">
                    <span className="service-card-num">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="service-card-icon-wrap">
                    <Icon name={s.icon} size={20} />
                  </div>

                  <h3 className="service-card-title">{s.name}</h3>
                  <p className="service-card-desc">{s.text}</p>
                  <span className="service-card-duration">{s.tag}</span>

                  <div className="service-card-divider" />

                  <button
                    type="button"
                    className="service-card-action-link"
                    onClick={() => openServiceDetail(s)}
                  >
                    <span>Lihat detail layanan</span>
                    <span className="service-card-arrow">&rarr;</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : page === "Dokter" ? (
          /* =================================================================
             HALAMAN DOKTER & PENDIDIKAN DOKTER
             ================================================================= */
          <section className="web-container web-inner-page">
            <SectionTitle
              eyebrow="TIM MEDIS KAMI"
              title="Dokter pilihan. Perhatian sepenuh hati."
              text="Kenali tim medis bersertifikasi resmi yang siap mendengarkan, memahami, dan mendampingi perjalanan sehat keluarga Anda dengan keahlian klinis terpercaya."
            />
            <DoctorCards />
            <p className="web-photo-note">
              Foto profil merupakan representasi profesional dokter di Klinik Sehat Sentosa. Seluruh dokter memiliki SIP dan STR aktif terdaftar di Kemenkes RI.
            </p>
          </section>
        ) : page === "Jadwal" ? (
          <section className="web-container web-inner-page">
            <SectionTitle
              eyebrow="JADWAL PRAKTIK"
              title="Waktu yang tepat untuk merawat diri."
              text="Pilih tanggal dan lihat sesi dokter beserta sisa kuota. Masuk sebagai pasien untuk mendaftar kunjungan."
            />
            <div className="web-schedule-tools">
              <label>
                Tanggal kunjungan
                <input
                  type="date"
                  min={DEMO_DATE}
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </label>
              <label>
                Dokter
                <select
                  value={scheduleDoctor}
                  onChange={(e) => setScheduleDoctor(e.target.value)}
                >
                  <option value="">Semua dokter</option>
                  {physicians.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="web-schedule-caption" suppressHydrationWarning>
              {formatDateIndonesian(scheduleDate, true)} · Jadwal praktik dokter aktif
            </p>
            <div className="web-schedule-list">
              {schedules
                .filter(
                  (s) =>
                    s.active &&
                    doctors.some((d) => d.id === s.doctor && d.active) &&
                    (!scheduleDoctor || s.doctor === scheduleDoctor) &&
                    s.day === new Date(`${scheduleDate}T12:00:00`).getDay(),
                )
                .map((s) => {
                  const d = physicians.find((d) => d.id === s.doctor)
                  const left = remaining(s, scheduleDate, visits)
                  return (
                    <article key={s.id}>
                      <span className="web-service-icon">
                        <Icon name="calendar" size={23} />
                      </span>
                      <div>
                        <h3>{d?.name}</h3>
                        <p>
                          {d?.specialty} · {s.start} – {s.end} WIB
                        </p>
                        <small>
                          {d?.services
                            .map(
                              (id) =>
                                services.find((service) => service.id === id)
                                  ?.name,
                            )
                            .join(" · ")}
                        </small>
                      </div>
                      <span
                        className={left ? "web-quota available" : "web-quota"}
                      >
                        {left
                          ? `${left} dari ${s.quota} kuota tersisa`
                          : "Kuota penuh"}
                      </span>
                      <button
                        className="web-button"
                        onClick={onBook}
                        disabled={!left}
                      >
                        {left ? "Daftar Kunjungan" : "Sesi Penuh"}
                        {left > 0 && <Icon name="arrow" size={15} />}
                      </button>
                    </article>
                  )
                })}
            </div>
            {!schedules.some(
              (s) =>
                s.active &&
                doctors.some((d) => d.id === s.doctor && d.active) &&
                (!scheduleDoctor || s.doctor === scheduleDoctor) &&
                s.day === new Date(`${scheduleDate}T12:00:00`).getDay(),
            ) && (
              <div className="web-schedule-empty">
                <Icon name="calendar" size={32} />
                <h3>Belum ada sesi pada tanggal ini</h3>
                <p>
                  Pilih tanggal lain atau hubungi klinik untuk informasi jadwal.
                </p>
              </div>
            )}
            <div className="web-prototype-note">
              <Icon name="shield" size={18} />
              Nomor antrean diterbitkan per dokter dan tanggal. Kuota dan
              pendaftaran pada halaman ini merupakan simulasi.
            </div>
          </section>
        ) : page === "Lokasi" ? (
          <section className="web-container web-inner-page">
            <SectionTitle
              eyebrow="TEMUKAN KAMI"
              title="Dekat dengan Anda dan keluarga."
              text={clinic.description}
            />
            <div className="web-location-grid">
              <div className="web-location-info">
                <span className="web-service-icon">
                  <Icon name="clinic" size={26} />
                </span>
                <h3>{clinic.name}</h3>
                <p>
                  {clinic.address}
                  <br />
                  DKI Jakarta, Indonesia
                </p>
                <div>
                  <Icon name="clock" />
                  <span>
                    Jam operasional<b>{clinic.hours}</b>
                  </span>
                </div>
                <div>
                  <Icon name="help" />
                  <span>
                    Informasi & pendaftaran
                    <a href={`tel:${clinic.phone.replace(/[^+0-9]/g, "")}`}>
                      {clinic.phone}
                    </a>
                  </span>
                </div>
                <div>
                  <Icon name="shield" />
                  <span>
                    Layanan Darurat Ringan 24 Jam
                    <a href="tel:0215550911">021-555-0911</a>
                  </span>
                </div>
                <a
                  className="web-button"
                  href={`https://www.openstreetmap.org/?mlat=${clinic.latitude}&mlon=${clinic.longitude}#map=16/${clinic.latitude}/${clinic.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka di OpenStreetMap <Icon name="arrow" size={17} />
                </a>
              </div>
              <div className="web-map web-real-map">
                <ClinicMap
                  latitude={clinic.latitude}
                  longitude={clinic.longitude}
                  name={clinic.name}
                  address={clinic.address}
                />
                <small>
                  © OpenStreetMap contributors · Koordinat: {clinic.latitude},{" "}
                  {clinic.longitude}
                </small>
              </div>
            </div>
          </section>
        ) : (
          /* =================================================================
             HALAMAN BERANDA (HOME) DENGAN HIGHLIGHT PROFIL & LAYANAN
             ================================================================= */
          <>
            <section className="sky-hero">
              <div className="sky-hero-heading">
                <h1 className="sky-home-title">
                  Perawatan sepenuh hati.
                  <br />
                  Hidup lebih berarti.
                </h1>
                <p>
                  Kesehatan yang lebih dekat, dengan perhatian
                  <br className="sky-desktop-break" /> yang benar-benar memahami
                  Anda dan keluarga.
                </p>
                <div className="sky-hero-actions">
                  <button className="web-button" onClick={onBook}>
                    Mulai Hidup Lebih Sehat{" "}
                    <span>
                      <Icon name="arrow" size={16} />
                    </span>
                  </button>
                  <button
                    className="sky-hero-secondary-btn"
                    onClick={() => go("Profil")}
                  >
                    Pelajari Profil Klinik <Icon name="arrow" size={16} />
                  </button>
                </div>
              </div>
              <div className="sky-hero-scene">
                <img
                  className="sky-hand"
                  src="/images/hero-doctor.png"
                  alt="Dokter dengan jas putih dan stetoskop menyambut Anda"
                  fetchPriority="high"
                />
                <div className="sky-float sky-float-left">
                  <span className="sky-float-label">
                    Kunjungan Anda <Icon name="calendar" size={16} />
                  </span>
                  <div className="sky-appointment">
                    <span className="sky-round-icon">
                      <Icon name="heart" size={19} />
                    </span>
                    <div>
                      <b>Kesehatan dimulai dari sini.</b>
                      <small>Pilih dokter dan jadwal yang sesuai</small>
                    </div>
                  </div>
                  <button onClick={onBook}>
                    Daftar kunjungan <Icon name="arrow" size={14} />
                  </button>
                </div>
                <div className="sky-float sky-float-right">
                  <span className="sky-float-label">
                    Selalu ada untuk Anda
                  </span>
                  <div className="sky-wave" aria-hidden="true">
                    <svg viewBox="0 0 200 55">
                      <path d="M0 30h35l12-9 15 18 17-32 18 44 17-28 12 10 15-6h59" />
                    </svg>
                  </div>
                  <span className="sky-support-caption">
                    Perawatan yang tumbuh bersama Anda
                  </span>
                </div>
              </div>
              <div className="sky-hero-bottom">
                <span>
                  <Icon name="shield" size={14} /> Terakreditasi Paripurna Kemenkes
                </span>
                <span>
                  <Icon name="clock" size={14} /> Senin – Sabtu · 08.00 – 20.00
                </span>
                <span>
                  <Icon name="clinic" size={14} /> Kebayoran Baru, Jakarta Selatan
                </span>
              </div>
            </section>


            <section className="sky-editorial web-container">
              <div className="sky-editorial-heading">
                <h2>
                  Menghadirkan kepedulian
                  <br />
                  di setiap langkah sehat Anda.
                </h2>
                <p>
                  Kami percaya, pelayanan kesehatan terbaik
                  <br />
                  dimulai dengan memahami manusia
                  <br />
                  di balik setiap cerita.
                </p>
              </div>
              <div className="sky-gallery">
                <figure className="sky-gallery-small">
                  <img
                    src={photo("/images/doctor-portrait-woman.jpg")}
                    alt="Tenaga medis yang siap mendampingi Anda"
                    loading="lazy"
                  />
                  <figcaption>Keahlian yang Anda percaya</figcaption>
                </figure>
                <figure className="sky-gallery-feature">
                  <img
                    src={photo("/images/clinic-consultation.jpg")}
                    alt="Konsultasi personal antara dokter dan pasien"
                    loading="lazy"
                  />
                  <figcaption>
                    <span className="web-eyebrow">
                      LEBIH DARI SEKADAR PERAWATAN
                    </span>
                    <h3>
                      Anda didengar.
                      <br />
                      Anda diperhatikan.
                    </h3>
                    <p>
                      Pendampingan personal, sesuai kebutuhan Anda dan keluarga.
                    </p>
                    <button
                      onClick={() => go("Dokter")}
                      aria-label="Kenali dokter kami"
                    >
                      <Icon name="arrow" size={18} />
                    </button>
                  </figcaption>
                </figure>
                <figure className="sky-gallery-small sky-gallery-last">
                  <img
                    src="/images/soft-clouds.jpg"
                    alt="Langit cerah sebagai simbol hidup yang lebih sehat"
                    loading="lazy"
                  />
                  <figcaption>Untuk hari-hari yang lebih baik</figcaption>
                </figure>
              </div>
            </section>

            <section className="web-container web-section">
              <div className="web-section-top">
                <SectionTitle
                  eyebrow="LAYANAN KESEHATAN"
                  title="Satu tempat, berbagai kebutuhan."
                  text="Dari pemeriksaan rutin hingga perawatan khusus, kesehatan keluarga Anda ada di tangan yang tepat."
                />
                <button
                  className="web-inline-link"
                  onClick={() => go("Layanan")}
                >
                  Semua rincian layanan <Icon name="arrow" size={18} />
                </button>
              </div>
              <ServiceCards />
            </section>

            <section className="web-how-wrap">
              <div className="web-container web-how">
                <div>
                  <span className="web-eyebrow">
                    LANGKAH SEDERHANA, DAMPAK BERMAKNA
                  </span>
                  <h2>
                    Perjalanan sehat Anda.
                    <br />
                    Dimulai dengan mudah.
                  </h2>
                  <p>
                    Lebih sedikit waktu untuk mengantre. Lebih banyak waktu
                    untuk hal-hal yang berarti. Didukung notifikasi Web Push real-time.
                  </p>
                  <button className="web-button" onClick={onBook}>
                    Mulai Pendaftaran <Icon name="arrow" size={17} />
                  </button>
                  <span className="web-how-safe">
                    <Icon name="shield" size={16} /> Informasi pribadi Anda aman
                    bersama kami.
                  </span>
                </div>
                <div className="web-steps">
                  {[
                    [
                      "01",
                      "Pilih layanan & dokter",
                      "Temukan pendamping yang tepat untuk kebutuhan Anda.",
                    ],
                    [
                      "02",
                      "Tentukan waktu terbaik",
                      "Pilih tanggal dan sesi kunjungan yang paling nyaman.",
                    ],
                    [
                      "03",
                      "Kami siap menyambut Anda",
                      "Pantau antrean dari ponsel, terima notifikasi panggilan otomatis.",
                    ],
                  ].map((s) => (
                    <div key={s[0]}>
                      <span>{s[0]}</span>
                      <div>
                        <h3>{s[1]}</h3>
                        <p>{s[2]}</p>
                      </div>
                      <Icon
                        name={s[0] === "03" ? "check" : "arrow"}
                        size={19}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="web-container web-section">
              <div className="web-section-top">
                <SectionTitle
                  eyebrow="KENALI DOKTER KAMI"
                  title="Keahlian yang Anda percaya."
                  text="Tim medis berpengalaman yang tidak hanya merawat, tetapi juga mendengarkan sepenuh hati."
                />
                <button
                  className="web-inline-link"
                  onClick={() => go("Dokter")}
                >
                  Lihat semua dokter <Icon name="arrow" size={18} />
                </button>
              </div>
              <DoctorCards />
            </section>

            <section className="web-container web-values">
              <span className="web-service-icon">
                <Icon name="heart" size={30} />
              </span>
              <blockquote>
                “Bagi kami, pelayanan yang baik dimulai dari mendengarkan.
                Karena di balik setiap keluhan, ada seseorang yang ingin merasa
                lebih baik.”
              </blockquote>
              <span>FILOSOFI PELAYANAN SEHATKLINIK</span>
            </section>
          </>
        )}

        {!isAuth && (
          <section className="web-container web-cta">
            <div>
              <span className="web-eyebrow">
                LANGKAH PERTAMA MENUJU LEBIH SEHAT
              </span>
              <h2>Jangan tunda untuk merasa lebih baik.</h2>
              <p>Kami siap mendampingi perjalanan sehat Anda dan keluarga.</p>
            </div>
            <button className="web-button" onClick={onBook}>
              Daftar Kunjungan Sekarang <Icon name="arrow" size={18} />
            </button>
            <Icon name="heart" size={185} />
          </section>
        )}
      </main>

      <footer className="web-footer">
        <div className="web-container">
          <div className="web-footer-main">
            <div className="web-footer-about">
              <Brand />
              <p>
                Pelayanan kesehatan yang lebih dekat,
                <br />
                lebih mudah, dan lebih peduli.
                <br />
                Untuk Anda dan keluarga.
              </p>
              <div className="web-footer-promise">
                <Icon name="shield" size={19} />
                <span>
                  Peduli pada Anda.
                  <br />
                  <b>Terakreditasi Paripurna Kemenkes RI.</b>
                </span>
              </div>
            </div>
            <div className="web-footer-column">
              <h3>Jelajahi</h3>
              {["Beranda", "Profil", "Layanan", "Dokter", "Jadwal", "Lokasi"].map((p) => (
                <button key={p} onClick={() => go(p)}>
                  {p}
                </button>
              ))}
            </div>
            <div className="web-footer-column">
              <h3>Untuk Pasien</h3>
              <button onClick={onBook}>Daftar Kunjungan</button>
              <button onClick={() => go("Login")}>Masuk ke Akun</button>
              <button onClick={() => go("Registrasi")}>
                Registrasi Pasien
              </button>
              <button onClick={() => go("Profil")}>Profil Klinik</button>
              <button onClick={() => go("Lokasi")}>Informasi Lokasi</button>
            </div>
            <div className="web-footer-contact">
              <h3>Mari terhubung</h3>
              <a
                href={`https://www.openstreetmap.org/?mlat=${clinic.latitude}&mlon=${clinic.longitude}#map=16/${clinic.latitude}/${clinic.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="clinic" size={18} />
                <span>{clinic.address}</span>
              </a>
              <a href={`tel:${clinic.phone.replace(/[^+0-9]/g, "")}`}>
                <Icon name="help" size={18} />
                {clinic.phone}
              </a>
              <a href="mailto:halo@sehatklinik.id">
                <Icon name="file" size={18} />
                halo@sehatklinik.id
              </a>
              <div className="web-footer-hours">
                <span>
                  Jam pelayanan
                </span>
                <b>{clinic.hours}</b>
              </div>
            </div>
          </div>
          <div className="web-footer-bottom">
            <span>© 2026 SehatKlinik Sentosa · Sistem Informasi Klinik Kesehatan Terpadu</span>
            <span className="web-footer-made">
              <Icon name="heart" size={14} /> Dirancang dengan kepedulian & kehangatan.
            </span>
          </div>
        </div>
      </footer>

      {/* =================================================================
         MODAL DETAIL DOKTER LENGKAP DENGAN RIWAYAT PENDIDIKAN
         ================================================================= */}
      {doctorDetail && (
        <div className="web-dialog-backdrop" onClick={closeDoctorDetail}>
          <section
            className="web-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="web-dialog-title"
            style={{ maxWidth: "600px", maxHeight: "88vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="web-dialog-close"
              aria-label="Tutup detail dokter"
              onClick={closeDoctorDetail}
            >
              <Icon name="close" />
            </button>

            <div style={{ display: "flex", gap: "14px", alignItems: "center", marginBottom: "16px" }}>
              <span className="web-service-icon" style={{ width: "48px", height: "48px" }}>
                <Icon name="users" size={24} />
              </span>
              <div>
                <span className="web-eyebrow">PROFIL TENAGA MEDIS</span>
                <h2 id="web-dialog-title" style={{ margin: "2px 0", fontSize: "20px" }}>
                  {doctorDetail.name}
                </h2>
                <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
                  {doctorDetail.specialty}
                </span>
              </div>
            </div>

            {/* Legalitas & STR */}
            <div className="doctor-legal-row">
              <span><b>No. SIP:</b> {doctorDetail.sip}</span>
              <span><b>No. STR:</b> {doctorDetail.str}</span>
              <span><b>Pengalaman:</b> {doctorDetail.experienceYears}+ Tahun</span>
            </div>

            <p style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.6, margin: "0 0 16px" }}>
              {doctorDetail.bio}
            </p>

            {/* Section Pendidikan Dokter */}
            <div className="doctor-modal-education">
              <h4>
                <Icon name="education" size={16} />
                Riwayat Pendidikan Kedokteran
              </h4>
              <div className="doctor-edu-timeline">
                {doctorDetail.education.map((edu, idx) => (
                  <div key={idx} className="doctor-edu-item">
                    <h5 className="doctor-edu-degree">{edu.degree}</h5>
                    <p className="doctor-edu-inst">{edu.institution}</p>
                    <div className="doctor-edu-meta">
                      {edu.year && <span>{edu.year}</span>}
                      {edu.honor && <span>· <b>{edu.honor}</b></span>}
                    </div>
                  </div>
                ))}
              </div>

              {doctorDetail.certifications && doctorDetail.certifications.length > 0 && (
                <>
                  <h4>
                    <Icon name="award" size={16} />
                    Sertifikasi & Kualifikasi Tambahan
                  </h4>
                  <div className="doctor-cert-list">
                    {doctorDetail.certifications.map((c, i) => (
                      <div key={i} className="doctor-cert-badge">
                        <Icon name="check" size={14} />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {(() => {
              const docSched = schedules.find((s) => s.doctor === doctorDetail.id && s.active)
              const docDay = docSched ? ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][docSched.day] : "Senin"
              const docTime = docSched ? `${docSched.start} – ${docSched.end} WIB` : "08.00 – 12.00 WIB"
              return (
                <div className="web-care-note" style={{ margin: "16px 0" }}>
                  <Icon name="calendar" size={20} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Jadwal Praktik Aktif:</span>
                    <b style={{ display: "block", fontSize: "12.5px", color: "#1e293b" }}>
                      {docDay} · {docTime}
                    </b>
                  </div>
                </div>
              )
            })()}

            <button
              className="web-button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setDoctorDetail(null)
                onBook()
              }}
            >
              Daftar Kunjungan Bersama {doctorDetail.name.split(" ")[0]} {doctorDetail.name.split(" ")[1]}{" "}
              <Icon name="arrow" size={17} />
            </button>
          </section>
        </div>
      )}

      {/* =================================================================
         MODAL RINCIAN DETAIL LAYANAN KLINIK
         ================================================================= */}
      {serviceDetail && (() => {
        const meta = getServiceExtendedMeta(serviceDetail)
        const serviceIcon =
          careServices.find((c) => c.id === serviceDetail.id)?.icon || "heart"
        return (
          <div className="web-dialog-backdrop" onClick={closeServiceDetail}>
            <section
              className="web-dialog web-dialog-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-dialog-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="web-dialog-close"
                aria-label="Tutup detail layanan"
                onClick={closeServiceDetail}
              >
                <Icon name="close" />
              </button>

              <div className="dialog-entity-head">
                <span className="web-service-icon dialog-entity-icon">
                  <Icon name={serviceIcon} size={22} />
                </span>
                <div>
                  <span className="web-eyebrow">DETAIL LAYANAN KLINIK</span>
                  <h2 id="service-dialog-title">{serviceDetail.name}</h2>
                  <span className="dialog-entity-sub">
                    Estimasi konsultasi ± {serviceDetail.duration} menit per sesi
                  </span>
                </div>
              </div>

              <div className="doctor-legal-row">
                <span>
                  <b>Durasi:</b> ± {serviceDetail.duration} menit
                </span>
                <span>
                  <b>Pendaftaran:</b> Online & Walk-in
                </span>
                <span>
                  <b>Status:</b> Tersedia
                </span>
              </div>

              <p className="dialog-entity-lead">
                {meta.summary || serviceDetail.overview || serviceDetail.description}
              </p>

              <div className="service-modal-columns">
                <div className="service-modal-col">
                  <h4>Cakupan pelayanan</h4>
                  <ul>
                    {meta.scopes.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="service-modal-col">
                  <h4>Yang perlu dipersiapkan</h4>
                  <ul>
                    {meta.preparations.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="service-modal-flow">
                <h4>Alur konsultasi</h4>
                <div className="service-modal-flow-grid">
                  {meta.flow.map((fl) => (
                    <div key={fl.step} className="service-modal-flow-step">
                      <span>{fl.step}</span>
                      <p>{fl.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {meta.alert && (
                <div className="web-care-note service-modal-note">
                  <Icon name="info" size={18} />
                  <p>{meta.alert}</p>
                </div>
              )}

              <button
                className="web-button"
                onClick={() => {
                  setServiceDetail(null)
                  onBook()
                }}
              >
                Daftar Kunjungan ke {serviceDetail.name}{" "}
                <Icon name="arrow" size={17} />
              </button>
            </section>
          </div>
        )
      })()}
    </div>
  )
}
