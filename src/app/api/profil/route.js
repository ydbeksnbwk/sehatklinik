import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dokter, pasien, profiles } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { denganRls } from "@/lib/rls";

const TELEPON = /^\+?[0-9]{8,15}$/;

export async function GET(request) {
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

// Pasien: alamat, telepon, kontakDarurat. Admin: nama dan telepon.
// Dokter dan petugas tidak punya hak ubah profil (aturan RLS di database).
export async function PATCH(request) {
  try {
    const { profile } = await requireRole(request);
    const b = await request.json().catch(() => ({}));
    const bersih = (v) => (typeof v === "string" ? v.trim() : undefined);

    const telepon = bersih(b.telepon);
    if (telepon && !TELEPON.test(telepon)) {
      throw new HttpError(400, "Telepon 8-15 digit, boleh diawali +");
    }

    if (profile.role === "pasien") {
      if (b.nama !== undefined) {
        throw new HttpError(400, "Nama pasien hanya dapat diubah oleh petugas");
      }
      const alamat = bersih(b.alamat);
      const kontak = bersih(b.kontakDarurat);
      if (kontak && kontak.length > 100)
        throw new HttpError(400, "Kontak darurat terlalu panjang");

      const set = {};
      if (alamat !== undefined) set.alamat = alamat || null;
      if (telepon !== undefined) set.telepon = telepon || null;
      if (kontak !== undefined) set.kontakDarurat = kontak || null;
      if (Object.keys(set).length === 0)
        throw new HttpError(400, "Tidak ada data yang diubah");

      const res = await denganRls(profile.id, (tx) =>
        tx
          .update(pasien)
          .set(set)
          .where(eq(pasien.profileId, profile.id))
          .returning({
            alamat: pasien.alamat,
            telepon: pasien.telepon,
            kontakDarurat: pasien.kontakDarurat,
          }),
      );
      if (res.length === 0)
        throw new HttpError(404, "Data pasien tidak ditemukan");
      return NextResponse.json({ data: res[0] });
    }

    const nama = bersih(b.nama);
    if (nama !== undefined && (nama.length < 1 || nama.length > 150)) {
      throw new HttpError(400, "Nama wajib diisi (maks 150 karakter)");
    }
    const set = {};
    if (nama !== undefined) set.nama = nama;
    if (telepon !== undefined) set.telepon = telepon || null;
    if (Object.keys(set).length === 0)
      throw new HttpError(400, "Tidak ada data yang diubah");

    const res = await denganRls(profile.id, (tx) =>
      tx
        .update(profiles)
        .set(set)
        .where(eq(profiles.id, profile.id))
        .returning({ nama: profiles.nama, telepon: profiles.telepon }),
    );
    if (res.length === 0)
      throw new HttpError(403, "Peran Anda tidak dapat mengubah data ini");
    return NextResponse.json({ data: res[0] });
  } catch (err) {
    return handleError(err, "PATCH /api/profil");
  }
}
