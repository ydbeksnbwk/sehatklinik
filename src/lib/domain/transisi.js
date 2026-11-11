// src/lib/domain/transisi.js
// Logika bisnis state machine antrean dan kunjungan
// BR-05, 06, 07, 08, 09, 15, K11, K12, K14

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  antrean,
  dokter,
  jadwalPraktik,
  kunjungan,
  pasien,
} from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { selisihJamKe } from "@/lib/tanggal";

// K11: batas jam pembatalan oleh pasien (2 jam sebelum praktik)
export const BATAS_BATAL_JAM = 2;

/**
 * Jalankan transisi status antrean/kunjungan dalam satu transaksi.
 *
 * @param {{ kunjunganId: string, aksi: string, alasan?: string,
 *            role: string, profileId: string }} params
 */
export async function jalankanTransisi({
  kunjunganId,
  aksi,
  alasan,
  role,
  profileId,
}) {
  return db.transaction(async (tx) => {
    // Admin selalu ditolak (K12)
    if (role === "admin") {
      throw new HttpError(403, "Admin tidak berwenang melakukan transisi antrean");
    }

    // Role check di awal: cegah akses aksi di luar kewenangan peran
    if (aksi === "checkin" && role !== "petugas") {
      throw new HttpError(403, "Hanya petugas yang dapat melakukan check-in");
    }
    if ((aksi === "panggil" || aksi === "lewati") && role === "pasien") {
      throw new HttpError(403, "Pasien tidak berwenang melakukan aksi ini");
    }
    if ((aksi === "periksa" || aksi === "selesai") && role !== "dokter") {
      throw new HttpError(403, "Hanya dokter yang dapat melakukan aksi ini");
    }

    // Ambil kunjungan + antrean sekaligus dengan kunci baris
    const [k] = await tx
      .select({
        id: kunjungan.id,
        pasienId: kunjungan.pasienId,
        dokterId: kunjungan.dokterId,
        jadwalId: kunjungan.jadwalId,
        tanggal: kunjungan.tanggal,
        statusKunjungan: kunjungan.status,
      })
      .from(kunjungan)
      .where(eq(kunjungan.id, kunjunganId))
      .for("update")
      .limit(1);

    if (!k) throw new HttpError(404, "Kunjungan tidak ditemukan");

    const [a] = await tx
      .select({
        id: antrean.id,
        statusAntrean: antrean.status,
        dokterId: antrean.dokterId,
      })
      .from(antrean)
      .where(eq(antrean.kunjunganId, kunjunganId))
      .for("update")
      .limit(1);

    if (!a) throw new HttpError(404, "Data antrean tidak ditemukan");

    // Admin selalu ditolak (K12)
    if (role === "admin") {
      throw new HttpError(403, "Admin tidak berwenang melakukan transisi antrean");
    }

    // Proses tiap aksi
    switch (aksi) {
      case "checkin": {
        // Hanya petugas (K12)
        if (role !== "petugas") {
          throw new HttpError(403, "Hanya petugas yang dapat melakukan check-in");
        }
        // BR-07: Terdaftar -> Hadir
        if (k.statusKunjungan !== "terdaftar") {
          throw new HttpError(409, "Check-in hanya bisa dari status Terdaftar", "STATUS_TIDAK_VALID");
        }
        await tx
          .update(kunjungan)
          .set({ status: "hadir" })
          .where(eq(kunjungan.id, kunjunganId));
        return { aksi, statusKunjungan: "hadir", statusAntrean: a.statusAntrean };
      }

      case "panggil": {
        // Petugas atau dokter pemilik (K14)
        if (role === "pasien") {
          throw new HttpError(403, "Pasien tidak berwenang memanggil antrean");
        }
        if (role === "dokter") {
          await cekDokterPemilik(tx, a.dokterId, profileId);
        }
        // BR-05: harus sudah check-in (kunjungan Hadir)
        if (k.statusKunjungan !== "hadir") {
          throw new HttpError(
            409,
            "Antrean hanya dapat dipanggil setelah check-in (status Hadir)",
            "STATUS_TIDAK_VALID"
          );
        }
        // BR-06: Menunggu -> Dipanggil
        if (a.statusAntrean !== "menunggu") {
          throw new HttpError(409, "Antrean hanya dapat dipanggil dari status Menunggu", "STATUS_TIDAK_VALID");
        }
        await tx
          .update(antrean)
          .set({ status: "dipanggil", waktuDipanggil: new Date().toISOString() })
          .where(eq(antrean.id, a.id));
        return { aksi, statusKunjungan: k.statusKunjungan, statusAntrean: "dipanggil" };
      }

      case "periksa": {
        // Hanya dokter pemilik (K14)
        if (role !== "dokter") {
          throw new HttpError(403, "Hanya dokter yang dapat memulai pemeriksaan");
        }
        await cekDokterPemilik(tx, a.dokterId, profileId);
        // BR-06: Dipanggil -> Diperiksa
        if (a.statusAntrean !== "dipanggil") {
          throw new HttpError(409, "Pemeriksaan hanya dapat dimulai dari status Dipanggil", "STATUS_TIDAK_VALID");
        }
        await tx
          .update(antrean)
          .set({ status: "diperiksa" })
          .where(eq(antrean.id, a.id));
        return { aksi, statusKunjungan: k.statusKunjungan, statusAntrean: "diperiksa" };
      }

      case "lewati": {
        // Petugas atau dokter pemilik
        if (role === "pasien") {
          throw new HttpError(403, "Pasien tidak berwenang melewati antrean");
        }
        if (role === "dokter") {
          await cekDokterPemilik(tx, a.dokterId, profileId);
        }
        // BR-15: alasan wajib (sudah divalidasi Zod, tapi double check)
        if (!alasan || alasan.trim().length < 3) {
          throw new HttpError(400, "Alasan pelewatan wajib diisi minimal 3 karakter");
        }
        // BR-06: Dipanggil -> Dilewati
        if (a.statusAntrean !== "dipanggil") {
          throw new HttpError(409, "Hanya antrean Dipanggil yang dapat dilewati", "STATUS_TIDAK_VALID");
        }
        await tx
          .update(antrean)
          .set({ status: "dilewati", alasan: alasan.trim() })
          .where(eq(antrean.id, a.id));
        return { aksi, statusKunjungan: k.statusKunjungan, statusAntrean: "dilewati" };
      }

      case "batal": {
        // Pembatalan oleh pasien (BR-08, K11)
        if (role === "pasien") {
          // Pasien hanya bisa batalkan miliknya
          const [p] = await tx
            .select({ id: pasien.id })
            .from(pasien)
            .where(eq(pasien.profileId, profileId))
            .limit(1);

          if (!p || p.id !== k.pasienId) {
            throw new HttpError(403, "Anda tidak berhak membatalkan kunjungan ini");
          }
          // Hanya jika antrean masih Menunggu
          if (a.statusAntrean !== "menunggu") {
            throw new HttpError(
              409,
              "Pembatalan oleh pasien hanya bisa saat antrean masih Menunggu",
              "STATUS_TIDAK_VALID"
            );
          }
          // BR-08: maksimal BATAS_BATAL_JAM jam sebelum jam praktik
          const [jp] = await tx
            .select({ jamMulai: jadwalPraktik.jamMulai })
            .from(jadwalPraktik)
            .where(eq(jadwalPraktik.id, k.jadwalId))
            .limit(1);

          if (jp) {
            const selisih = selisihJamKe(k.tanggal, jp.jamMulai);
            if (selisih < BATAS_BATAL_JAM) {
              throw new HttpError(
                409,
                `Pembatalan hanya dapat dilakukan minimal ${BATAS_BATAL_JAM} jam sebelum praktik`,
                "STATUS_TIDAK_VALID"
              );
            }
          }
        } else if (role === "petugas") {
          // BR-15: petugas wajib isi alasan
          if (!alasan || alasan.trim().length < 3) {
            throw new HttpError(400, "Alasan pembatalan wajib diisi minimal 3 karakter");
          }
          // K12: petugas hanya bisa batalkan Menunggu atau Dipanggil
          if (!["menunggu", "dipanggil"].includes(a.statusAntrean)) {
            throw new HttpError(
              409,
              "Pembatalan oleh petugas hanya bisa dari status Menunggu atau Dipanggil",
              "STATUS_TIDAK_VALID"
            );
          }
        } else {
          throw new HttpError(403, "Hanya pasien atau petugas yang dapat membatalkan kunjungan");
        }

        // Update antrean dan kunjungan
        await tx
          .update(antrean)
          .set({ status: "batal", alasan: alasan ? alasan.trim() : null })
          .where(eq(antrean.id, a.id));
        await tx
          .update(kunjungan)
          .set({ status: "batal" })
          .where(eq(kunjungan.id, kunjunganId));

        return { aksi, statusKunjungan: "batal", statusAntrean: "batal" };
      }

      case "selesai": {
        // Hanya dokter pemilik
        if (role !== "dokter") {
          throw new HttpError(403, "Hanya dokter yang dapat menyelesaikan kunjungan");
        }
        await cekDokterPemilik(tx, a.dokterId, profileId);
        // BR-09: harus ada pemeriksaan
        // Pemeriksaan hanya bisa diakses saat diperiksa
        if (a.statusAntrean !== "diperiksa") {
          throw new HttpError(409, "Kunjungan hanya dapat diselesaikan dari status Diperiksa", "STATUS_TIDAK_VALID");
        }
        // Cek keberadaan pemeriksaan
        const { pemeriksaan } = await import("@/db/schema");
        const [pm] = await tx
          .select({ id: pemeriksaan.id })
          .from(pemeriksaan)
          .where(eq(pemeriksaan.kunjunganId, kunjunganId))
          .limit(1);

        if (!pm) {
          throw new HttpError(409, "Kunjungan tidak dapat diselesaikan sebelum ada catatan pemeriksaan", "STATUS_TIDAK_VALID");
        }

        await tx
          .update(antrean)
          .set({ status: "selesai" })
          .where(eq(antrean.id, a.id));
        await tx
          .update(kunjungan)
          .set({ status: "selesai" })
          .where(eq(kunjungan.id, kunjunganId));

        return { aksi, statusKunjungan: "selesai", statusAntrean: "selesai" };
      }

      default:
        throw new HttpError(400, "Aksi tidak dikenali");
    }
  });
}

/**
 * Cek bahwa dokter yang login adalah dokter pemilik antrean.
 */
async function cekDokterPemilik(tx, dokterId, profileId) {
  const [d] = await tx
    .select({ id: dokter.id })
    .from(dokter)
    .where(and(eq(dokter.id, dokterId), eq(dokter.profileId, profileId)))
    .limit(1);

  if (!d) {
    throw new HttpError(403, "Anda bukan dokter pemilik kunjungan ini");
  }
  return d;
}
