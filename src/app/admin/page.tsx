import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Admin Dashboard - Sistem Informasi Klinik Kesehatan",
  description: "Manajemen data master dokter, layanan, jadwal, pengguna staf, dan rekap kunjungan.",
}

export default function AdminPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Dashboard" initialRole="Admin" />
}
