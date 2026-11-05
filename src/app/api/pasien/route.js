import { asc, count, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { pasien } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { denganRls } from "@/lib/rls";
import { hariIni, tanggalValid } from "@/lib/tanggal";

const TELEPON = /^\+?[0-9]{8,15}$/;
const NIK = /^[0-9]{16}$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

export async function GET(request) {
  try {
    const { profile } = await requireRole(request, ["petugas", "admin"]);
    const { searchParams } = new URL(request.url);
    const q = str(searchParams.get("q"));
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1,
    );
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10) || 10),
    );

    const where = q
      ? or(
          ilike(pasien.nama, `%${q}%`),
          ilike(pasien.noRekamMedis, `%${q}%`),
          ilike(pasien.nik, `%${q}%`),
          ilike(pasien.telepon, `%${q}%`),
        )
      : undefined;

    const { total, rows } = await denganRls(profile.id, async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(pasien)
        .where(where);
      const rows = await tx
        .select({
          id: pasien.id,
          noRekamMedis: pasien.noRekamMedis,
          nama: pasien.nama,
          nik: pasien.nik,
          tanggalLahir: pasien.tanggalLahir,
          jenisKelamin: pasien.jenisKelamin,
          telepon: pasien.telepon,
          punyaAkun: pasien.profileId,
        })
        .from(pasien)
        .where(where)
        .orderBy(asc(pasien.nama))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      return { total, rows };
    });

    return NextResponse.json({
      data: rows.map((r) => ({ ...r, punyaAkun: r.punyaAkun !== null })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/pasien");
  }
}

// Pasien walk-in tanpa akun login. Hanya petugas (kebijakan database: pasien_insert).
export async function POST(request) {
  try {
    const { profile } = await requireRole(request, ["petugas"]);
    const b = await request.json().catch(() => ({}));
    const nama = str(b.nama);
    const nik = str(b.nik);
    const telepon = str(b.telepon) || null;
    const tanggalLahir = str(b.tanggalLahir);
    const jenisKelamin = str(b.jenisKelamin).toUpperCase();
    const alamat = str(b.alamat) || null;
    const kontakDarurat = str(b.kontakDarurat) || null;

    if (nama.length < 1 || nama.length > 150)
      throw new HttpError(400, "Nama wajib diisi (maks 150 karakter)");
    if (!NIK.test(nik)) throw new HttpError(400, "NIK wajib diisi (16 digit)");
    if (telepon && !TELEPON.test(telepon))
      throw new HttpError(400, "Telepon 8-15 digit, boleh diawali +");
    if (
      !tanggalValid(tanggalLahir) ||
      tanggalLahir < "1900-01-01" ||
      tanggalLahir > hariIni()
    ) {
      throw new HttpError(400, "Tanggal lahir tidak valid (format YYYY-MM-DD)");
    }
    if (!["L", "P"].includes(jenisKelamin))
      throw new HttpError(400, "jenisKelamin harus L atau P");

    const p = await denganRls(profile.id, async (tx) => {
      const [dup] = await tx
        .select({ id: pasien.id })
        .from(pasien)
        .where(eq(pasien.nik, nik))
        .limit(1);
      if (dup) throw new HttpError(409, "NIK sudah terdaftar");
      const [baru] = await tx
        .insert(pasien)
        .values({
          nama,
          nik,
          telepon,
          tanggalLahir,
          jenisKelamin,
          alamat,
          kontakDarurat,
        })
        .returning({
          id: pasien.id,
          noRekamMedis: pasien.noRekamMedis,
          nama: pasien.nama,
        });
      return baru;
    });

    return NextResponse.json({ data: p }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/pasien");
  }
}
