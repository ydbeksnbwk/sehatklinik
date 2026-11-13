// src/lib/validasi/kunjungan.js
// Skema Zod untuk endpoint kunjungan — pesan bahasa Indonesia

import { z } from "zod";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export const skemaDaftarKunjungan = z.object({
  jadwalId: z
    .string({ required_error: "jadwalId wajib diisi" })
    .regex(REGEX_UUID, "jadwalId harus berupa UUID yang valid"),
  layananId: z
    .string({ required_error: "layananId wajib diisi" })
    .regex(REGEX_UUID, "layananId harus berupa UUID yang valid"),
  tanggal: z
    .string({ required_error: "Tanggal wajib diisi" })
    .regex(REGEX_TANGGAL, "Format tanggal harus YYYY-MM-DD"),
  keluhan: z
    .string({ required_error: "Keluhan wajib diisi" })
    .trim()
    .min(1, "Keluhan tidak boleh kosong")
    .max(500, "Keluhan maksimal 500 karakter"),
  // Hanya wajib untuk petugas; pasien tidak mengirimkan ini
  pasienId: z
    .string()
    .regex(REGEX_UUID, "pasienId harus berupa UUID yang valid")
    .optional(),
});

// Status antrean yang valid
const STATUS_ANTREAN = ["menunggu", "dipanggil", "diperiksa", "selesai", "dilewati", "batal"];

export const skemaTransisi = z
  .object({
    aksi: z.enum(
      ["checkin", "panggil", "periksa", "lewati", "batal", "selesai"],
      { errorMap: () => ({ message: "Aksi tidak valid" }) }
    ),
    alasan: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.aksi === "batal" || data.aksi === "lewati") &&
      (!data.alasan || data.alasan.trim().length < 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alasan"],
        message: "Alasan wajib diisi minimal 3 karakter",
      });
    }
  });

const skemaTandaVital = z
  .object({
    sistolik: z.number().min(50, "Sistolik minimal 50").max(300, "Sistolik maksimal 300").optional(),
    diastolik: z.number().min(30, "Diastolik minimal 30").max(200, "Diastolik maksimal 200").optional(),
    suhu: z.number().min(30, "Suhu minimal 30°C").max(45, "Suhu maksimal 45°C").optional(),
    berat_badan: z.number().min(1, "Berat badan minimal 1 kg").max(500, "Berat badan maksimal 500 kg").optional(),
    tinggi_badan: z.number().min(20, "Tinggi badan minimal 20 cm").max(250, "Tinggi badan maksimal 250 cm").optional(),
  })
  .strict({ message: "Tanda vital hanya boleh memuat kunci: sistolik, diastolik, suhu, berat_badan, tinggi_badan" });

const skemaTindakan = z.object({
  namaTindakan: z.string().trim().min(1, "Nama tindakan wajib diisi"),
  keterangan: z.string().trim().optional(),
  saran: z.string().trim().optional(),
});

export const skemaPemeriksaan = z.object({
  anamnesis: z.string({ required_error: "Anamnesis wajib diisi" }).trim().min(1, "Anamnesis tidak boleh kosong"),
  diagnosis: z.string({ required_error: "Diagnosis wajib diisi" }).trim().min(1, "Diagnosis tidak boleh kosong"),
  catatan: z.string().trim().optional(),
  tandaVital: skemaTandaVital.optional(),
  tindakan: z.array(skemaTindakan).optional().default([]),
});
