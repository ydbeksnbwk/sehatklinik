import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { handleError } from "@/lib/auth";
import { skemaLogin } from "@/lib/validasi/auth";
import { ambilClientIp, checkRateLimit, buildRateLimitResponse } from "@/lib/rate-limit";
import { eksekusiLogin } from "@/lib/auth-service";

async function _POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = skemaLogin.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        fields[issue.path[0]] = issue.message;
      }
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Email dan password wajib diisi",
            fields,
          },
        },
        { status: 400 }
      );
    }
    const { email, password } = parsed.data;

    // Rate Limiting per IP dan per Email (PRD §9)
    const ip = ambilClientIp(request);
    const ipLimit = await checkRateLimit(`login:ip:${ip}`, { max: 20, windowSeconds: 60 });
    if (!ipLimit.allowed) {
      return buildRateLimitResponse(ipLimit.retryAfter, 20);
    }
    const emailLimit = await checkRateLimit(`login:email:${email.toLowerCase()}`, { max: 5, windowSeconds: 60 });
    if (!emailLimit.allowed) {
      return buildRateLimitResponse(emailLimit.retryAfter, 5);
    }

    const { response } = await eksekusiLogin({ email, password });
    return response;
  } catch (err) {
    return handleError(err, "POST /api/auth/login");
  }
}

export const POST = apiHandler(_POST, { route: "POST /api/auth/login" });
