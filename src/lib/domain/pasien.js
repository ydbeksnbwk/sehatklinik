// src/lib/domain/pasien.js
// Logika bisnis pengelolaan data pasien
// Akses data murni via Drizzle ORM.

import { and, count, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { pasien, profiles } from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { sql } from "drizzle-orm";

/**
 * Daftar pasien dengan paginasi dan pencarian.
 * @param {{ q?: string, page?: number, pageSize?: number }} params
 * @returns {{ data: Array, meta: { page, pageSize, total, totalPages } }}
 */
export async function daftarPasien({ q = "", page = 1, pageSize = 10 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(50, Math.max(1, Number(pageSize) || 10));
  const offset = (p - 1) * ps;

  const kondisi = q
    ? or(
        ilike(pasien.nama, `%${q}%`),
        ilike(pasien.noRekamMedis, `%${q}%`),
        ilike(pasien.telepon, `%${q}%`),
        ilike(pasien.nik, `%${q}%`)
      )
    : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(pasien)
    .where(kondisi);

  const rows = await db
    .select({
      id: pasien.id,
      noRekamMedis: pasien.noRekamMedis,
      nama: pasien.nama,
      nik: pasien.nik,
      tanggalLahir: pasien.tanggalLahir,
      jenisKelamin: pasien.jenisKelamin,
      alamat: pasien.alamat,
      telepon: pasien.telepon,
      kontakDarurat: pasien.kontakDarurat,
      profileId: pasien.profileId,
    })
    .from(pasien)
    .where(kondisi)
    .orderBy(pasien.nama)
    .limit(ps)
    .offset(offset);

  return {
    data: rows.map((r) => ({ ...r, punyaAkun: Boolean(r.profileId) })),
    meta: {
      page: p,
      pageSize: ps,
      total,
      totalPages: Math.ceil(total / ps),
    },
  };
}

/**
 * Tambah pasien baru (walk-in atau registrasi).
 * @param {{ nama, tanggalLahir, jenisKelamin, nik?, telepon?, alamat?, kontakDarurat?, profileId? }} data
 * @returns pasien baru
 */
export async function tambahPasien({
  nama,
  tanggalLahir,
  jenisKelamin,
  nik,
  telepon,
  alamat,
  kontakDarurat,
  profileId,
}) {
  // Cek duplikat NIK jika diisi
  if (nik) {
    const [dup] = await db
      .select({ id: pasien.id })
      .from(pasien)
      .where(eq(pasien.nik, nik))
      .limit(1);

    if (dup) throw new HttpError(409, "NIK sudah terdaftar");
  }

  // Nomor rekam medis dari sequence database
  const res = await db.execute(sql`SELECT nextval('seq_no_rekam_medis') AS seq`);
  const seq = res.rows ? res.rows[0].seq : res[0].seq;
  const noRekamMedis = `RM-${String(seq).padStart(6, "0")}`;

  const [baru] = await db
    .insert(pasien)
    .values({
      noRekamMedis,
      profileId: profileId ?? null,
      nama,
      nik: nik || null,
      tanggalLahir,
      jenisKelamin,
      telepon: telepon || null,
      alamat: alamat || null,
      kontakDarurat: kontakDarurat || null,
    })
    .returning();

  return { ...baru, punyaAkun: Boolean(baru.profileId) };
}
