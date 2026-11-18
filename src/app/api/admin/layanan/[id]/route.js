import { apiHandler } from "@/lib/api-handler";
import { and, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { dokterLayanan, kunjungan, layanan } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";

const LayananUpdateSchema = z
  .object({
    namaLayanan: z
      .string()
      .trim()
      .min(1, "Nama layanan wajib diisi")
      .max(100, "Nama layanan maksimal 100 karakter")
      .optional(),
    deskripsi: z.string().trim().optional().nullable(),
    durasiMenit: z.coerce
      .number()
      .int("Durasi harus bilangan bulat")
      .min(1, "Durasi minimal 1 menit")
      .max(480, "Durasi maksimal 480 menit")
      .optional(),
    aktif: z.boolean().optional(),
    detail: z.record(z.any()).optional(),
  })
  .strict("Terdapat bidang yang tidak dikenali pada data layanan");

async function _GET(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;

    if (!UUID.test(id)) {
      throw new HttpError(400, "ID layanan tidak valid", "BAD_REQUEST");
    }

    const [row] = await db
      .select()
      .from(layanan)
      .where(eq(layanan.id, id))
      .limit(1);

    if (!row) {
      throw new HttpError(404, "Layanan tidak ditemukan", "NOT_FOUND");
    }

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleError(err, "GET /api/admin/layanan/[id]");
  }
}

async function _PATCH(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;

    if (!UUID.test(id)) {
      throw new HttpError(400, "ID layanan tidak valid", "BAD_REQUEST");
    }

    const [existing] = await db
      .select()
      .from(layanan)
      .where(eq(layanan.id, id))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, "Layanan tidak ditemukan", "NOT_FOUND");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = LayananUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data perbaruan layanan tidak valid",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { namaLayanan, deskripsi, durasiMenit, aktif, detail } = parsed.data;

    if (namaLayanan && namaLayanan.toLowerCase() !== existing.namaLayanan.toLowerCase()) {
      const [duplicate] = await db
        .select({ id: layanan.id })
        .from(layanan)
        .where(
          and(
            sql`lower(${layanan.namaLayanan}) = lower(${namaLayanan})`,
            sql`${layanan.id} != ${id}`
          )
        )
        .limit(1);

      if (duplicate) {
        throw new HttpError(
          409,
          `Layanan dengan nama '${namaLayanan}' sudah ada`,
          "DUPLICATE_NAME"
        );
      }
    }

    const updateValues = {};
    if (namaLayanan !== undefined) updateValues.namaLayanan = namaLayanan;
    if (deskripsi !== undefined) updateValues.deskripsi = deskripsi;
    if (durasiMenit !== undefined) updateValues.durasiMenit = durasiMenit;
    if (aktif !== undefined) updateValues.aktif = aktif;
    if (detail !== undefined) updateValues.detail = detail;

    const [updated] = await db
      .update(layanan)
      .set(updateValues)
      .where(eq(layanan.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleError(err, "PATCH /api/admin/layanan/[id]");
  }
}

async function _DELETE(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;

    if (!UUID.test(id)) {
      throw new HttpError(400, "ID layanan tidak valid", "BAD_REQUEST");
    }

    const [existing] = await db
      .select()
      .from(layanan)
      .where(eq(layanan.id, id))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, "Layanan tidak ditemukan", "NOT_FOUND");
    }

    // Cek keterkaitan dengan jadwal (melalui dokter_layanan) dan kunjungan
    const [{ totalDokter }] = await db
      .select({ totalDokter: count() })
      .from(dokterLayanan)
      .where(eq(dokterLayanan.layananId, id));

    const [{ totalKunjungan }] = await db
      .select({ totalKunjungan: count() })
      .from(kunjungan)
      .where(eq(kunjungan.layananId, id));

    const isUsed = Number(totalDokter) > 0 || Number(totalKunjungan) > 0;

    if (isUsed) {
      // Sesuai aturan PRD Tahap 1D: layanan yang dipakai jadwal dinonaktifkan, bukan dihapus
      const [deactivated] = await db
        .update(layanan)
        .set({ aktif: false })
        .where(eq(layanan.id, id))
        .returning();

      return NextResponse.json({
        data: {
          id: deactivated.id,
          namaLayanan: deactivated.namaLayanan,
          aktif: false,
          dinonaktifkan: true,
          message:
            "Layanan sedang digunakan oleh dokter/jadwal/kunjungan, status berhasil dinonaktifkan.",
        },
      });
    }

    // Jika tidak ada keterkaitan, hapus permanen
    await db.delete(layanan).where(eq(layanan.id, id));

    return NextResponse.json({
      data: {
        id,
        message: "Layanan berhasil dihapus.",
      },
    });
  } catch (err) {
    return handleError(err, "DELETE /api/admin/layanan/[id]");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/admin/layanan/[id]" });
export const PATCH = apiHandler(_PATCH, { route: "PATCH /api/admin/layanan/[id]" });
export const DELETE = apiHandler(_DELETE, { route: "DELETE /api/admin/layanan/[id]" });
