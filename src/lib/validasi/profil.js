// src/lib/validasi/profil.js
// Skema Zod untuk pembaruan profil pengguna — pesan bahasa Indonesia
// K7, PRD §8

import { z } from "zod";

const REGEX_TELEPON = /^\+?[0-9]{8,15}$/;

export const skemaProfilAdmin = z.object({
  nama: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi (maks 150 karakter)")
    .max(150, "Nama wajib diisi (maks 150 karakter)")
    .optional(),
  telepon: z
    .string()
    .regex(REGEX_TELEPON, "Telepon 8-15 digit, boleh diawali +")
    .optional()
    .nullable()
    .or(z.literal("")),
});
