import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dokter } from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { hariIni } from "@/lib/tanggal";

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const str = (v) => (typeof v === "string" ? v.trim() : "");

export async function dokterIdDari(profile) {
  const [d] = await db
    .select({ id: dokter.id })
    .from(dokter)
    .where(eq(dokter.profileId, profile.id))
    .limit(1);
  if (!d) throw new HttpError(403, "Akun ini belum terhubung ke data dokter");
  return d.id;
}

// Di produksi, check-in dan panggilan hanya boleh pada tanggal kunjungan.
// Di mode dev dilonggarkan supaya data uji bertanggal besok tetap bisa dicoba.
export function cekHariH(tanggal) {
  if (process.env.NODE_ENV === "production" && tanggal !== hariIni()) {
    throw new HttpError(409, "Hanya dapat diproses pada tanggal kunjungan");
  }
}
