import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Pendaftaran Akun Pasien - Sistem Informasi Klinik Kesehatan",
  description: "Daftar akun pasien baru untuk pendaftaran kunjungan dan nomor antrean daring.",
}

export default function DaftarPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Daftar" initialRole="Publik" />
}
