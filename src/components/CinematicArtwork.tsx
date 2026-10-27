"use client"

import type { ComponentType } from "react"

type Props = {
  page: string
  Icon: ComponentType<{
    name: string
    size?: number
  }>
}

export default function CinematicArtwork({ page, Icon }: Props) {
  const details: Record<string, {
    icon: string
    title: string
    subtitle: string
    caption: string
  }> = {
    Layanan: {
      icon: "heart",
      title: "Perawatan yang personal",
      subtitle: "Untuk Anda dan keluarga",
      caption: "SETIAP KEBUTUHAN, SEPENUH HATI",
    },
    Dokter: {
      icon: "shield",
      title: "Keahlian yang Anda percaya",
      subtitle: "Perhatian yang Anda rasakan",
      caption: "MANUSIA DI BALIK PERAWATAN",
    },
    Jadwal: {
      icon: "calendar",
      title: "Waktu untuk lebih sehat",
      subtitle: "Pilih sesi yang nyaman untuk Anda",
      caption: "LEBIH TERENCANA, LEBIH TENANG",
    },
    Lokasi: {
      icon: "clinic",
      title: "Lebih dekat dengan Anda",
      subtitle: "Jakarta Selatan, Indonesia",
      caption: "RUANG NYAMAN UNTUK PULIH",
    },
  }
  const detail = details[page] || details.Layanan
  return (
    <div
      className={`cinema-art cinema-art-${page.toLowerCase()}`}
      aria-hidden="true"
    >
      <div className="cinema-orbit" />
      <span className="cinema-art-caption">{detail.caption}</span>
      {page === "Dokter" ? (
        <img
          className="cinema-art-doctor"
          src="/images/hero-doctor.png"
          alt=""
        />
      ) : page === "Layanan" || page === "Lokasi" ? (
        <div className="cinema-art-photo">
          <img src="/images/clinic-consultation.jpg" alt="" />
          <span className="cinema-art-photo-shade" />
          <span className="cinema-art-photo-note">
            <Icon name={detail.icon} size={19} />
            Sehat dimulai dari rasa nyaman.
          </span>
        </div>
      ) : (
        <div className="cinema-timepiece">
          <span>WAKTU UNTUK DIRI SENDIRI</span>
          <Icon name="calendar" size={60} />
          <b>
            Hari yang lebih baik,
            <br />
            dimulai hari ini.
          </b>
          <div className="cinema-timepiece-days">
            {["S", "S", "R", "K", "J", "S", "M"].map((d, i) => (
              <i key={i} className={i === 2 ? "active" : ""}>
                {d}
              </i>
            ))}
          </div>
        </div>
      )}
      <div className="cinema-art-float">
        <span>
          <Icon name={detail.icon} size={22} />
        </span>
        <div>
          <b>{detail.title}</b>
          <small>{detail.subtitle}</small>
        </div>
        <Icon name="check" size={18} />
      </div>
      <span className="cinema-art-seal">
        <img src="/images/sehatklinik-symbol.png" alt="" />
      </span>
    </div>
  )
}
