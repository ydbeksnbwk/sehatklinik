import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Petugas Loket - Sistem Informasi Klinik Kesehatan",
  description: "Antrean hari ini, check-in kehadiran, pemanggilan, dan pendaftaran walk-in.",
}

export default function PetugasPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Dashboard" initialRole="Petugas" />
}
