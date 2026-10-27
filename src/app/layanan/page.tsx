import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Layanan Medis - Sistem Informasi Klinik Kesehatan",
  description: "Daftar layanan medis aktif di Klinik Sehat Sentosa: Poli Umum, Poli Gigi, Poli Anak, Konsultasi Gizi, dan Pemeriksaan Berkala.",
}

export default function LayananPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Layanan" initialRole="Publik" />
}
