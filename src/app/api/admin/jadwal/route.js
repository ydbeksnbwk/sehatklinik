import { apiHandler } from "@/lib/api-handler";
import { and, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter, jadwalPraktik } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { skemaJadwalCreate } from "@/lib/validasi/jadwal";

async function _POST(request) {
  try {
    await requireRole(request, ["admin"]);
    const b = await request.json().catch(() => ({}));
    const validated = skemaJadwalCreate.parse(b);
    const { dokterId, hari, jamMulai, jamSelesai, kuota } = validated;

    const [d] = await db
      .select({ id: dokter.id })
      .from(dokter)
      .where(eq(dokter.id, dokterId))
      .limit(1);
    if (!d) throw new HttpError(404, "Dokter tidak ditemukan");

    const [bentrok] = await db
      .select({ id: jadwalPraktik.id })
      .from(jadwalPraktik)
      .where(
        and(
          eq(jadwalPraktik.dokterId, dokterId),
          eq(jadwalPraktik.hari, hari),
          eq(jadwalPraktik.aktif, true),
          lt(jadwalPraktik.jamMulai, jamSelesai),
          gt(jadwalPraktik.jamSelesai, jamMulai),
        ),
      )
      .limit(1);
    if (bentrok) {
      throw new HttpError(
        409,
        "Jam praktik bertabrakan dengan jadwal lain dokter ini",
      );
    }

    const [j] = await db
      .insert(jadwalPraktik)
      .values({ dokterId, hari, jamMulai, jamSelesai, kuota })
      .returning();
    return NextResponse.json({ data: j }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/admin/jadwal");
  }
}

export const POST = apiHandler(_POST, { route: "POST /api/admin/jadwal" });
