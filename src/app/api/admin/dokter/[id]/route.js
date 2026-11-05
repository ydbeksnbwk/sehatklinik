import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter, dokterLayanan, profiles } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID, str } from "@/lib/akses";

export async function PATCH(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(400, "id tidak valid");

    const b = await request.json().catch(() => ({}));
    const set = {};
    if (b.nama !== undefined) {
      const nama = str(b.nama);
      if (nama.length < 1 || nama.length > 150)
        throw new HttpError(400, "Nama wajib diisi (maks 150 karakter)");
      set.nama = nama;
    }
    if (b.spesialisasi !== undefined) {
      if (!str(b.spesialisasi))
        throw new HttpError(400, "Spesialisasi tidak boleh kosong");
      set.spesialisasi = str(b.spesialisasi);
    }
    if (b.noSip !== undefined) {
      if (!str(b.noSip))
        throw new HttpError(400, "Nomor SIP tidak boleh kosong");
      set.noSip = str(b.noSip);
    }
    if (b.deskripsi !== undefined) set.deskripsi = str(b.deskripsi) || null;
    if (b.fotoPath !== undefined) set.fotoPath = str(b.fotoPath) || null;
    if (b.aktif !== undefined) {
      if (typeof b.aktif !== "boolean")
        throw new HttpError(400, "aktif harus true atau false");
      set.aktif = b.aktif;
    }

    let layananIds = null;
    if (b.layananIds !== undefined) {
      layananIds = Array.isArray(b.layananIds)
        ? [...new Set(b.layananIds)]
        : [];
      if (
        layananIds.length === 0 ||
        !layananIds.every((x) => typeof x === "string" && UUID.test(x))
      ) {
        throw new HttpError(
          400,
          "layananIds wajib berisi minimal satu id layanan yang valid",
        );
      }
    }
    if (Object.keys(set).length === 0 && !layananIds)
      throw new HttpError(400, "Tidak ada data yang diubah");

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
