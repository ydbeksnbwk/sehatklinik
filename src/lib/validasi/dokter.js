// src/lib/validasi/dokter.js
// Skema Zod untuk pengelolaan dokter oleh admin — pesan bahasa Indonesia
// K7, PRD §8

import { z } from "zod";

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const skemaDokterCreate = z
  .object({
    email: z
      .string({ required_error: "Format email tidak valid" })
      .trim()
      .toLowerCase()
      .regex(REGEX_EMAIL, "Format email tidak valid"),
    password: z
      .string({ required_error: "Password minimal 8 karakter" })
      .min(8, "Password minimal 8 karakter"),
    nama: z
      .string({ required_error: "Nama wajib diisi (maks 150 karakter)" })
      .trim()
      .min(1, "Nama wajib diisi (maks 150 karakter)")
      .max(150, "Nama wajib diisi (maks 150 karakter)"),
    spesialisasi: z
      .string({ required_error: "Spesialisasi wajib diisi" })
      .trim()
      .min(1, "Spesialisasi wajib diisi"),
    noSip: z
      .string({ required_error: "Nomor SIP wajib diisi" })
      .trim()
      .min(1, "Nomor SIP wajib diisi"),
    deskripsi: z.string().trim().optional().nullable(),
    detail: z.record(z.any()).optional().default({}),
    layananIds: z
      .array(z.string().regex(REGEX_UUID, "layananIds wajib berisi minimal satu id layanan yang valid"), {
        required_error: "layananIds wajib berisi minimal satu id layanan yang valid",
      })
      .min(1, "layananIds wajib berisi minimal satu id layanan yang valid"),
  })
  .strict("Terdapat bidang yang tidak dikenali pada data dokter");

export const skemaDokterUpdate = z
  .object({
    nama: z
      .string()
      .trim()
      .min(1, "Nama wajib diisi (maks 150 karakter)")
      .max(150, "Nama wajib diisi (maks 150 karakter)")
      .optional(),
    spesialisasi: z
      .string()
      .trim()
      .min(1, "Spesialisasi tidak boleh kosong")
      .optional(),
    noSip: z
      .string()
      .trim()
      .min(1, "Nomor SIP tidak boleh kosong")
      .optional(),
    deskripsi: z.string().trim().optional().nullable(),
    detail: z.record(z.any()).optional(),
    fotoPath: z.string().trim().optional().nullable(),
    aktif: z.boolean({ invalid_type_error: "aktif harus true atau false" }).optional(),
    layananIds: z
      .array(z.string().regex(REGEX_UUID, "layananIds wajib berisi minimal satu id layanan yang valid"))
      .min(1, "layananIds wajib berisi minimal satu id layanan yang valid")
      .optional(),
  })
  .strict("Terdapat bidang yang tidak dikenali pada data dokter");
