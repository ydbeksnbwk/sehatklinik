"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useClinic } from "@/context/ClinicContext"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export default function LoginPage() {
  const router = useRouter()
  const { currentUser, role } = useClinic()

  useEffect(() => {
    const activeRole = currentUser?.role || (role !== "Publik" ? role : null)
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
  }, [currentUser, role, router])

  return <ClinicWorkspace Icon={Icon} initialPage="Login" initialRole="Publik" />
}
