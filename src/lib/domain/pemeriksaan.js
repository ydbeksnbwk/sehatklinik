// src/lib/domain/pemeriksaan.js
// Logika bisnis penyimpanan pemeriksaan dan tindakan (BR-09, BR-10, BR-18)
// Akses data murni via Drizzle ORM.

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  antrean,
  dokter,
  kunjungan,
  pemeriksaan as pemeriksaanTable,
  tindakan as tindakanTable,
} from "@/db/schema";
import { HttpError } from "@/lib/auth";

/**
 * Simpan atau perbarui pemeriksaan dan tindakan dalam satu transaksi.
 * BR-10: hanya dokter pemilik, status antrean harus 'diperiksa'.
 * BR-18: rentang tanda vital sudah divalidasi Zod di lapisan validasi.
 *
 * @param {{ kunjunganId: string, profileId: string,
 *            anamnesis: string, diagnosis: string, catatan?: string,
 *            tandaVital?: object, tindakan?: Array }} params
 * @returns {{ pemeriksaanId: string }}
 */
export async function simpanPemeriksaan({
  kunjunganId,
  profileId,
  anamnesis,
  diagnosis,
  catatan,
  tandaVital,
  tindakan,
}) {
  return db.transaction(async (tx) => {
    // Ambil dokter ID dari profile (hanya dokter yang bisa akses)
    const [d] = await tx
      .select({ id: dokter.id })
      .from(dokter)
      .where(eq(dokter.profileId, profileId))
      .limit(1);

    if (!d) throw new HttpError(403, "Akun ini belum terhubung ke data dokter");

    // Ambil kunjungan dan pastikan dokter adalah pemilik
    const [k] = await tx
      .select({
        id: kunjungan.id,
        dokterId: kunjungan.dokterId,
        status: kunjungan.status,
      })
      .from(kunjungan)
      .where(eq(kunjungan.id, kunjunganId))
      .limit(1);

    if (!k) throw new HttpError(404, "Kunjungan tidak ditemukan");

    // BR-10: hanya dokter pemilik kunjungan
    if (k.dokterId !== d.id) {
      throw new HttpError(403, "Anda bukan dokter pemeriksa kunjungan ini");
    }

    // BR-10: antrean harus berstatus 'diperiksa'
    const [a] = await tx
      .select({ id: antrean.id, status: antrean.status })
      .from(antrean)
      .where(eq(antrean.kunjunganId, kunjunganId))
      .limit(1);

    if (!a || a.status !== "diperiksa") {
      throw new HttpError(
        409,
        "Pemeriksaan hanya dapat disimpan saat antrean berstatus Sedang Diperiksa",
        "STATUS_TIDAK_VALID"
      );
    }

    // Upsert: hapus pemeriksaan lama jika ada, lalu insert baru
    const [existing] = await tx
      .select({ id: pemeriksaanTable.id })
      .from(pemeriksaanTable)
      .where(eq(pemeriksaanTable.kunjunganId, kunjunganId))
      .limit(1);

    let pemeriksaanId;

    if (existing) {
      // Update pemeriksaan
      await tx
        .update(pemeriksaanTable)
        .set({
          anamnesis,
          tandaVital: tandaVital ?? {},
          diagnosis,
          catatan: catatan ?? null,
        })
        .where(eq(pemeriksaanTable.id, existing.id));

      // Hapus tindakan lama dan insert baru
      if (tindakan && tindakan.length > 0) {
        await tx
          .delete(tindakanTable)
          .where(eq(tindakanTable.pemeriksaanId, existing.id));

        await tx.insert(tindakanTable).values(
          tindakan.map((t) => ({
            pemeriksaanId: existing.id,
            namaTindakan: t.namaTindakan,
            keterangan: t.keterangan ?? null,
            saran: t.saran ?? null,
          }))
        );
      }
      pemeriksaanId = existing.id;
    } else {
      // Insert pemeriksaan baru
      const [pm] = await tx
        .insert(pemeriksaanTable)
        .values({
          kunjunganId,
          dokterId: d.id,
          anamnesis,
          tandaVital: tandaVital ?? {},
          diagnosis,
          catatan: catatan ?? null,
        })
        .returning({ id: pemeriksaanTable.id });

      pemeriksaanId = pm.id;

      // Insert tindakan
      if (tindakan && tindakan.length > 0) {
        await tx.insert(tindakanTable).values(
          tindakan.map((t) => ({
            pemeriksaanId,
            namaTindakan: t.namaTindakan,
            keterangan: t.keterangan ?? null,
            saran: t.saran ?? null,
          }))
        );
      }
    }

    return { pemeriksaanId };
  });
}
