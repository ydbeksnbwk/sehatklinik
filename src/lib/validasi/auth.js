// src/lib/validasi/auth.js
// Skema Zod untuk endpoint autentikasi — pesan bahasa Indonesia

import { z } from "zod";
import { hariIni, tanggalValid } from "@/lib/tanggal";

const REGEX_NIK = /^[0-9]{16}$/;
const REGEX_TELEPON = /^\+?[0-9]{8,15}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

// Kata sandi kuat: minimal 8 karakter, harus ada huruf dan angka
const skemaPassword = z
  .string({ required_error: "Password wajib diisi" })
  .min(8, "Password minimal 8 karakter")
  .regex(/[a-zA-Z]/, "Password harus mengandung huruf")
  .regex(/[0-9]/, "Password harus mengandung angka");

export const skemaRegistrasi = z.object({
  email: z
    .string({ required_error: "Email wajib diisi" })
    .trim()
    .toLowerCase()
    .regex(REGEX_EMAIL, "Format email tidak valid"),
  password: skemaPassword,
  nama: z
    .string({ required_error: "Nama wajib diisi" })
    .trim()
    .min(1, "Nama tidak boleh kosong")
    .max(150, "Nama maksimal 150 karakter"),
  telepon: z
    .string({ required_error: "Telepon wajib diisi" })
    .regex(REGEX_TELEPON, "Telepon 8–15 digit, boleh diawali +"),
  nik: z
    .string({ required_error: "NIK wajib diisi" })
    .regex(REGEX_NIK, "NIK harus tepat 16 digit angka"),
  tanggalLahir: z
    .string({ required_error: "Tanggal lahir wajib diisi" })
    .regex(REGEX_TANGGAL, "Format tanggal lahir harus YYYY-MM-DD")
    .refine(tanggalValid, "Tanggal lahir bukan tanggal kalender yang valid")
    .refine(
      (t) => t <= hariIni(),
      "Tanggal lahir tidak boleh di masa depan"
    ),
  jenisKelamin: z.enum(["L", "P"], {
    errorMap: () => ({ message: "Jenis kelamin harus L atau P" }),
  }),
  alamat: z.string().trim().optional(),
  kontakDarurat: z
    .string()
    .regex(REGEX_TELEPON, "Kontak darurat 8–15 digit, boleh diawali +")
    .optional()
    .or(z.literal("")),
});
