// src/lib/validasi/pasien.js
// Skema Zod untuk endpoint pasien — pesan bahasa Indonesia

import { z } from "zod";

const REGEX_NIK = /^[0-9]{16}$/;
const REGEX_TELEPON = /^\+?[0-9]{8,15}$/;

export const skemaTambahPasien = z.object({
  nama: z
    .string({ required_error: "Nama wajib diisi" })
    .trim()
    .min(1, "Nama tidak boleh kosong")
    .max(150, "Nama maksimal 150 karakter"),
  tanggalLahir: z
    .string({ required_error: "Tanggal lahir wajib diisi" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal lahir harus YYYY-MM-DD"),
  jenisKelamin: z.enum(["L", "P"], {
    errorMap: () => ({ message: "Jenis kelamin harus L atau P" }),
  }),
  nik: z
    .string()
    .regex(REGEX_NIK, "NIK harus tepat 16 digit angka")
    .optional()
    .or(z.literal("")),
  telepon: z
    .string()
    .regex(REGEX_TELEPON, "Telepon 8–15 digit, boleh diawali +")
    .optional()
    .or(z.literal("")),
  alamat: z.string().trim().optional(),
  kontakDarurat: z
    .string()
    .regex(REGEX_TELEPON, "Kontak darurat 8–15 digit, boleh diawali +")
    .optional()
    .or(z.literal("")),
});
