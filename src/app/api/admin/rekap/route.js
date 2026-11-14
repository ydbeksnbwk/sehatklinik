import { apiHandler } from "@/lib/api-handler";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  antrean,
  dokter,
  kunjungan,
  layanan,
  pasien,
  pemeriksaan,
} from "@/db/schema";
import { handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";

async function _GET(request) {
  try {
    await requireRole(request, ["admin"]);

    const { searchParams } = new URL(request.url);
    const dariTanggal = searchParams.get("dariTanggal")?.trim();
    const sampaiTanggal = searchParams.get("sampaiTanggal")?.trim();
    const dokterId = searchParams.get("dokterId")?.trim();
    const layananId = searchParams.get("layananId")?.trim();
    const statusParam = searchParams.get("status")?.trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (dariTanggal && /^\d{4}-\d{2}-\d{2}$/.test(dariTanggal)) {
      conditions.push(gte(kunjungan.tanggal, dariTanggal));
    }

    if (sampaiTanggal && /^\d{4}-\d{2}-\d{2}$/.test(sampaiTanggal)) {
      conditions.push(lte(kunjungan.tanggal, sampaiTanggal));
    }

    if (dokterId && UUID.test(dokterId)) {
      conditions.push(eq(kunjungan.dokterId, dokterId));
    }

    if (layananId && UUID.test(layananId)) {
      conditions.push(eq(kunjungan.layananId, layananId));
    }

    if (statusParam && ["terdaftar", "hadir", "selesai", "batal"].includes(statusParam)) {
      conditions.push(eq(kunjungan.status, statusParam));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Agregasi ringkasan statistik
    const [stats] = await db
      .select({
        totalKunjungan: count(),
        totalTerdaftar: sql`count(*) FILTER (WHERE ${kunjungan.status} = 'terdaftar')`,
        totalHadir: sql`count(*) FILTER (WHERE ${kunjungan.status} = 'hadir')`,
        totalSelesai: sql`count(*) FILTER (WHERE ${kunjungan.status} = 'selesai')`,
        totalBatal: sql`count(*) FILTER (WHERE ${kunjungan.status} = 'batal')`,
      })
      .from(kunjungan)
      .where(whereClause);

    const total = Number(stats?.totalKunjungan || 0);

    // 2. Daftar baris rekap berpaginasi
    const rows = await db
      .select({
        id: kunjungan.id,
        noReferensi: kunjungan.noReferensi,
        tanggal: kunjungan.tanggal,
        status: kunjungan.status,
        sumber: kunjungan.sumber,
        keluhan: kunjungan.keluhan,
        dokterId: kunjungan.dokterId,
        namaDokter: dokter.nama,
        spesialisasi: dokter.spesialisasi,
        layananId: kunjungan.layananId,
        namaLayanan: layanan.namaLayanan,
        durasiMenit: layanan.durasiMenit,
        pasienId: kunjungan.pasienId,
        namaPasien: pasien.nama,
        noRekamMedis: pasien.noRekamMedis,
        nomorAntrean: antrean.nomorAntrean,
        statusAntrean: antrean.status,
        pemeriksaanId: pemeriksaan.id,
        createdAt: kunjungan.createdAt,
      })
      .from(kunjungan)
      .innerJoin(dokter, eq(dokter.id, kunjungan.dokterId))
      .innerJoin(layanan, eq(layanan.id, kunjungan.layananId))
      .leftJoin(pasien, eq(pasien.id, kunjungan.pasienId))
      .leftJoin(antrean, eq(antrean.kunjunganId, kunjungan.id))
      .leftJoin(pemeriksaan, eq(pemeriksaan.kunjunganId, kunjungan.id))
      .where(whereClause)
      .orderBy(desc(kunjungan.tanggal), desc(kunjungan.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalPages = Math.ceil(total / pageSize) || 1;

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        noReferensi: r.noReferensi,
        tanggal: r.tanggal,
        status: r.status,
        sumber: r.sumber,
        keluhan: r.keluhan,
        dokter: {
          id: r.dokterId,
          nama: r.namaDokter,
          spesialisasi: r.spesialisasi,
        },
        layanan: {
          id: r.layananId,
          namaLayanan: r.namaLayanan,
          durasiMenit: r.durasiMenit,
        },
        pasien: {
          id: r.pasienId,
          nama: r.namaPasien || "Pasien Walk-in",
          noRekamMedis: r.noRekamMedis || "-",
        },
        nomorAntrean: r.nomorAntrean || 0,
        statusAntrean: r.statusAntrean || "menunggu",
        adaPemeriksaan: Boolean(r.pemeriksaanId),
        createdAt: r.createdAt,
      })),
      ringkasan: {
        totalKunjungan: Number(stats?.totalKunjungan || 0),
        totalTerdaftar: Number(stats?.totalTerdaftar || 0),
        totalHadir: Number(stats?.totalHadir || 0),
        totalSelesai: Number(stats?.totalSelesai || 0),
        totalBatal: Number(stats?.totalBatal || 0),
      },
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/rekap");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/admin/rekap" });
