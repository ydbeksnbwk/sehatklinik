import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Masuk Akun & Demo Peran - Sistem Informasi Klinik Kesehatan",
  description: "Formulir masuk akun pasien, petugas loket, dokter, dan admin Klinik Sehat Sentosa.",
}

export default function LoginPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Login" initialRole="Publik" />
}
