import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import {
  ambilRefreshTokenDariRequest,
  pasangCookieSesi,
  handleError,
  HttpError,
} from "@/lib/auth";

async function _POST(request) {
  try {
    const refreshToken = ambilRefreshTokenDariRequest(request);
    if (!refreshToken) {
      throw new HttpError(401, "Sesi refresh tidak ditemukan", "UNAUTHENTICATED");
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data?.session || !data?.user) {
      throw new HttpError(401, "Token refresh tidak valid atau kedaluwarsa", "UNAUTHENTICATED");
    }

    const response = NextResponse.json({
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        expiresIn: data.session.expires_in || 3600,
      },
    });

    pasangCookieSesi(response, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in || 3600,
    });

    return response;
  } catch (err) {
    return handleError(err, "POST /api/auth/refresh");
  }
}

export const POST = apiHandler(_POST, { route: "POST /api/auth/refresh" });
