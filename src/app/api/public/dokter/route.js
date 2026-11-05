import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dokter, dokterLayanan, layanan } from "@/db/schema";
import { HttpError, handleError } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { sebagaiAnon } from "@/lib/rls";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().replace(/[\\%_]/g, "\\$&");
    const layananId = searchParams.get("layananId");
    if (layananId && !UUID.test(layananId))
      throw new HttpError(400, "layananId tidak valid");

    const data = await sebagaiAnon(async (tx) => {
      const conds = [eq(dokter.aktif, true)];
      if (q) conds.push(ilike(dokter.nama, `%${q}%`));
      if (layananId) {
        conds.push(
          inArray(
            dokter.id,
            tx
              .select({ id: dokterLayanan.dokterId })
              .from(dokterLayanan)
              .where(eq(dokterLayanan.layananId, layananId)),
          ),
        );
      }

      const rows = await tx
        .select({
          id: dokter.id,
          nama: dokter.nama,
          spesialisasi: dokter.spesialisasi,
          fotoPath: dokter.fotoPath,
          deskripsi: dokter.deskripsi,
        })
        .from(dokter)
        .where(and(...conds))
        .orderBy(asc(dokter.nama));

      const peta = {};
      if (rows.length > 0) {
        const rel = await tx
          .select({
            dokterId: dokterLayanan.dokterId,
            id: layanan.id,
            namaLayanan: layanan.namaLayanan,
            durasiMenit: layanan.durasiMenit,
          })
          .from(dokterLayanan)
          .innerJoin(layanan, eq(dokterLayanan.layananId, layanan.id))
          .where(
            inArray(
              dokterLayanan.dokterId,
              rows.map((r) => r.id),
            ),
          );
        for (const r of rel) {
          (peta[r.dokterId] ||= []).push({
            id: r.id,
            namaLayanan: r.namaLayanan,
            durasiMenit: r.durasiMenit,
          });
        }
      }
      return rows.map((r) => ({ ...r, layanan: peta[r.id] || [] }));
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err, "GET /api/public/dokter");
  }
}
