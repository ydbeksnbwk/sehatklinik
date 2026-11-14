// src/lib/validasi/jadwal.js
// Skema Zod untuk pengelolaan jadwal praktik oleh admin — pesan bahasa Indonesia
// K7, PRD §8

import { z } from "zod";

const REGEX_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const skemaJadwalCreate = z
  .object({
    dokterId: z
      .string({ required_error: "dokterId tidak valid" })
      .regex(REGEX_UUID, "dokterId tidak valid"),
    hari: z.coerce
      .number({ required_error: "hari harus 0 (Minggu) sampai 6 (Sabtu)" })
      .int("hari harus 0 (Minggu) sampai 6 (Sabtu)")
      .min(0, "hari harus 0 (Minggu) sampai 6 (Sabtu)")
      .max(6, "hari harus 0 (Minggu) sampai 6 (Sabtu)"),
    jamMulai: z
      .string({ required_error: "Format jam harus HH:MM" })
      .trim()
      .regex(REGEX_JAM, "Format jam harus HH:MM"),
    jamSelesai: z
      .string({ required_error: "Format jam harus HH:MM" })
      .trim()
      .regex(REGEX_JAM, "Format jam harus HH:MM"),
    kuota: z.coerce
      .number({ required_error: "kuota harus bilangan bulat minimal 1" })
      .int("kuota harus bilangan bulat minimal 1")
      .min(1, "kuota harus bilangan bulat minimal 1"),
  })
  .refine((d) => d.jamSelesai > d.jamMulai, {
    message: "Jam selesai harus setelah jam mulai",
    path: ["jamSelesai"],
  });

export const skemaJadwalUpdate = z
  .object({
    hari: z.coerce
      .number()
      .int("hari harus 0 sampai 6")
      .min(0, "hari harus 0 sampai 6")
      .max(6, "hari harus 0 sampai 6")
      .optional(),
    jamMulai: z
      .string()
      .trim()
      .regex(REGEX_JAM, "Format jam harus HH:MM")
      .optional(),
    jamSelesai: z
      .string()
      .trim()
      .regex(REGEX_JAM, "Format jam harus HH:MM")
      .optional(),
    kuota: z.coerce
      .number()
      .int("kuota harus bilangan bulat minimal 1")
      .min(1, "kuota harus bilangan bulat minimal 1")
      .optional(),
    aktif: z.boolean({ invalid_type_error: "aktif harus true atau false" }).optional(),
  })
  .refine(
    (d) => {
      if (d.jamMulai && d.jamSelesai) {
        return d.jamSelesai > d.jamMulai;
      }
      return true;
    },
    {
      message: "Jam selesai harus setelah jam mulai",
      path: ["jamSelesai"],
    }
  );
