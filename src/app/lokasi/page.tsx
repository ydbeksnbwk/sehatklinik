import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Lokasi & Jam Layanan - Sistem Informasi Klinik Kesehatan",
  description: "Alamat, peta lokasi, jam operasional, dan nomor kontak Klinik Sehat Sentosa Jakarta Selatan.",
}

export default function LokasiPage() {
  return <ClinicWorkspace Icon={Icon} initialPage="Lokasi" initialRole="Publik" />
}
