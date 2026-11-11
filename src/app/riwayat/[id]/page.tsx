import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Detail Riwayat Kunjungan - Sistem Informasi Klinik Kesehatan",
  description: "Rincian kunjungan, status antrean, ringkasan hasil pemeriksaan klinis, dan cetak ringkasan.",
}

export default async function RiwayatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <ClinicWorkspace
      Icon={Icon}
      initialPage="Riwayat Kunjungan"
      initialDetailId={decodeURIComponent(id)}
    />
  )
}

