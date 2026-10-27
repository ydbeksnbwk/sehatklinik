import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Dashboard Workspace - Sistem Informasi Klinik Kesehatan",
  description: "Area kerja terpusat untuk Pasien, Petugas Pendaftaran, Dokter, dan Admin Klinik.",
}

export default function DashboardPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Dashboard" initialRole="Pasien" />
}
