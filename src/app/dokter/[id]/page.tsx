import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Profil & Pendidikan Dokter - Sistem Informasi Klinik Kesehatan",
  description: "Profil tenaga medis, legalitas SIP/STR, riwayat pendidikan, sertifikasi, dan jadwal praktik dokter.",
}

export default async function DokterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <ClinicWorkspace
      Icon={Icon}
      initialPage="Dokter"
      initialRole="Publik"
      initialDetailId={decodeURIComponent(id)}
    />
  )
}

