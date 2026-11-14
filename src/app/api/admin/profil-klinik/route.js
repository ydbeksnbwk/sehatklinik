import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { profilKlinik } from "@/db/schema";
import { handleError, requireRole } from "@/lib/auth";

const ProfilKlinikSchema = z.object({
  nama: z
    .string({ required_error: "Nama klinik wajib diisi" })
    .trim()
    .min(1, "Nama klinik wajib diisi")
    .max(200, "Nama klinik maksimal 200 karakter"),
  deskripsi: z.string().trim().optional().nullable(),
  alamat: z.string().trim().optional().nullable(),
  latitude: z.coerce
    .number()
    .min(-90, "Latitude minimal -90")
    .max(90, "Latitude maksimal 90")
    .optional()
    .nullable(),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude minimal -180")
    .max(180, "Longitude maksimal 180")
    .optional()
    .nullable(),
  kontak: z.string().trim().optional().nullable(),
  jamOperasional: z.record(z.any()).optional().default({}),
});

export async function GET(request) {
  try {
    await requireRole(request, ["admin"]);

    const [klinik] = await db.select().from(profilKlinik).limit(1);

    return NextResponse.json({
      data: klinik || null,
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/profil-klinik");
  }
}

export async function PUT(request) {
  try {
    await requireRole(request, ["admin"]);

    const body = await request.json().catch(() => ({}));
    const parsed = ProfilKlinikSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data profil klinik tidak valid",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const {
      nama,
      deskripsi,
      alamat,
      latitude,
      longitude,
      kontak,
      jamOperasional,
    } = parsed.data;

    const [existing] = await db
      .select({ id: profilKlinik.id })
      .from(profilKlinik)
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(profilKlinik)
        .set({
          nama,
          deskripsi: deskripsi ?? null,
          alamat: alamat ?? null,
          latitude: latitude !== undefined && latitude !== null ? String(latitude) : null,
          longitude: longitude !== undefined && longitude !== null ? String(longitude) : null,
          kontak: kontak ?? null,
          jamOperasional: jamOperasional || {},
        })
        .where(eq(profilKlinik.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(profilKlinik)
        .values({
          nama,
          deskripsi: deskripsi ?? null,
          alamat: alamat ?? null,
          latitude: latitude !== undefined && latitude !== null ? String(latitude) : null,
          longitude: longitude !== undefined && longitude !== null ? String(longitude) : null,
          kontak: kontak ?? null,
          jamOperasional: jamOperasional || {},
        })
        .returning();
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleError(err, "PUT /api/admin/profil-klinik");
  }
}
