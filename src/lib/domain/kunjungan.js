// src/lib/domain/kunjungan.js
// Logika bisnis pendaftaran kunjungan (BR-01, 02, 03, 04, 13, 14)
// Akses data murni via Drizzle ORM. Dilarang createAdminClient.

import { and, count, eq, max, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  antrean,
  dokter,
  dokterLayanan,
  jadwalPraktik,
  kunjungan,
  pasien,
} from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { hariDariTanggal, hariIni, jamSekarang } from "@/lib/tanggal";

/**
 * Daftarkan kunjungan baru dalam satu transaksi DB.
 * BR-01: kuota, BR-02: duplikat, BR-03: nomor antrean,
 * BR-04: transaksi + kunci, BR-13: hari cocok, BR-14: dokter aktif + layanan.
 *
 * @param {{ pasienId: string, jadwalId: string, layananId: string,
 *            tanggal: string, keluhan: string, sumber: string, dibuatOleh: string }} params
 * @returns {{ id, noReferensi, tanggal, nomorAntrean, status }}
 */
export async function daftarKunjungan({
  pasienId,
  jadwalId,
  layananId,
  tanggal,
  keluhan,
  sumber,
  dibuatOleh,
}) {
  return db.transaction(async (tx) => {
    // Kunci baris jadwal untuk mencegah race condition (BR-04)
    const [j] = await tx
      .select({
        id: jadwalPraktik.id,
        dokterId: jadwalPraktik.dokterId,
        hari: jadwalPraktik.hari,
        jamMulai: jadwalPraktik.jamMulai,
        jamSelesai: jadwalPraktik.jamSelesai,
        kuota: jadwalPraktik.kuota,
      })
      .from(jadwalPraktik)
      .where(and(eq(jadwalPraktik.id, jadwalId), eq(jadwalPraktik.aktif, true)))
      .for("update")
      .limit(1);

    if (!j) throw new HttpError(404, "Jadwal tidak ditemukan atau tidak aktif");

    // BR-13: hari pada tanggal harus cocok dengan hari jadwal
    if (j.hari !== hariDariTanggal(tanggal)) {
      throw new HttpError(400, "Tanggal tidak sesuai hari praktik jadwal ini");
    }

    // BR-13: jika hari ini, jam praktik belum berakhir
    if (
      tanggal === hariIni() &&
      jamSekarang() >= String(j.jamSelesai).slice(0, 5)
    ) {
      throw new HttpError(400, "Jam praktik hari ini sudah berakhir");
    }

    // BR-14: kunci baris dokter sekaligus cek aktif
    // Advisory lock per (dokter_id, tanggal) untuk nomor antrean unik
    const dokterId = j.dokterId;
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${dokterId}::text || ${tanggal}))`
    );

    const [d] = await tx
      .select({ id: dokter.id })
      .from(dokter)
      .where(and(eq(dokter.id, dokterId), eq(dokter.aktif, true)))
      .for("update")
      .limit(1);

    if (!d) throw new HttpError(404, "Dokter tidak aktif");

    // BR-14: dokter harus melayani layanan yang dipilih
    const [dl] = await tx
      .select({ layananId: dokterLayanan.layananId })
      .from(dokterLayanan)
      .where(
        and(
          eq(dokterLayanan.dokterId, dokterId),
          eq(dokterLayanan.layananId, layananId)
        )
      )
      .limit(1);

    if (!dl)
      throw new HttpError(400, "Dokter ini tidak melayani layanan tersebut");

    // BR-02: cek kunjungan duplikat (pasien, jadwal, tanggal) yang masih aktif
    const [{ dup }] = await tx
      .select({ dup: count() })
      .from(kunjungan)
      .where(
        and(
          eq(kunjungan.pasienId, pasienId),
          eq(kunjungan.jadwalId, j.id),
          eq(kunjungan.tanggal, tanggal),
          ne(kunjungan.status, "batal")
        )
      );

    if (dup > 0) {
      throw new HttpError(
        409,
        "Pasien sudah terdaftar pada jadwal dan tanggal yang sama",
        "DUPLIKAT"
      );
    }

    // BR-01: cek kuota
    const [{ n }] = await tx
      .select({ n: count() })
      .from(kunjungan)
      .where(
        and(
          eq(kunjungan.jadwalId, j.id),
          eq(kunjungan.tanggal, tanggal),
          ne(kunjungan.status, "batal")
        )
      );

    if (n >= j.kuota) {
      throw new HttpError(409, "Kuota jadwal ini sudah penuh", "KUOTA_PENUH");
    }

    // BR-03: nomor antrean urut per dokter & tanggal
    const [{ m }] = await tx
      .select({ m: max(antrean.nomorAntrean) })
      .from(antrean)
      .where(and(eq(antrean.dokterId, dokterId), eq(antrean.tanggal, tanggal)));

    const nomorAntrean = (m ?? 0) + 1;

    // Simpan kunjungan
    const [k] = await tx
      .insert(kunjungan)
      .values({
        pasienId,
        dokterId,
        layananId,
        jadwalId: j.id,
        dibuatOleh,
        tanggal,
        keluhan,
        sumber,
      })
      .returning({ id: kunjungan.id, noReferensi: kunjungan.noReferensi });

    // Simpan antrean (trigger DB membuat baris notifikasi)
    await tx.insert(antrean).values({
      kunjunganId: k.id,
      dokterId,
      tanggal,
      nomorAntrean,
    });

    return {
      id: k.id,
      noReferensi: k.noReferensi,
      tanggal,
      nomorAntrean,
      status: "terdaftar",
    };
  });
}

/**
 * Ambil data pasien berdasarkan profileId.
 * @param {string} profileId
 * @returns {{ id: string }}
 */
export async function ambilPasienDariProfile(profileId) {
  const [p] = await db
    .select({ id: pasien.id })
    .from(pasien)
    .where(eq(pasien.profileId, profileId))
    .limit(1);

  if (!p) throw new HttpError(400, "Data pasien belum dilengkapi");
  return p;
}
