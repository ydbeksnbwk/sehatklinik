import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dokter, kunjungan, layanan, pasien, pemeriksaan } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID, dokterIdDari } from "@/lib/akses";
import { denganRls } from "@/lib/rls";

// Pasien: riwayat miliknya. Dokter: hanya pasien yang pernah ia tangani.
// Petugas/admin: semua pasien. Dokter, petugas, dan admin wajib mengirim ?pasienId=
export async function GET(request) {
  try {
    const { profile } = await requireRole(request);
    const { searchParams } = new URL(request.url);

    let pasienIdParam = "";
    let dokterId = null;
    if (profile.role !== "pasien") {
      pasienIdParam = searchParams.get("pasienId") || "";
      if (!UUID.test(pasienIdParam))
        throw new HttpError(400, "pasienId wajib diisi");
      if (profile.role === "dokter") dokterId = await dokterIdDari(profile);
    }

    const rows = await denganRls(profile.id, async (tx) => {
      let pasienId = pasienIdParam;
      if (profile.role === "pasien") {
        const [p] = await tx
          .select({ id: pasien.id })
          .from(pasien)
          .where(eq(pasien.profileId, profile.id))
          .limit(1);
        if (!p) return [];
        pasienId = p.id;
      }

      const conds = [eq(kunjungan.pasienId, pasienId)];
      if (dokterId) conds.push(eq(kunjungan.dokterId, dokterId));

      return tx
        .select({
          id: kunjungan.id,
          noReferensi: kunjungan.noReferensi,
          tanggal: kunjungan.tanggal,
          keluhan: kunjungan.keluhan,
          status: kunjungan.status,
          namaDokter: dokter.nama,
          namaLayanan: layanan.namaLayanan,
          anamnesis: pemeriksaan.anamnesis,
          tandaVital: pemeriksaan.tandaVital,
          diagnosis: pemeriksaan.diagnosis,
          catatan: pemeriksaan.catatan,
        })
        .from(kunjungan)
        .innerJoin(dokter, eq(kunjungan.dokterId, dokter.id))
        .innerJoin(layanan, eq(kunjungan.layananId, layanan.id))
        .leftJoin(pemeriksaan, eq(pemeriksaan.kunjunganId, kunjungan.id))
        .where(and(...conds))
        .orderBy(desc(kunjungan.tanggal))
        .limit(100);
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleError(err, "GET /api/riwayat");
  }
}
