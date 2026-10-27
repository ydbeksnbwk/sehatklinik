import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Portal Pasien - Sistem Informasi Klinik Kesehatan",
  description: "Antrean aktif, tiket kunjungan, riwayat medis, dan pendaftaran mandiri.",
}

export default function PasienPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Dashboard" initialRole="Pasien" />
}
