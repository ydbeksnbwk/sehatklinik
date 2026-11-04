import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { antrean, kunjungan, pemeriksaan } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID, dokterIdDari, str } from "@/lib/akses";

export async function POST(request, { params }) {
  try {
    const { profile } = await requireRole(request, ["dokter"]);
    const dokterId = await dokterIdDari(profile);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(400, "id tidak valid");

    const b = await request.json().catch(() => ({}));
    const anamnesis = str(b.anamnesis);
    const diagnosis = str(b.diagnosis);
    const catatan = str(b.catatan) || null;
    const tandaVital = b.tandaVital ?? {};
    if (!anamnesis) throw new HttpError(400, "Anamnesis wajib diisi");
    if (!diagnosis) throw new HttpError(400, "Diagnosis wajib diisi");
    if (typeof tandaVital !== "object" || Array.isArray(tandaVital)) {
      throw new HttpError(400, "tandaVital harus berupa objek");
    }

    await db.transaction(async (tx) => {
      const [k] = await tx
        .select({ status: kunjungan.status })
        .from(kunjungan)
        .where(and(eq(kunjungan.id, id), eq(kunjungan.dokterId, dokterId)))
        .for("update");
      if (!k) throw new HttpError(404, "Kunjungan tidak ditemukan");
      if (k.status !== "hadir")
        throw new HttpError(409, `Kunjungan berstatus ${k.status}`);

      const [a] = await tx
        .select({ id: antrean.id, status: antrean.status })
        .from(antrean)
        .where(eq(antrean.kunjunganId, id))
        .limit(1);
      if (!a || a.status !== "diperiksa") {
        throw new HttpError(
          409,
          "Mulai pemeriksaan dulu (antrean harus berstatus diperiksa)",
        );
      }

      await tx.insert(pemeriksaan).values({
        kunjunganId: id,
        dokterId,
        anamnesis,
        tandaVital,
        diagnosis,
        catatan,
      });
      // kunjungan dulu (trigger mensyaratkan catatan pemeriksaan sudah ada), baru antrean
      await tx
        .update(kunjungan)
        .set({ status: "selesai" })
        .where(eq(kunjungan.id, id));
      await tx
        .update(antrean)
        .set({ status: "selesai" })
        .where(eq(antrean.id, a.id));
    });

    return NextResponse.json(
      { data: { kunjunganId: id, status: "selesai" } },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err, "POST /api/kunjungan/[id]/pemeriksaan");
  }
}
