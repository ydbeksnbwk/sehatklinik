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

export async function getCurrentUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Belum login", "UNAUTHENTICATED");

  const { data, error } = await supabaseServer().auth.getUser(token);
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
