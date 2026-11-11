import type { Metadata } from "next"
import ClinicWorkspace from "@/components/ClinicWorkspace"
import Icon from "@/components/Icon"

export const metadata: Metadata = {
  title: "Detail Layanan Medis - Sistem Informasi Klinik Kesehatan",
  description: "Informasi cakupan pelayanan, persiapan pasien, dan alur konsultasi layanan klinik.",
}

export default async function LayananDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <ClinicWorkspace
      Icon={Icon}
      initialPage="Layanan"
      initialRole="Publik"
      initialDetailId={decodeURIComponent(id)}
    />
  )
}

