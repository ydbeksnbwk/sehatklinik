import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Detail Kunjungan & Antrean - Sistem Informasi Klinik Kesehatan",
  description: "Rincian kunjungan aktif, nomor antrean, dan ringkasan pemeriksaan pasien.",
}

export default async function KunjunganDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <ClinicWorkspace
      Icon={Icon}
      initialPage="Antrean Saya"
      initialDetailId={decodeURIComponent(id)}
    />
  )
}

