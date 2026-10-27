import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Ruang Dokter - Sistem Informasi Klinik Kesehatan",
  description: "Antrean dokter, rekam pemeriksaan, tanda vital, diagnosis, dan tindakan.",
}

export default function DokterDashboardPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Dashboard" initialRole="Dokter" />
}
