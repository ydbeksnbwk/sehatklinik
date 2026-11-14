import { apiHandler } from "@/lib/api-handler";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { jadwalPraktik } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { skemaJadwalUpdate } from "@/lib/validasi/jadwal";

const jam = (t) => String(t).slice(0, 5);

async function _PATCH(request, { params }) {
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
    const validated = skemaJadwalUpdate.parse(b);

    const baru = {
      hari: validated.hari !== undefined ? validated.hari : lama.hari,
      jamMulai:
        validated.jamMulai !== undefined
          ? validated.jamMulai
          : jam(lama.jamMulai),
      jamSelesai:
        validated.jamSelesai !== undefined
          ? validated.jamSelesai
          : jam(lama.jamSelesai),
      kuota: validated.kuota !== undefined ? validated.kuota : lama.kuota,
      aktif: validated.aktif !== undefined ? validated.aktif : lama.aktif,
    };

    if (baru.jamSelesai <= baru.jamMulai) {
      throw new HttpError(400, "Jam selesai harus setelah jam mulai");
    }

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
      if (bentrok) {
        throw new HttpError(
          409,
          "Jam praktik bertabrakan dengan jadwal lain dokter ini",
        );
      }
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

export const PATCH = apiHandler(_PATCH, { route: "PATCH /api/admin/jadwal/[id]" });
