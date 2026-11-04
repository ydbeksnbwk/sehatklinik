import { and, eq, gt, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { jadwalPraktik } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const jam = (t) => String(t).slice(0, 5);

export async function PATCH(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(400, "id tidak valid");

    const [lama] = await db
      .select()
      .from(jadwalPraktik)
      .where(eq(jadwalPraktik.id, id))
      .limit(1);
    if (!lama) throw new HttpError(404, "Jadwal tidak ditemukan");

    const b = await request.json().catch(() => ({}));
    const baru = {
      hari: b.hari !== undefined ? Number(b.hari) : lama.hari,
      jamMulai:
        b.jamMulai !== undefined
          ? String(b.jamMulai).trim()
          : jam(lama.jamMulai),
      jamSelesai:
        b.jamSelesai !== undefined
          ? String(b.jamSelesai).trim()
          : jam(lama.jamSelesai),
      kuota: b.kuota !== undefined ? Number(b.kuota) : lama.kuota,
      aktif: b.aktif !== undefined ? b.aktif : lama.aktif,
    };

    if (!Number.isInteger(baru.hari) || baru.hari < 0 || baru.hari > 6)
      throw new HttpError(400, "hari harus 0 sampai 6");
    if (!JAM.test(baru.jamMulai) || !JAM.test(baru.jamSelesai))
      throw new HttpError(400, "Format jam harus HH:MM");
    if (baru.jamSelesai <= baru.jamMulai)
      throw new HttpError(400, "Jam selesai harus setelah jam mulai");
    if (!Number.isInteger(baru.kuota) || baru.kuota < 1)
      throw new HttpError(400, "kuota harus bilangan bulat minimal 1");
    if (typeof baru.aktif !== "boolean")
      throw new HttpError(400, "aktif harus true atau false");

    if (baru.aktif) {
      const [bentrok] = await db
        .select({ id: jadwalPraktik.id })
        .from(jadwalPraktik)
        .where(
          and(
            eq(jadwalPraktik.dokterId, lama.dokterId),
            eq(jadwalPraktik.hari, baru.hari),
            eq(jadwalPraktik.aktif, true),
            ne(jadwalPraktik.id, id),
            lt(jadwalPraktik.jamMulai, baru.jamSelesai),
            gt(jadwalPraktik.jamSelesai, baru.jamMulai),
          ),
        )
        .limit(1);
      if (bentrok)
        throw new HttpError(
          409,
          "Jam praktik bertabrakan dengan jadwal lain dokter ini",
        );
    }

    const [j] = await db
      .update(jadwalPraktik)
      .set(baru)
      .where(eq(jadwalPraktik.id, id))
      .returning();
    return NextResponse.json({ data: j });
  } catch (err) {
    return handleError(err, "PATCH /api/admin/jadwal/[id]");
  }
}
