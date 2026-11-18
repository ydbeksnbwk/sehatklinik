import { apiHandler } from "@/lib/api-handler";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter, dokterLayanan, profiles } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { skemaDokterUpdate } from "@/lib/validasi/dokter";

async function _PATCH(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(400, "id tidak valid");

    const b = await request.json().catch(() => ({}));
    const validated = skemaDokterUpdate.parse(b);

    const set = {};
    if (validated.nama !== undefined) set.nama = validated.nama;
    if (validated.spesialisasi !== undefined) set.spesialisasi = validated.spesialisasi;
    if (validated.noSip !== undefined) set.noSip = validated.noSip;
    if (validated.deskripsi !== undefined) set.deskripsi = validated.deskripsi;
    if (validated.fotoPath !== undefined) set.fotoPath = validated.fotoPath;
    if (validated.aktif !== undefined) set.aktif = validated.aktif;
    if (validated.detail !== undefined) set.detail = validated.detail;

    const layananIds = validated.layananIds;

    if (Object.keys(set).length === 0 && !layananIds) {
      throw new HttpError(400, "Tidak ada data yang diubah");
    }

    await db.transaction(async (tx) => {
      let d;
      if (Object.keys(set).length > 0) {
        [d] = await tx
          .update(dokter)
          .set(set)
          .where(eq(dokter.id, id))
          .returning({ id: dokter.id, profileId: dokter.profileId });
      } else {
        [d] = await tx
          .select({ id: dokter.id, profileId: dokter.profileId })
          .from(dokter)
          .where(eq(dokter.id, id))
          .limit(1);
      }
      if (!d) throw new HttpError(404, "Dokter tidak ditemukan");

      if (layananIds) {
        await tx.delete(dokterLayanan).where(eq(dokterLayanan.dokterId, id));
        await tx
          .insert(dokterLayanan)
          .values(layananIds.map((layananId) => ({ dokterId: id, layananId })));
      }
      // jaga nama di akun login tetap sama, dan nonaktifkan login bila dokter dinonaktifkan
      if (d.profileId) {
        const sp = {};
        if (set.nama) sp.nama = set.nama;
        if (set.aktif !== undefined) sp.statusAktif = set.aktif;
        if (Object.keys(sp).length > 0)
          await tx.update(profiles).set(sp).where(eq(profiles.id, d.profileId));
      }
    });

    const [hasil] = await db
      .select()
      .from(dokter)
      .where(eq(dokter.id, id))
      .limit(1);
    return NextResponse.json({ data: hasil });
  } catch (err) {
    return handleError(err, "PATCH /api/admin/dokter/[id]");
  }
}

export const PATCH = apiHandler(_PATCH, { route: "PATCH /api/admin/dokter/[id]" });
