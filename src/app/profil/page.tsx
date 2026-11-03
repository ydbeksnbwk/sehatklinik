import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Profil Klinik & Rumah Sakit - Klinik Sehat Sentosa",
  description: "Tentang Klinik Sehat Sentosa: Sejarah, Visi Misi, Fasilitas Medis, Akreditasi Paripurna Kemenkes RI, dan Komitmen Pelayanan Kesehatan Keluarga.",
}

export default function ProfilPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Profil" initialRole="Publik" />
}
