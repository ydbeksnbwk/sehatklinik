import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { antrean, kunjungan, pasien } from "@/db/schema";

import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID, cekHariH, str } from "@/lib/akses";

export async function PATCH(request, { params }) {
  try {
    const { profile } = await requireRole(request, [
      "pasien",
      "petugas",
      "admin",
    ]);

    const { id } = params;

    if (!UUID.test(id)) {
      throw new HttpError(400, "id tidak valid");
    }

    const b = await request.json().catch(() => ({}));

    const aksi = str(b.aksi);
    const alasan = str(b.alasan);

    if (!["checkin", "batal"].includes(aksi)) {
      throw new HttpError(400, "aksi harus checkin atau batal");
    }

    const [k] = await db
      .select({
        id: kunjungan.id,
        pasienId: kunjungan.pasienId,
        tanggal: kunjungan.tanggal,
        status: kunjungan.status,
      })
      .from(kunjungan)
      .where(eq(kunjungan.id, id))
      .limit(1);

    if (!k) {
      throw new HttpError(404, "Kunjungan tidak ditemukan");
    }

    if (profile.role === "pasien") {
      if (aksi !== "batal") {
        throw new HttpError(403, "Akses ditolak untuk peran ini");
      }

      const [p] = await db
        .select({
          id: pasien.id,
        })
        .from(pasien)
        .where(eq(pasien.profileId, profile.id))
        .limit(1);

      if (!p || p.id !== k.pasienId) {
        throw new HttpError(404, "Kunjungan tidak ditemukan");
      }

      if (k.status !== "terdaftar") {
        throw new HttpError(
          409,
          k.status === "batal"
            ? "Kunjungan sudah dibatalkan"
            : "Pembatalan hanya dapat dilakukan sebelum check-in",
        );
      }
    }

    if (aksi === "checkin") {
      if (k.status !== "terdaftar") {
        throw new HttpError(409, `Kunjungan berstatus ${k.status}`);
      }

      cekHariH(k.tanggal);

      const res = await db
        .update(kunjungan)
        .set({
          status: "hadir",
        })
        .where(and(eq(kunjungan.id, id), eq(kunjungan.status, "terdaftar")))
        .returning({
          id: kunjungan.id,
        });

      if (res.length === 0) {
        throw new HttpError(409, "Status kunjungan sudah berubah");
      }

      return NextResponse.json({
        data: {
          id,
          status: "hadir",
        },
      });
    }

    // batal
    if (!alasan) {
      throw new HttpError(400, "Alasan pembatalan wajib diisi");
    }

    if (!["terdaftar", "hadir"].includes(k.status)) {
      throw new HttpError(
        409,
        `Kunjungan berstatus ${k.status} dan tidak dapat dibatalkan`,
      );
    }

    await db.transaction(async (tx) => {
      const [a] = await tx
        .select({
          status: antrean.status,
        })
        .from(antrean)
        .where(eq(antrean.kunjunganId, id))
        .limit(1);

      if (a && !["menunggu", "dipanggil"].includes(a.status)) {
        throw new HttpError(
          409,
          "Pasien sudah dalam pemeriksaan, tidak dapat dibatalkan",
        );
      }

      if (a) {
        await tx
          .update(antrean)
          .set({
            status: "batal",
            alasan,
          })
          .where(
            and(
              eq(antrean.kunjunganId, id),
              inArray(antrean.status, ["menunggu", "dipanggil"]),
            ),
          );
      }

      const res = await tx
        .update(kunjungan)
        .set({
          status: "batal",
        })
        .where(
          and(
            eq(kunjungan.id, id),
            inArray(kunjungan.status, ["terdaftar", "hadir"]),
          ),
        )
        .returning({
          id: kunjungan.id,
        });

      if (res.length === 0) {
        throw new HttpError(409, "Status kunjungan sudah berubah");
      }
    });

    return NextResponse.json({
      data: {
        id,
        status: "batal",
      },
    });
  } catch (err) {
    return handleError(err, "PATCH /api/kunjungan/[id]");
  }
}
