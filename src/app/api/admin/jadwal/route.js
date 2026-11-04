import { and, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter, jadwalPraktik } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID, str } from "@/lib/akses";

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request) {
  try {
    await requireRole(request, ["admin"]);
    const b = await request.json().catch(() => ({}));
    const dokterId = str(b.dokterId);
    const hari = Number(b.hari);
    const jamMulai = str(b.jamMulai);
    const jamSelesai = str(b.jamSelesai);
    const kuota = Number(b.kuota);

    if (!UUID.test(dokterId)) throw new HttpError(400, "dokterId tidak valid");
    if (!Number.isInteger(hari) || hari < 0 || hari > 6)
      throw new HttpError(400, "hari harus 0 (Minggu) sampai 6 (Sabtu)");
    if (!JAM.test(jamMulai) || !JAM.test(jamSelesai))
      throw new HttpError(400, "Format jam harus HH:MM");
    if (jamSelesai <= jamMulai)
      throw new HttpError(400, "Jam selesai harus setelah jam mulai");
    if (!Number.isInteger(kuota) || kuota < 1)
      throw new HttpError(400, "kuota harus bilangan bulat minimal 1");

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
    if (bentrok)
      throw new HttpError(
        409,
        "Jam praktik bertabrakan dengan jadwal lain dokter ini",
      );

    const [j] = await db
      .insert(jadwalPraktik)
      .values({ dokterId, hari, jamMulai, jamSelesai, kuota })
      .returning();
    return NextResponse.json({ data: j }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/admin/jadwal");
  }
}
