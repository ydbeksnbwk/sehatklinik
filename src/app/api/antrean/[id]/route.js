import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { antrean, kunjungan } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID, cekHariH, dokterIdDari, str } from "@/lib/akses";

export async function PATCH(request, { params }) {
  try {
    const { profile } = await requireRole(request, [
      "petugas",
      "dokter",
      "admin",
    ]);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(400, "id tidak valid");

    const b = await request.json().catch(() => ({}));
    const aksi = str(b.aksi);
    const alasan = str(b.alasan);
    if (!["panggil", "periksa", "lewati"].includes(aksi)) {
      throw new HttpError(400, "aksi harus panggil, periksa, atau lewati");
    }
    if (aksi === "periksa" && profile.role !== "dokter") {
      throw new HttpError(403, "Hanya dokter yang dapat memulai pemeriksaan");
    }
    if (aksi === "lewati" && !alasan)
      throw new HttpError(400, "Alasan wajib diisi");

    const [a] = await db
      .select({
        id: antrean.id,
        dokterId: antrean.dokterId,
        tanggal: antrean.tanggal,
        status: antrean.status,
        statusKunjungan: kunjungan.status,
      })
      .from(antrean)
      .innerJoin(kunjungan, eq(antrean.kunjunganId, kunjungan.id))
      .where(eq(antrean.id, id))
      .limit(1);
    if (!a) throw new HttpError(404, "Antrean tidak ditemukan");

    if (profile.role === "dokter") {
      const myId = await dokterIdDari(profile);
      if (a.dokterId !== myId)
        throw new HttpError(404, "Antrean tidak ditemukan");
    }

    let dari;
    let ke;
    const set = {};
    if (aksi === "panggil") {
      dari = "menunggu";
      ke = "dipanggil";
      if (a.statusKunjungan !== "hadir")
        throw new HttpError(409, "Pasien belum check-in");
      cekHariH(a.tanggal);
    } else if (aksi === "periksa") {
      dari = "dipanggil";
      ke = "diperiksa";
    } else {
      dari = "dipanggil";
      ke = "dilewati";
      set.alasan = alasan;
    }
    if (a.status !== dari)
      throw new HttpError(409, `Antrean berstatus ${a.status}, bukan ${dari}`);

    const res = await db
      .update(antrean)
      .set({ status: ke, ...set })
      .where(and(eq(antrean.id, id), eq(antrean.status, dari)))
      .returning({ id: antrean.id });
    if (res.length === 0)
      throw new HttpError(409, "Status antrean sudah berubah");

    return NextResponse.json({ data: { id, status: ke } });
  } catch (err) {
    return handleError(err, "PATCH /api/antrean/[id]");
  }
}
