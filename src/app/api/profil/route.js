import { apiHandler } from "@/lib/api-handler";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter, pasien, profiles } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { denganRls } from "@/lib/rls";
import { skemaProfilPasien } from "@/lib/validasi/pasien";
import { skemaProfilAdmin } from "@/lib/validasi/profil";

async function _GET(request) {
  try {
    const { user, profile } = await requireRole(request);
    const data = {
      id: profile.id,
      email: user.email,
      nama: profile.nama,
      telepon: profile.telepon,
      role: profile.role,
    };

    await denganRls(profile.id, async (tx) => {
      if (profile.role === "pasien") {
        const [p] = await tx
          .select({
            id: pasien.id,
            noRekamMedis: pasien.noRekamMedis,
            nama: pasien.nama,
            telepon: pasien.telepon,
            nik: pasien.nik,
            tanggalLahir: pasien.tanggalLahir,
            jenisKelamin: pasien.jenisKelamin,
            alamat: pasien.alamat,
            kontakDarurat: pasien.kontakDarurat,
          })
          .from(pasien)
          .where(eq(pasien.profileId, profile.id))
          .limit(1);
        data.pasien = p ?? null;
      } else if (profile.role === "dokter") {
        const [d] = await tx
          .select({
            id: dokter.id,
            spesialisasi: dokter.spesialisasi,
            noSip: dokter.noSip,
            fotoPath: dokter.fotoPath,
            deskripsi: dokter.deskripsi,
          })
          .from(dokter)
          .where(eq(dokter.profileId, profile.id))
          .limit(1);
        data.dokter = d ?? null;
      }
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err, "GET /api/profil");
  }
}

// Hanya pasien dan admin yang boleh update lewat sini.
// Dokter tidak punya profil yang diubah mandiri di tahap ini (perubahan via admin).
async function _PATCH(request) {
  try {
    const { profile } = await requireRole(request);

    if (profile.role === "pasien") {
      const b = await request.json().catch(() => ({}));
      const parsed = skemaProfilPasien.safeParse(b);
      if (!parsed.success) {
        const fields = {};
        for (const issue of parsed.error.issues) {
          fields[issue.path[0]] = issue.message;
        }
        // Tambahkan peringatan jika pasien mencoba mengubah data identitas
        const asing = Object.keys(
          b && typeof b === "object" ? b : {}
        ).filter((k) => !["alamat", "telepon", "kontakDarurat"].includes(k));
        if (asing.length > 0) {
          fields.hanyaBaca = `Field hanya-baca tidak dapat diubah: ${asing.join(", ")} (hubungi petugas untuk koreksi)`;
        }
        throw new HttpError(
          400,
          "Pasien hanya dapat mengubah alamat, telepon, dan kontak darurat",
          "VALIDATION",
          fields
        );
      }

      const alamat = parsed.data.alamat;
      const telepon = parsed.data.telepon;
      const kontakDarurat = parsed.data.kontakDarurat;
      if (
        alamat === undefined &&
        telepon === undefined &&
        kontakDarurat === undefined
      ) {
        throw new HttpError(400, "Tidak ada data yang diubah");
      }

      // Update pasien + profiles dalam satu transaksi (rule #4).
      const p = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(pasien)
          .set({
            ...(alamat !== undefined ? { alamat: alamat || null } : {}),
            ...(telepon !== undefined ? { telepon: telepon || null } : {}),
            ...(kontakDarurat !== undefined
              ? { kontakDarurat: kontakDarurat || null }
              : {}),
          })
          .where(eq(pasien.profileId, profile.id))
          .returning();

        if (!row) {
          throw new HttpError(404, "Data pasien tidak ditemukan");
        }

        if (telepon !== undefined) {
          await tx
            .update(profiles)
            .set({ telepon: telepon || null })
            .where(eq(profiles.id, profile.id));
        }

        return row;
      });

      return NextResponse.json({
        data: {
          id: profile.id,
          nama: p.nama,
          telepon: p.telepon,
          role: profile.role,
          pasienId: p.id,
          noRekamMedis: p.noRekamMedis,
          nik: p.nik ?? "",
          tanggalLahir: p.tanggalLahir ?? "",
          jenisKelamin: p.jenisKelamin === "P" ? "Perempuan" : "Laki-laki",
          alamat: p.alamat ?? "-",
          kontakDarurat: p.kontakDarurat ?? "-",
        },
      });
    }

    if (profile.role !== "admin") {
      throw new HttpError(
        403,
        "Peran Anda tidak dapat mengubah data ini"
      );
    }

    const b = await request.json().catch(() => ({}));
    const validated = skemaProfilAdmin.parse(b);

    const set = {};
    if (validated.nama !== undefined) set.nama = validated.nama;
    if (validated.telepon !== undefined) set.telepon = validated.telepon || null;
    if (Object.keys(set).length === 0) {
      throw new HttpError(400, "Tidak ada data yang diubah");
    }

    const res = await denganRls(profile.id, (tx) =>
      tx
        .update(profiles)
        .set(set)
        .where(eq(profiles.id, profile.id))
        .returning({ nama: profiles.nama, telepon: profiles.telepon }),
    );
    if (res.length === 0) {
      throw new HttpError(403, "Peran Anda tidak dapat mengubah data ini");
    }
    return NextResponse.json({ data: res[0] });
  } catch (err) {
    return handleError(err, "PATCH /api/profil");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/profil" });
export const PATCH = apiHandler(_PATCH, { route: "PATCH /api/profil" });
export const PUT = apiHandler(_PATCH, { route: "PUT /api/profil" });
