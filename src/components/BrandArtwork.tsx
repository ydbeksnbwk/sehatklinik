"use client"

export default function BrandArtwork() {
  return (
    <span className="cinema-brand" aria-hidden="true">
      <img
        className="cinema-brand-symbol"
        src="/images/sehatklinik-symbol.png"
        alt=""
      />
      <span className="cinema-brand-lockup">
        <img
          className="cinema-brand-wordmark"
          src="/images/sehatklinik-wordmark.png"
          alt=""
        />
        <small>UNTUK HIDUP YANG LEBIH BAIK</small>
      </span>
    </span>
  )
}
