import { and, asc, count, desc, eq, max, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  antrean,
  dokter,
  dokterLayanan,
  jadwalPraktik,
  kunjungan,
  pasien,
  vAntreanDetail,
} from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import {
  hariDariTanggal,
  hariIni,
  jamSekarang,
  tanggalValid,
} from "@/lib/tanggal";
import { denganRls } from "@/lib/rls";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS = ["terdaftar", "hadir", "selesai", "batal"];
const str = (v) => (typeof v === "string" ? v.trim() : "");
const jam = (t) => (t ? String(t).slice(0, 5) : t);

// Daftar kunjungan: pasien melihat miliknya, dokter melihat pasiennya, petugas/admin semua.
export async function GET(request) {
  try {
    const { profile } = await requireRole(request);
    const { searchParams } = new URL(request.url);
    const tanggal = searchParams.get("tanggal");
    const status = searchParams.get("status");

    if (tanggal && !tanggalValid(tanggal))
      throw new HttpError(400, "Format tanggal harus YYYY-MM-DD");
    if (status && !STATUS.includes(status))
      throw new HttpError(400, "Status tidak valid");

    const rows = await denganRls(profile.id, async (tx) => {
      const conds = [];
      if (tanggal) conds.push(eq(vAntreanDetail.tanggal, tanggal));
      if (status) conds.push(eq(vAntreanDetail.statusKunjungan, status));

      if (profile.role === "pasien") {
        const [p] = await tx
          .select({ id: pasien.id })
          .from(pasien)
          .where(eq(pasien.profileId, profile.id))
          .limit(1);
        if (!p) return [];
        conds.push(eq(vAntreanDetail.pasienId, p.id));
      } else if (profile.role === "dokter") {
        const [d] = await tx
          .select({ id: dokter.id })
          .from(dokter)
          .where(eq(dokter.profileId, profile.id))
          .limit(1);
        if (!d)
          throw new HttpError(403, "Akun ini belum terhubung ke data dokter");
        conds.push(eq(vAntreanDetail.dokterId, d.id));
      }

      return tx
        .select()
        .from(vAntreanDetail)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(vAntreanDetail.tanggal), asc(vAntreanDetail.nomorAntrean))
        .limit(100);
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        jamMulai: jam(r.jamMulai),
        jamSelesai: jam(r.jamSelesai),
      })),
    });
  } catch (err) {
    return handleError(err, "GET /api/kunjungan");
  }
}
// Daftar kunjungan baru + ambil nomor antrean.
export async function POST(request) {
  try {
    const { profile } = await requireRole(request, [
      "pasien",
      "petugas",
      "admin",
    ]);
    const b = await request.json().catch(() => ({}));
    const jadwalId = str(b.jadwalId);
    const layananId = str(b.layananId);
    const tanggal = str(b.tanggal);
    const keluhan = str(b.keluhan);

    if (!UUID.test(jadwalId)) throw new HttpError(400, "jadwalId tidak valid");
    if (!UUID.test(layananId))
      throw new HttpError(400, "layananId tidak valid");
    if (!tanggalValid(tanggal))
      throw new HttpError(400, "Format tanggal harus YYYY-MM-DD");
    if (keluhan.length < 1 || keluhan.length > 500) {
      throw new HttpError(400, "Keluhan wajib diisi (maks 500 karakter)");
    }
    if (tanggal < hariIni()) throw new HttpError(400, "Tanggal sudah lewat");

    let pasienId;
    let sumber;
    if (profile.role === "pasien") {
      const [p] = await db
        .select({ id: pasien.id })
        .from(pasien)
        .where(eq(pasien.profileId, profile.id))
        .limit(1);
      if (!p) throw new HttpError(400, "Data pasien belum dilengkapi");
      pasienId = p.id;
      sumber = "online";
    } else {
      const id = str(b.pasienId);
      if (!UUID.test(id))
        throw new HttpError(
          400,
          "pasienId wajib diisi untuk pendaftaran oleh petugas",
        );
      const [p] = await db
        .select({ id: pasien.id })
        .from(pasien)
        .where(eq(pasien.id, id))
        .limit(1);
      if (!p) throw new HttpError(404, "Pasien tidak ditemukan");
      pasienId = p.id;
      sumber = "walk_in";
    }

    const result = await db.transaction(async (tx) => {
      const [j] = await tx
        .select({
          id: jadwalPraktik.id,
          dokterId: jadwalPraktik.dokterId,
          hari: jadwalPraktik.hari,
          jamSelesai: jadwalPraktik.jamSelesai,
          kuota: jadwalPraktik.kuota,
        })
        .from(jadwalPraktik)
        .where(
          and(eq(jadwalPraktik.id, jadwalId), eq(jadwalPraktik.aktif, true)),
        )
        .limit(1);
      if (!j) throw new HttpError(404, "Jadwal tidak ditemukan");
      if (j.hari !== hariDariTanggal(tanggal)) {
        throw new HttpError(
          400,
          "Tanggal tidak sesuai hari praktik jadwal ini",
        );
      }
      if (
        tanggal === hariIni() &&
        jamSekarang() >= String(j.jamSelesai).slice(0, 5)
      ) {
        throw new HttpError(400, "Jam praktik hari ini sudah berakhir");
      }

      // kunci baris dokter agar pendaftar bersamaan diproses berurutan
      const [d] = await tx
        .select({ id: dokter.id })
        .from(dokter)
        .where(and(eq(dokter.id, j.dokterId), eq(dokter.aktif, true)))
        .for("update");
      if (!d) throw new HttpError(404, "Dokter tidak aktif");

      const [dl] = await tx
        .select({ id: dokterLayanan.layananId })
        .from(dokterLayanan)
        .where(
          and(
            eq(dokterLayanan.dokterId, j.dokterId),
            eq(dokterLayanan.layananId, layananId),
          ),
        )
        .limit(1);
      if (!dl)
        throw new HttpError(400, "Dokter ini tidak melayani layanan tersebut");

      const [{ n }] = await tx
        .select({ n: count() })
        .from(kunjungan)
        .where(
          and(
            eq(kunjungan.jadwalId, j.id),
            eq(kunjungan.tanggal, tanggal),
            ne(kunjungan.status, "batal"),
          ),
        );
      if (n >= j.kuota)
        throw new HttpError(409, "Kuota jadwal ini sudah penuh");

      const [{ m }] = await tx
        .select({ m: max(antrean.nomorAntrean) })
        .from(antrean)
        .where(
          and(eq(antrean.dokterId, j.dokterId), eq(antrean.tanggal, tanggal)),
        );
      const nomorAntrean = (m ?? 0) + 1;

      const [k] = await tx
        .insert(kunjungan)
        .values({
          pasienId,
          dokterId: j.dokterId,
          layananId,
          jadwalId: j.id,
          dibuatOleh: profile.id,
          tanggal,
          keluhan,
          sumber,
        })
        .returning({ id: kunjungan.id, noReferensi: kunjungan.noReferensi });

      await tx.insert(antrean).values({
        kunjunganId: k.id,
        dokterId: j.dokterId,
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

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/kunjungan");
  }
}
