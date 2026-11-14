import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pasien, profiles } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { tanggalValid } from "@/lib/tanggal";

const REGEX_NIK = /^[0-9]{16}$/;
const REGEX_TELEPON = /^\+?[0-9]{8,15}$/;

const KoreksiPasienSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(1, "Nama tidak boleh kosong")
      .max(150, "Nama maksimal 150 karakter")
      .optional(),
    nik: z
      .string()
      .regex(REGEX_NIK, "NIK harus tepat 16 digit angka")
      .optional()
      .nullable()
      .or(z.literal("")),
    tanggalLahir: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir harus YYYY-MM-DD")
      .refine(tanggalValid, "Tanggal lahir bukan tanggal kalender yang valid")
      .optional(),
    jenisKelamin: z
      .enum(["L", "P", "Laki-laki", "Perempuan"], {
        errorMap: () => ({ message: "Jenis kelamin harus L atau P" }),
      })
      .optional(),
    telepon: z
      .string()
      .regex(REGEX_TELEPON, "Telepon 8–15 digit, boleh diawali +")
      .optional()
      .nullable()
      .or(z.literal("")),
    alamat: z.string().trim().optional().nullable().or(z.literal("")),
    kontakDarurat: z
      .string()
      .regex(REGEX_TELEPON, "Kontak darurat 8–15 digit, boleh diawali +")
      .optional()
      .nullable()
      .or(z.literal("")),
  })
  .strict();

export async function PATCH(request, { params }) {
  try {
    // Kebutuhan K10 & PRD: Hanya petugas yang boleh mengoreksi data pasien
    await requireRole(request, ["petugas"]);
    const { id } = await params;
    if (!UUID.test(id)) {
      throw new HttpError(400, "id pasien tidak valid");
    }

    const [existing] = await db
      .select()
      .from(pasien)
      .where(eq(pasien.id, id))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, "Pasien tidak ditemukan");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = KoreksiPasienSchema.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        fields[issue.path[0]] = issue.message;
      }
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data koreksi tidak valid",
            fields,
          },
        },
        { status: 400 },
      );
    }

    const { nama, nik, tanggalLahir, jenisKelamin, telepon, alamat, kontakDarurat } =
      parsed.data;

    const setObj = {};
    if (nama !== undefined) setObj.nama = nama;
    if (nik !== undefined) setObj.nik = nik === "" ? null : nik;
    if (tanggalLahir !== undefined) setObj.tanggalLahir = tanggalLahir;
    if (jenisKelamin !== undefined) {
      // Normalisasi nilai enum DB ('L' / 'P')
      setObj.jenisKelamin =
        jenisKelamin === "Perempuan" || jenisKelamin === "P" ? "P" : "L";
    }
    if (telepon !== undefined) setObj.telepon = telepon === "" ? null : telepon;
    if (alamat !== undefined) setObj.alamat = alamat === "" ? null : alamat;
    if (kontakDarurat !== undefined)
      setObj.kontakDarurat = kontakDarurat === "" ? null : kontakDarurat;

    if (Object.keys(setObj).length === 0) {
      throw new HttpError(400, "Tidak ada data yang dikoreksi");
    }

    const result = await db.transaction(async (tx) => {
      const [updatedPatient] = await tx
        .update(pasien)
        .set(setObj)
        .where(eq(pasien.id, id))
        .returning();

      // Sinkronkan ke profiles jika terhubung ke akun pasien
      if (existing.profileId) {
        const profileUpdates = {};
        if (setObj.nama) profileUpdates.nama = setObj.nama;
        if (setObj.telepon !== undefined) profileUpdates.telepon = setObj.telepon;
        if (setObj.alamat !== undefined) profileUpdates.alamat = setObj.alamat;
        if (setObj.kontakDarurat !== undefined)
          profileUpdates.kontakDarurat = setObj.kontakDarurat;

        if (Object.keys(profileUpdates).length > 0) {
          await tx
            .update(profiles)
            .set(profileUpdates)
            .where(eq(profiles.id, existing.profileId));
        }
      }

      return updatedPatient;
    });

    return NextResponse.json({
      data: result,
    });
  } catch (err) {
    return handleError(err, "PATCH /api/petugas/pasien/[id]");
  }
}
