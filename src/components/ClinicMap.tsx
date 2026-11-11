"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

type Props = {
  latitude: string | number
  longitude: string | number
  name: string
  address: string
}

const DEFAULT_LAT = -6.2297
const DEFAULT_LNG = 106.8295

/**
 * Peta interaktif Leaflet + OpenStreetMap untuk halaman /lokasi.
 * Diimpor dinamis di dalam useEffect agar aman saat SSR/prerender Next.js.
 */
export default function ClinicMap({
  latitude,
  longitude,
  name,
  address,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const parsedLat = Number(latitude)
  const parsedLng = Number(longitude)
  const lat = Number.isFinite(parsedLat) ? parsedLat : DEFAULT_LAT
  const lng = Number.isFinite(parsedLng) ? parsedLng : DEFAULT_LNG

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isDisposed = false
    let mapInstance: import("leaflet").Map | null = null

    async function initMap() {
      const L = (await import("leaflet")).default
      if (isDisposed || !container) return

      const leafletContainer = container as HTMLDivElement & { _leaflet_id?: number }
      if (leafletContainer._leaflet_id) {
        leafletContainer.innerHTML = ""
        delete leafletContainer._leaflet_id
      }

      mapInstance = L.map(container, {
        center: [lat, lng],
        zoom: 16,
        scrollWheelZoom: false,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapInstance)

      const pinIcon = L.divIcon({
        className: "clinic-leaflet-pin",
        html: '<span class="clinic-leaflet-pin-dot"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg></span>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -34],
      })

      const marker = L.marker([lat, lng], {
        icon: pinIcon,
        title: name,
      }).addTo(mapInstance)

      const popupContent = document.createElement("div")
      popupContent.className = "clinic-leaflet-popup"
      const titleEl = document.createElement("strong")
      titleEl.textContent = name
      const addrEl = document.createElement("p")
      addrEl.textContent = address
      const coordEl = document.createElement("small")
      coordEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      popupContent.append(titleEl, addrEl, coordEl)

      marker.bindPopup(popupContent).openPopup()
    }

    initMap()

    return () => {
      isDisposed = true
      if (mapInstance) {
        mapInstance.remove()
        mapInstance = null
      }
    }
  }, [lat, lng, name, address])

  return (
    <div
      ref={containerRef}
      className="clinic-leaflet-map"
      role="region"
      aria-label={`Peta interaktif lokasi ${name}`}
    />
  )
}

