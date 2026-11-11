import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { supabaseServer } from "@/lib/supabase";

export class HttpError extends Error {
  constructor(status, message, kode = null, fields = null) {
    super(message);
    this.status = status;
    this.kode = kode;
    this.fields = fields;
  }
}

function kodeDefault(status) {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL";
  }
}

export const COOKIE_ACCESS_NAME = "sb-access-token";
export const COOKIE_REFRESH_NAME = "sb-refresh-token";

export function getCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  };
}

export function pasangCookieSesi(response, { accessToken, refreshToken, expiresIn = 3600 }) {
  response.cookies.set(COOKIE_ACCESS_NAME, accessToken, getCookieOptions(expiresIn));
  if (refreshToken) {
    response.cookies.set(COOKIE_REFRESH_NAME, refreshToken, getCookieOptions(60 * 60 * 24 * 30));
  }
  return response;
}

export function hapusCookieSesi(response) {
  response.cookies.set(COOKIE_ACCESS_NAME, "", getCookieOptions(0));
  response.cookies.set(COOKIE_REFRESH_NAME, "", getCookieOptions(0));
  return response;
}

function ambilTokenDariRequest(request) {
  // 1. Prioritas utama: cookie httpOnly
  if (request.cookies?.get) {
    const cookieToken = request.cookies.get(COOKIE_ACCESS_NAME)?.value;
    if (cookieToken) return cookieToken;
  } else if (typeof request.headers?.get === "function") {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_ACCESS_NAME}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }

  // 2. Fallback sekunder: header Authorization Bearer (untuk skrip uji)
  const header = request.headers?.get ? request.headers.get("authorization") || "" : "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }

  return "";
}

function ambilRefreshTokenDariRequest(request) {
  if (request.cookies?.get) {
    return request.cookies.get(COOKIE_REFRESH_NAME)?.value || "";
  } else if (typeof request.headers?.get === "function") {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_REFRESH_NAME}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }
  return "";
}

export async function getCurrentUser(request) {
  const token = ambilTokenDariRequest(request);
  if (!token) throw new HttpError(401, "Belum login", "UNAUTHENTICATED");

  const supabase = supabaseServer();
  let { data, error } = await supabase.auth.getUser(token);

  // Jika access token kedaluwarsa, coba refresh via sb-refresh-token
  if ((error || !data?.user) && ambilRefreshTokenDariRequest(request)) {
    const refreshToken = ambilRefreshTokenDariRequest(request);
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (!refreshError && refreshData?.user) {
      data = refreshData;
      error = null;
    }
  }

  if (error || !data?.user) {
    throw new HttpError(401, "Token tidak valid atau kedaluwarsa", "UNAUTHENTICATED");
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);
  if (!profile) throw new HttpError(403, "Profil pengguna tidak ditemukan", "FORBIDDEN");
  if (!profile.statusAktif) throw new HttpError(403, "Akun dinonaktifkan", "FORBIDDEN");

  return { user: data.user, profile };
}

// roles: contoh ['admin'] atau ['petugas', 'admin']. Kosong = semua yang sudah login.
export async function requireRole(request, roles = []) {
  const ctx = await getCurrentUser(request);
  if (roles.length > 0 && !roles.includes(ctx.profile.role)) {
    throw new HttpError(403, "Akses ditolak untuk peran ini", "FORBIDDEN");
  }
  return ctx;
}

export function handleError(err, label) {
  if (err instanceof HttpError) {
    const code = err.kode || kodeDefault(err.status);
    const errorBody = {
      code,
      message: err.message,
    };
    if (err.fields) {
      errorBody.fields = err.fields;
    }
    return NextResponse.json({ error: errorBody }, { status: err.status });
  }

  const code = err?.code || err?.cause?.code;
  if (code === "P0001") {
    const msg =
      err?.cause?.message ||
      err?.message ||
      "Aksi ditolak oleh aturan database";
    return NextResponse.json(
      { error: { code: "ATURAN_DATABASE_DITOLAK", message: msg } },
      { status: 409 }
    );
  }
  if (code === "23505") {
    return NextResponse.json(
      { error: { code: "DUPLIKAT", message: "Data bentrok dengan data yang sudah ada" } },
      { status: 409 }
    );
  }
  if (["23503", "23514", "22P02", "22007"].includes(code)) {
    return NextResponse.json(
      { error: { code: "DATA_TIDAK_VALID", message: "Data tidak valid" } },
      { status: 400 }
    );
  }

  console.error(label, err);
  const body = {
    error: {
      code: "INTERNAL",
      message: "Terjadi kesalahan server",
    },
  };
  if (process.env.NODE_ENV !== "production") {
    body.detail = String(err?.cause?.message || err?.message || err);
  }
  return NextResponse.json(body, { status: 500 });
}
