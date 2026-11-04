import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dokter, jadwalPraktik } from "@/db/schema";
import { HttpError, handleError } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { sebagaiAnon } from "@/lib/rls";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dokterId = searchParams.get("dokterId");
    const hariParam = searchParams.get("hari");

    if (dokterId && !UUID.test(dokterId))
      throw new HttpError(400, "dokterId tidak valid");
    let hari = null;
    if (hariParam !== null) {
      hari = Number(hariParam);
      if (!Number.isInteger(hari) || hari < 0 || hari > 6)
        throw new HttpError(400, "hari harus 0 sampai 6");
    }

    const rows = await sebagaiAnon((tx) => {
      const conds = [eq(jadwalPraktik.aktif, true), eq(dokter.aktif, true)];
      if (dokterId) conds.push(eq(jadwalPraktik.dokterId, dokterId));
      if (hari !== null) conds.push(eq(jadwalPraktik.hari, hari));

      return tx
        .select({
          id: jadwalPraktik.id,
          dokterId: jadwalPraktik.dokterId,
          namaDokter: dokter.nama,
          spesialisasi: dokter.spesialisasi,
          hari: jadwalPraktik.hari,
          jamMulai: jadwalPraktik.jamMulai,
          jamSelesai: jadwalPraktik.jamSelesai,
          kuota: jadwalPraktik.kuota,
        })
        .from(jadwalPraktik)
        .innerJoin(dokter, eq(jadwalPraktik.dokterId, dokter.id))
        .where(and(...conds))
        .orderBy(asc(jadwalPraktik.hari), asc(jadwalPraktik.jamMulai));
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        jamMulai: String(r.jamMulai).slice(0, 5),
        jamSelesai: String(r.jamSelesai).slice(0, 5),
      })),
    });
  } catch (err) {
    return handleError(err, "GET /api/public/jadwal");
  }
}
