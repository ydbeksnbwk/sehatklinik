import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/auth";
import { ambilClientIp, checkRateLimit, buildRateLimitResponse } from "@/lib/rate-limit";
import { DEMO_AKUN } from "@/lib/demo-akun";
import { eksekusiLogin } from "@/lib/auth-service";
import { logger } from "@/lib/logger";

const skemaLoginCepat = z
  .object({
    peran: z.enum(["pasien", "petugas", "dokter", "admin"], {
      errorMap: () => ({ message: "Peran harus salah satu dari: pasien, petugas, dokter, admin" }),
    }),
  })
  .strict("Terdapat bidang yang tidak dikenali pada permintaan login cepat");

async function _POST(request) {
  try {
    // 1. Fitur hanya aktif bila DEMO_LOGIN_ENABLED === "1"
    if (process.env.DEMO_LOGIN_ENABLED !== "1") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Endpoint login cepat tidak aktif",
          },
        },
        { status: 404 }
      );
    }

    // 2. Validasi body masukan peran
    const body = await request.json().catch(() => ({}));
    const parsed = skemaLoginCepat.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        fields[issue.path[0] || "peran"] = issue.message;
      }
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Peran tidak valid",
            fields,
          },
        },
        { status: 400 }
      );
    }

    const { peran } = parsed.data;

    // 3. Rate limiting: 10 per menit per IP
    const ip = ambilClientIp(request);
    const ipLimit = await checkRateLimit(`login-cepat:ip:${ip}`, { max: 10, windowSeconds: 60 });
    if (!ipLimit.allowed) {
      logger.warn({ msg: "Rate limit login cepat terlampaui", ip, peran });
      return buildRateLimitResponse(ipLimit.retryAfter, 10);
    }

    // 4. Periksa ketersediaan kata sandi demo dari environment server
    const password = process.env.DEMO_LOGIN_PASSWORD;
    if (!password) {
      logger.error({ msg: "DEMO_LOGIN_PASSWORD belum disetel di server", peran });
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Fitur login cepat belum dikonfigurasi kata sandi demo di server",
          },
        },
        { status: 503 }
      );
    }

    // 5. Dapatkan email akun seed per peran
    const email = DEMO_AKUN[peran];
    if (!email) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Akun demo untuk peran '${peran}' tidak ditemukan`,
          },
        },
        { status: 404 }
      );
    }

    // 6. Jalankan alur login bersama (signInWithPassword, cek status_aktif, set cookie HttpOnly)
    const { response, user } = await eksekusiLogin({ email, password });

    // 7. Catat log Pino tanpa mencatat kata sandi
    logger.info({
      msg: "Login cepat berhasil",
      peran,
      email,
      userId: user.id,
      ip,
    });

    return response;
  } catch (err) {
    logger.warn({ msg: "Login cepat gagal", error: err?.message });
    return handleError(err, "POST /api/auth/login-cepat");
  }
}

export const POST = apiHandler(_POST, { route: "POST /api/auth/login-cepat" });
