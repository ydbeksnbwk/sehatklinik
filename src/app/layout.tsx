import type { Metadata } from "next"
import "../index.css"
import "../design-system.css"
import "../cinematic.css"
import "../patient.css"
import "../public.css"
import "../sky.css"
import "../public-prd.css"
import "../workspace.css"
import { ClinicProvider } from "@/context/ClinicContext"

export const metadata: Metadata = {
  title: "Sistem Informasi Klinik Kesehatan - Klinik Sehat Sentosa",
  description: "Aplikasi web Sistem Informasi Klinik Kesehatan: pendaftaran daring & walk-in, antrean terpusat, rekam medis & pemeriksaan dokter, serta dashboard multi-peran.",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClinicProvider>{children}</ClinicProvider>
      </body>
    </html>
  )
}
