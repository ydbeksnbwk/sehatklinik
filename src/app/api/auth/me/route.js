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
        .select({
          id: pasien.id,
          noRekamMedis: pasien.noRekamMedis,
          jenisKelamin: pasien.jenisKelamin,
        })
        .from(pasien)
        .where(eq(pasien.profileId, profile.id))
        .limit(1);
      detailPasien = p || null;
    }

    return NextResponse.json({
      data: {
        id: profile.id,
        email: user.email,
        nama: profile.nama,
        telepon: profile.telepon,
        role: profile.role,
        pasienId: detailPasien?.id ?? null,
        noRekamMedis: detailPasien?.noRekamMedis ?? null,
        jenisKelamin:
          detailPasien?.jenisKelamin ??
          user.user_metadata?.jenis_kelamin ??
          null,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/auth/me");
  }
}
