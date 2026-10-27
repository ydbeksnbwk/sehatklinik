import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Dokter Kami - Sistem Informasi Klinik Kesehatan",
  description: "Daftar dokter spesialis dan umum berpengalaman di Klinik Sehat Sentosa.",
}

export default function DokterPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Dokter" initialRole="Publik" />
}
