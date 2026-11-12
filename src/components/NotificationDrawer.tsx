"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useClinic } from "../context/ClinicContext"
import Icon from "./Icon"
import { formatDateIndonesian } from "@/lib/date"

export default function NotificationDrawer() {
  const router = useRouter()
  const {
    role,
    notifications,
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    webPushPermission,
    requestWebPushPermission,
    setSelected,
    navigate,
    currentUser,
    patient,
  } = useClinic()

  const [activeTab, setActiveTab] = useState<"all" | "unread">("all")

  if (!notificationDrawerOpen) return null

  // Role-scoped & user-scoped notifications (isolasi ketat: setiap peran & akun hanya melihat miliknya)
  const userNotifications = notifications.filter((n) => {
    // 1. Setiap peran (Pasien, Petugas, Dokter, Admin) hanya melihat notifikasi perannya sendiri
    if (n.targetRole !== role) return false

    // 2. Isolasi per akun jika targetUserId ditentukan
    if (n.targetUserId && currentUser) {
      const target = n.targetUserId.toLowerCase()
      const matchesUser =
        (currentUser.id && target === currentUser.id.toLowerCase()) ||
        (currentUser.email && target === currentUser.email.toLowerCase()) ||
        (currentUser.name && target === currentUser.name.toLowerCase()) ||
        (role === "Pasien" && patient?.id && target === patient.id.toLowerCase())

      if (!matchesUser) return false
    }

    return true
  })
  const unreadItems = userNotifications.filter((n) => !n.isRead)
  const displayedNotifications =
    activeTab === "unread" ? unreadItems : userNotifications

  const handleNotificationClick = (item: (typeof notifications)[0]) => {
    markNotificationAsRead(item.id)
    setNotificationDrawerOpen(false)

    if (item.actionUrl && (item.actionUrl.startsWith("/") || item.actionUrl.startsWith("http"))) {
      router.push(item.actionUrl)
      return
    }

    if (item.visitId && item.visitId !== "KJ-SISTEM") {
      setSelected(item.visitId)
    }
    navigate("Antrean Saya")
    router.push("/pasien")
  }

  // Format subtitle from visitId, queue, date or message matching mockup
  const getSubtitle = (item: (typeof notifications)[0]) => {
    if (item.visitId && item.queueNumber && item.visitId !== "KJ-SISTEM") {
      const dateStr = formatDateIndonesian(item.timestamp)
      return `${item.visitId} • Antrean ${item.queueNumber} • ${dateStr}`
    }
    return item.message || (item.timestamp ? formatDateIndonesian(item.timestamp) : "")
  }

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        className="notif-popup-backdrop"
        onClick={() => setNotificationDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Floating Notification Popover Card (matching user design) */}
      <aside
        id="notif-popup-modal"
        className="notif-popup-card"
        role="dialog"
        aria-modal="true"
        aria-label="Pusat Notifikasi"
      >
        {/* Header Section */}
        <div className="notif-popup-header">
          <span className="notif-popup-eyebrow">
            {role === "Pasien"
              ? "RUANG PASIEN"
              : role === "Dokter"
              ? "RUANG DOKTER"
              : role === "Petugas"
              ? "PELAYANAN PASIEN"
              : role === "Admin"
              ? "ADMINISTRASI KLINIK"
              : "NOTIFIKASI"}
          </span>

          <div className="notif-popup-title-row">
            <div className="notif-popup-title-wrap">
              <h3 className="notif-popup-title">Notifikasi</h3>
              {unreadItems.length > 0 && (
                <span className="notif-popup-badge">{unreadItems.length} baru</span>
              )}
            </div>

            <button
              id="notif-popup-close-btn"
              className="notif-popup-close-btn"
              onClick={() => setNotificationDrawerOpen(false)}
              aria-label="Tutup notifikasi"
              title="Tutup"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m15 9-6 6m0-6 6 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab & Actions Row */}
        <div className="notif-popup-nav">
          <div className="notif-popup-tabs">
            <button
              className={`notif-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              Semua
            </button>
            <button
              className={`notif-tab-btn ${activeTab === "unread" ? "active" : ""}`}
              onClick={() => setActiveTab("unread")}
            >
              Belum dibaca
            </button>
          </div>

          {unreadItems.length > 0 && (
            <button
              className="notif-read-all-btn"
              onClick={markAllNotificationsAsRead}
            >
              Tandai semua dibaca
            </button>
          )}
        </div>

        {/* Notification Items List */}
        <div className="notif-popup-list">
          {displayedNotifications.length === 0 ? (
            <div className="notif-popup-empty">
              <Icon name="check" size={24} />
              <p>Tidak ada notifikasi {activeTab === "unread" ? "belum dibaca" : ""}.</p>
            </div>
          ) : (
            displayedNotifications.map((item) => (
              <div
                key={item.id}
                className={`notif-popup-item ${item.isRead ? "is-read" : "is-unread"}`}
              >
                {/* Icon in Circular Badge */}
                <span className="notif-item-icon-badge">
                  {item.type === "KUNJUNGAN_TERDAFTAR" ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                    </svg>
                  ) : item.type === "KUNJUNGAN_SELESAI" ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  ) : item.type === "ANTREAN_DIPANGGIL" ? (
                    <Icon name="bell" size={17} />
                  ) : item.type === "PENGINGAT_KUNJUNGAN" ? (
                    <Icon name="clock" size={17} />
                  ) : item.type === "GILIRAN_MENDEKAT" ? (
                    <Icon name="clock" size={17} />
                  ) : (
                    <Icon name="info" size={17} />
                  )}
                </span>

                {/* Content */}
                <div className="notif-item-body">
                  <div className="notif-item-title-row">
                    <h4 className="notif-item-title">{item.title}</h4>
                    {!item.isRead && <span className="notif-item-unread-dot" />}
                  </div>

                  {getSubtitle(item) && (
                    <p className="notif-item-subtitle">{getSubtitle(item)}</p>
                  )}

                  <div className="notif-item-actions">
                    <button
                      className="notif-action-link"
                      onClick={() => handleNotificationClick(item)}
                    >
                      <span>Lihat detail kunjungan</span>
                      <span className="notif-action-arrow">&rarr;</span>
                    </button>

                    {!item.isRead && (
                      <button
                        className="notif-mark-read-link"
                        onClick={() => markNotificationAsRead(item.id)}
                      >
                        Tandai dibaca
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: status Web Push Notification */}
        <div className="notif-popup-footer">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11.5px", color: "#475569" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: webPushPermission === "granted" ? "#10b981" : "#f59e0b",
                  display: "inline-block",
                }}
              />
              {webPushPermission === "granted"
                ? "Notifikasi Browser Aktif"
                : "Notifikasi Browser Belum Aktif"}
            </span>
            {webPushPermission !== "granted" && typeof window !== "undefined" && "Notification" in window && (
              <button
                type="button"
                onClick={requestWebPushPermission}
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  color: "#1d4ed8",
                  fontWeight: 600,
                  fontSize: "11px",
                  cursor: "pointer",
                  padding: "3px 8px",
                }}
              >
                Aktifkan
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
