import { apiHandler } from "@/lib/api-handler";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { profilKlinik } from "@/db/schema";
import { handleError, requireRole } from "@/lib/auth";

const ProfilKlinikSchema = z
  .object({
    nama: z
      .string({ required_error: "Nama klinik wajib diisi" })
      .trim()
      .min(1, "Nama klinik wajib diisi")
      .max(200, "Nama klinik maksimal 200 karakter"),
    deskripsi: z.string().trim().optional().nullable(),
    alamat: z.string().trim().optional().nullable(),
    latitude: z.coerce
      .number({ invalid_type_error: "Latitude harus berupa angka" })
      .min(-90, "Latitude minimal -90")
      .max(90, "Latitude maksimal 90")
      .optional()
      .nullable(),
    longitude: z.coerce
      .number({ invalid_type_error: "Longitude harus berupa angka" })
      .min(-180, "Longitude minimal -180")
      .max(180, "Longitude maksimal 180")
      .optional()
      .nullable(),
    kontak: z.string().trim().optional().nullable(),
    jamOperasional: z.record(z.any()).optional().default({}),
    detail: z.record(z.any()).optional().default({}),
  })
  .strict("Terdapat bidang yang tidak dikenali pada profil klinik");

function formatProfil(k) {
  if (!k) return null;
  const detail = k.detail || {};
  return {
    id: k.id,
    nama: k.nama,
    deskripsi: k.deskripsi,
    alamat: k.alamat,
    latitude: k.latitude === null ? null : Number(k.latitude),
    longitude: k.longitude === null ? null : Number(k.longitude),
    kontak: k.kontak,
    jamOperasional: k.jamOperasional,
    detail,
    tagline: detail.tagline || "",
    emergencyPhone: detail.emergencyPhone || "",
    whatsapp: detail.whatsapp || "",
    email: detail.email || "",
    history: detail.history || "",
    vision: detail.vision || "",
    mission: detail.mission || [],
    values: detail.values || [],
    accreditation: detail.accreditation || "",
    accreditationNumber: detail.accreditationNumber || "",
    facilities: detail.facilities || [],
    stats: detail.stats || [],
  };
}

async function _GET(request) {
  try {
    await requireRole(request, ["admin"]);

    const [klinik] = await db.select().from(profilKlinik).limit(1);

    return NextResponse.json({
      data: formatProfil(klinik),
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/profil-klinik");
  }
}

async function _PUT(request) {
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
      detail,
    } = parsed.data;

    const [existing] = await db
      .select()
      .from(profilKlinik)
      .limit(1);

    let result;
    if (existing) {
      const mergedDetail = detail && Object.keys(detail).length > 0 ? { ...(existing.detail || {}), ...detail } : (existing.detail || {});
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
          detail: mergedDetail,
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
          detail: detail || {},
        })
        .returning();
    }

    return NextResponse.json({ data: formatProfil(result) });
  } catch (err) {
    return handleError(err, "PUT /api/admin/profil-klinik");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/admin/profil-klinik" });
export const PUT = apiHandler(_PUT, { route: "PUT /api/admin/profil-klinik" });
