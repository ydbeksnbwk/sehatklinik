"use client"

import { useState, type ComponentType } from "react"
import BrandArtwork from "./BrandArtwork"
import CinematicArtwork from "./CinematicArtwork"
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
  }
}

const photo = (id: string, width = 700) =>
  id.startsWith("/")
    ? id
    : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`

export default function PublicSite({
  Icon,
  page,
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState(DEMO_DATE)
  const [scheduleDoctor, setScheduleDoctor] = useState("")
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
        image: portraits[i],
      }
    })
  const go = (target: string) => {
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
    const inner = ["Layanan", "Dokter", "Jadwal", "Lokasi"].includes(page)
    return (
      <div className={`web-section-title ${inner ? "cinema-page-hero" : ""}`}>
        <div className="cinema-title-copy">
          <span className="web-eyebrow">
            {inner && <i className="cinema-eyebrow-dot" />}
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
        {inner && page !== "Layanan" && (
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
          <button onClick={onBook}>
            Jelajahi layanan <Icon name="arrow" size={18} />
          </button>
        </article>
      ))}
    </div>
  )
  const DoctorCards = () => (
    <div className="web-doctors">
      {physicians.map((d) => (
        <article className="web-doctor" key={d.id}>
          <div className="web-doctor-photo">
            {d.image ? (
              <img
                src={photo(d.image)}
                alt={`${d.name}, ${d.specialty}`}
                loading="lazy"
              />
            ) : (
              <div className="web-doctor-placeholder">
                <Icon name="users" size={48} />
                <b>{d.name}</b>
              </div>
            )}
            <span>
              <i /> {d.day ? "Jadwal tersedia" : "Hubungi klinik"}
            </span>
          </div>
          <div className="web-doctor-info">
            <span>{d.specialty}</span>
            <h3>{d.name}</h3>
            <p>
              <Icon name="calendar" size={15} /> {d.day} <span>·</span> {d.time}
            </p>
            <button onClick={() => setDetail(d.name)}>
              Lihat profil dokter <Icon name="arrow" size={17} />
            </button>
          </div>
        </article>
      ))}
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
            {["Beranda", "Layanan", "Dokter", "Jadwal", "Lokasi"].map((p) => (
              <button
                key={p}
                className={page === p ? "selected" : ""}
                onClick={() => go(p)}
              >
                {p}
              </button>
            ))}
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
                Pratinjau desain: formulir ini membuka akun pasien demo Andi,
                bukan autentikasi. Jangan gunakan kredensial asli.
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  onLogin()
                }}
              >
                {page === "Registrasi" && (
                  <>
                    <label>
                      Nama lengkap
                      <input
                        required
                        autoComplete="name"
                        placeholder="Nama sesuai identitas"
                      />
                    </label>
                    <div className="web-input-grid">
                      <label>
                        Tanggal lahir
                        <input required type="date" />
                      </label>
                      <label>
                        Jenis kelamin
                        <select required>
                          <option value="">Pilih</option>
                          <option>Laki-laki</option>
                          <option>Perempuan</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Nomor telepon
                      <input
                        required
                        type="tel"
                        pattern="[0-9+() -]{8,16}"
                        autoComplete="tel"
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
                    defaultValue={page === "Login" ? "andi@sehatklinik.id" : ""}
                    placeholder="nama@email.com"
                  />
                </label>
                <label>
                  Password
                  <div className="web-password">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      defaultValue={page === "Login" ? "password123" : ""}
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
                <button className="web-button" type="submit">
                  {page === "Login"
                    ? "Buka Demo Pasien"
                    : "Pratinjau Akun Pasien"}
                  <Icon name="arrow" size={18} />
                </button>
                {page === "Login" && (
                  <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #eef2f7" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", fontWeight: 500 }}>
                      Pilih Cepat Akses Peran Demo:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: "8px 10px", fontSize: "11px", justifyContent: "flex-start", gap: "6px" }}
                        onClick={() => onRole("Pasien")}
                      >
                        <span className="avatar blue" style={{ width: "20px", height: "20px", fontSize: "9px" }}>P</span>
                        Demo Pasien
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: "8px 10px", fontSize: "11px", justifyContent: "flex-start", gap: "6px" }}
                        onClick={() => onRole("Petugas")}
                      >
                        <span className="avatar amber" style={{ width: "20px", height: "20px", fontSize: "9px" }}>L</span>
                        Demo Petugas
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: "8px 10px", fontSize: "11px", justifyContent: "flex-start", gap: "6px" }}
                        onClick={() => onRole("Dokter")}
                      >
                        <span className="avatar green" style={{ width: "20px", height: "20px", fontSize: "9px" }}>D</span>
                        Demo Dokter
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: "8px 10px", fontSize: "11px", justifyContent: "flex-start", gap: "6px" }}
                        onClick={() => onRole("Admin")}
                      >
                        <span className="avatar purple" style={{ width: "20px", height: "20px", fontSize: "9px" }}>A</span>
                        Demo Admin
                      </button>
                    </div>
                  </div>
                )}
              </form>
              <p className="web-auth-switch">
                {page === "Login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
                <button
                  onClick={() => go(page === "Login" ? "Registrasi" : "Login")}
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
        ) : page === "Layanan" ? (
          <section className="web-container web-inner-page">
            <SectionTitle
              eyebrow=" "
              title="Perawatan tepat, untuk setiap kebutuhan."
              text="Pelayanan kesehatan menyeluruh dengan pendekatan yang personal, untuk setiap tahap kehidupan Anda."
            />
            <ServiceCards />
            <div className="web-care-note">
              <Icon name="help" size={24} />
              <div>
                <h3>Belum tahu layanan yang Anda butuhkan?</h3>
                <p>
                  Tim kami akan membantu mengarahkan Anda ke layanan yang tepat.
                </p>
              </div>
              <a href={`tel:${clinic.phone.replace(/[^+0-9]/g, "")}`}>
                Hubungi kami <Icon name="arrow" size={17} />
              </a>
            </div>
          </section>
        ) : page === "Dokter" ? (
          <section className="web-container web-inner-page">
            <SectionTitle
              eyebrow="TIM MEDIS KAMI"
              title="Dokter pilihan. Perhatian sepenuh hati."
              text="Kenali tim medis yang siap mendengarkan, memahami, dan mendampingi perjalanan sehat Anda."
            />
            <DoctorCards />
            <p className="web-photo-note">
              Foto merupakan ilustrasi profil untuk keperluan prototipe.
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
            <p className="web-schedule-caption">
              {dateLabel(scheduleDate)} · Data simulasi, jadwal demo tersedia
              setiap Senin
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
                <iframe
                  title={`Peta lokasi ${clinic.name}`}
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(clinic.longitude) - 0.008},${Number(clinic.latitude) - 0.005},${Number(clinic.longitude) + 0.008},${Number(clinic.latitude) + 0.005}&layer=mapnik&marker=${clinic.latitude},${clinic.longitude}`}
                />
                <small>
                  © OpenStreetMap contributors · Lokasi klinik simulasi
                </small>
              </div>
            </div>
          </section>
        ) : (
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
                  Anda.
                </p>
                <button className="web-button" onClick={onBook}>
                  Mulai Hidup Lebih Sehat{" "}
                  <span>
                    <Icon name="arrow" size={16} />
                  </span>
                </button>
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
                    Selalu ada untuk Anda <span className="sky-mini-dot" />
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
                  <Icon name="shield" size={14} /> Tenaga medis profesional
                </span>
                <span>
                  <Icon name="clock" size={14} /> Senin – Sabtu · 08.00 – 20.00
                </span>
                <span>
                  <Icon name="clinic" size={14} /> Jakarta Selatan
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
                  Semua layanan <Icon name="arrow" size={18} />
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
                    untuk hal-hal yang berarti.
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
                      "Datang sesuai jadwal, tunjukkan nomor antrean Anda.",
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
                  text="Tim medis yang tidak hanya merawat, tetapi juga mendengarkan."
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
                  <b>Terpercaya untuk keluarga.</b>
                </span>
              </div>
            </div>
            <div className="web-footer-column">
              <h3>Jelajahi</h3>
              {["Beranda", "Layanan", "Dokter", "Jadwal", "Lokasi"].map((p) => (
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
              <button onClick={() => go("Lokasi")}>Informasi Klinik</button>
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
                  <i /> Jam pelayanan
                </span>
                <b>{clinic.hours}</b>
              </div>
            </div>
          </div>
          <div className="web-footer-bottom">
            <span>© 2026 SehatKlinik. Seluruh hak cipta dilindungi.</span>
            <span className="web-footer-made">
              <Icon name="heart" size={14} /> Dirancang dengan kepedulian.
            </span>
            <label className="web-preview-label">
              Pratinjau{" "}
              <select
                aria-label="Ganti pratinjau peran"
                value="Publik"
                onChange={(e) => onRole(e.target.value)}
              >
                {["Publik", "Admin", "Petugas", "Dokter", "Pasien"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </footer>
      {detail && (
        <div className="web-dialog-backdrop" onClick={() => setDetail(null)}>
          <section
            className="web-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="web-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="web-dialog-close"
              aria-label="Tutup detail dokter"
              onClick={() => setDetail(null)}
            >
              <Icon name="close" />
            </button>
            <span className="web-service-icon">
              <Icon name="users" size={27} />
            </span>
            <span className="web-eyebrow">PROFIL DOKTER</span>
            <h2 id="web-dialog-title">{detail}</h2>
            <p>{physicians.find((d) => d.name === detail)?.specialty}</p>
            <p>
              Siap mendampingi Anda dengan pendekatan yang personal dan
              perawatan yang mengutamakan kenyamanan pasien.
            </p>
            <div className="web-care-note">
              <Icon name="calendar" size={22} />
              <span>
                {physicians.find((d) => d.name === detail)?.day}
                <br />
                <b>{physicians.find((d) => d.name === detail)?.time} WIB</b>
              </span>
            </div>
            <button className="web-button" onClick={onBook}>
              Daftar dengan Dokter Ini <Icon name="arrow" size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
