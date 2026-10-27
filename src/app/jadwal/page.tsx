import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Jadwal Praktik & Kuota - Sistem Informasi Klinik Kesehatan",
  description: "Cek jadwal dokter aktif dan sisa kuota antrean secara real-time di Klinik Sehat Sentosa.",
}

export default function JadwalPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Jadwal" initialRole="Publik" />
}
