"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useClinic } from "@/context/ClinicContext"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export default function DashboardPage() {
  const router = useRouter()
  const { role } = useClinic()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search
      if (role === "Admin") {
        router.replace(`/admin${search}`)
      } else if (role === "Petugas") {
        router.replace(`/petugas${search}`)
      } else if (role === "Dokter") {
        router.replace(`/dokter-dashboard${search}`)
      } else {
        router.replace(`/pasien${search}`)
      }
    }
  }, [role, router])

  return <ClinicWorkspace Icon={Icon} initialPage="Dashboard" initialRole="Pasien" />
}
