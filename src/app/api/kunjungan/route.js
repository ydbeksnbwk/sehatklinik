import { apiHandler } from "@/lib/api-handler";
// Endpoint daftar dan pendaftaran kunjungan (GET/POST) dengan otorisasi peran.

import { and, asc, desc, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  dokter,
  pasien,
  vAntreanDetail,
} from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { tanggalValid } from "@/lib/tanggal";
import { denganRls } from "@/lib/rls";
import { skemaDaftarKunjungan } from "@/lib/validasi/kunjungan";
import { daftarKunjungan, ambilPasienDariProfile } from "@/lib/domain/kunjungan";
import { ambilClientIp, checkRateLimit, buildRateLimitResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const STATUS_KUNJUNGAN = ["terdaftar", "hadir", "selesai", "batal"];

function galat(code, message, fields, status) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

// GET /api/kunjungan?tanggal=YYYY-MM-DD&status=...&dokterId=...
async function _GET(request) {
  try {
    const { profile } = await requireRole(request);
    const { searchParams } = new URL(request.url);

    const tanggal = searchParams.get("tanggal");
    const status = searchParams.get("status");
    const dokterId = searchParams.get("dokterId");

    if (tanggal && !tanggalValid(tanggal)) {
      return galat("VALIDATION_ERROR", "Format tanggal tidak valid", { tanggal: "Gunakan format YYYY-MM-DD" }, 400);
    }
    if (status && !STATUS_KUNJUNGAN.includes(status)) {
      return galat("VALIDATION_ERROR", "Status kunjungan tidak valid", { status: "Nilai status tidak dikenal" }, 400);
    }

    const rows = await denganRls(profile.id, async (tx) => {
      const conds = [];
      if (tanggal) conds.push(eq(vAntreanDetail.tanggal, tanggal));
      if (status) conds.push(eq(vAntreanDetail.statusKunjungan, status));
      if (dokterId) conds.push(eq(vAntreanDetail.dokterId, dokterId));

      if (profile.role === "pasien") {
        const [p] = await tx
          .select({ id: pasien.id })
          .from(pasien)
          .where(eq(pasien.profileId, profile.id))
          .limit(1);
        if (!p) return [];
        conds.push(eq(vAntreanDetail.pasienId, p.id));
      } else if (profile.role === "dokter") {
        const [d] = await tx
          .select({ id: dokter.id })
          .from(dokter)
          .where(eq(dokter.profileId, profile.id))
          .limit(1);
        if (!d) throw new HttpError(403, "Akun ini belum terhubung ke data dokter");
        conds.push(eq(vAntreanDetail.dokterId, d.id));
      }

      return tx
        .select()
        .from(vAntreanDetail)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(vAntreanDetail.tanggal), asc(vAntreanDetail.nomorAntrean))
        .limit(100);
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        jamMulai: r.jamMulai ? String(r.jamMulai).slice(0, 5) : r.jamMulai,
        jamSelesai: r.jamSelesai ? String(r.jamSelesai).slice(0, 5) : r.jamSelesai,
      })),
    });
  } catch (err) {
    return handleError(err, "GET /api/kunjungan");
  }
}

// POST /api/kunjungan
// Pasien: daftar daring untuk dirinya sendiri
// Petugas: daftar walk-in dengan pasienId eksplisit
// Admin/dokter: ditolak 403
async function _POST(request) {
  try {
    // Rate Limiting per IP (PRD §9)
    const ip = ambilClientIp(request);
    const rl = await checkRateLimit(`kunjungan:ip:${ip}`, { max: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      return buildRateLimitResponse(rl.retryAfter, 20);
    }

    const { profile } = await requireRole(request, ["pasien", "petugas"]);

    // Admin dan dokter ditolak (K12)
    if (profile.role === "admin" || profile.role === "dokter") {
      return galat("FORBIDDEN", "Peran ini tidak berwenang mendaftarkan kunjungan", null, 403);
    }

    const body = await request.json().catch(() => ({}));

    // Validasi Zod
    const parsed = skemaDaftarKunjungan.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      const issues = parsed.error.issues || [];
      issues.forEach((e) => {
        fields[e.path[0]] = e.message;
      });
      return galat("VALIDATION_ERROR", "Data tidak valid", fields, 400);
    }

    const { jadwalId, layananId, tanggal, keluhan, pasienId: pasienIdBody } = parsed.data;

    // Validasi tanggal tidak di masa lalu
    const { hariIni } = await import("@/lib/tanggal");
    if (tanggal < hariIni()) {
      return galat("VALIDATION_ERROR", "Tanggal tidak boleh di masa lalu", { tanggal: "Tanggal sudah lewat" }, 400);
    }

    let pasienId;
    let sumber;

    if (profile.role === "pasien") {
      // Pasien hanya bisa daftar untuk dirinya sendiri
      const p = await ambilPasienDariProfile(profile.id);
      pasienId = p.id;
      sumber = "online";
    } else {
      // Petugas harus menyertakan pasienId
      if (!pasienIdBody) {
        return galat(
          "VALIDATION_ERROR",
          "pasienId wajib diisi untuk pendaftaran oleh petugas",
          { pasienId: "pasienId wajib diisi" },
          400
        );
      }
      const { pasien: pasienTable } = await import("@/db/schema");
      const [p] = await db
        .select({ id: pasienTable.id })
        .from(pasienTable)
        .where(eq(pasienTable.id, pasienIdBody))
        .limit(1);
      if (!p) return galat("NOT_FOUND", "Pasien tidak ditemukan", null, 404);
      pasienId = p.id;
      sumber = "walk_in";
    }

    const result = await daftarKunjungan({
      pasienId,
      jadwalId,
      layananId,
      tanggal,
      keluhan,
      sumber,
      dibuatOleh: profile.id,
    });

    // Enqueue ke BullMQ setelah commit transaksi bisnis, dibungkus try/catch (PRD §7.1)
    try {
      const { enqueuePendingNotificationsForProfile } = await import("@/lib/push-queue");
      await enqueuePendingNotificationsForProfile(profile.id);
    } catch (pushErr) {
      // Redis mati / galat push tidak membatalkan pendaftaran
      logger.warn({ msg: "Enqueue push gagal setelah daftar kunjungan (non-fatal)", error: pushErr?.message });
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError && err.kode === "DUPLIKAT") {
      return galat("DUPLIKAT", err.message, null, 409);
    }
    if (err instanceof HttpError && err.kode === "KUOTA_PENUH") {
      return galat("KUOTA_PENUH", err.message, null, 409);
    }
    return handleError(err, "POST /api/kunjungan");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/kunjungan" });
export const POST = apiHandler(_POST, { route: "POST /api/kunjungan" });
