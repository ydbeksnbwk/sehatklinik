"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useClinic } from "@/context/ClinicContext"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export default function LoginPage() {
  const router = useRouter()
  const { currentUser, role } = useClinic()

  const activeRole = currentUser?.role || (role !== "Publik" ? role : null)

  useEffect(() => {
    if (activeRole && activeRole !== "Publik") {
      const roleRoutes: Record<string, string> = {
        Admin: "/admin",
        Petugas: "/petugas",
        Dokter: "/dokter-dashboard",
        Pasien: "/pasien",
      }
      const search = typeof window !== "undefined" ? window.location.search : ""
      const redirectParam = new URLSearchParams(search).get("redirect")
      const dest =
        redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : roleRoutes[activeRole] || "/pasien"
      router.replace(dest)
    }
  }, [activeRole, router])

  // Jangan render halaman publik jika pengguna sudah memiliki peran aktif agar tidak flicker/mental ke '/'
  if (activeRole && activeRole !== "Publik") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "'DM Sans', sans-serif",
          color: "#475569",
          fontSize: "14px",
        }}
      >
        Mengalihkan ke dashboard...
      </div>
    )
  }

  return <ClinicWorkspace Icon={Icon} initialPage="Login" initialRole="Publik" />
}
