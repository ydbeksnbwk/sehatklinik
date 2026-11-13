import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { pasien } from "@/db/schema";
import { requireRole, handleError } from "@/lib/auth";

export async function GET(request) {
  try {
    const { user, profile } = await requireRole(request);

    let detailPasien = null;
    if (profile.role === "pasien") {
      const [p] = await db
        .select()
        .from(pasien)
        .where(eq(pasien.profileId, profile.id))
        .limit(1);
      detailPasien = p || null;
    }

    const meta = user.user_metadata || {};

    return NextResponse.json({
      data: {
        id: profile.id,
        email: user.email,
        nama: profile.nama,
        telepon:
          detailPasien?.telepon || profile.telepon || meta.telepon || "-",
        role: profile.role,
        pasienId: detailPasien?.id ?? null,
        noRekamMedis: detailPasien?.noRekamMedis ?? null,
        nik: detailPasien?.nik || meta.nik || "",
        tanggalLahir:
          detailPasien?.tanggalLahir || meta.tanggal_lahir || "2000-01-01",
        jenisKelamin:
          detailPasien?.jenisKelamin || meta.jenis_kelamin || "Laki-laki",
        alamat: detailPasien?.alamat || meta.alamat || "-",
        kontakDarurat:
          detailPasien?.kontakDarurat || meta.kontak_darurat || "-",
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/auth/me");
  }
}
