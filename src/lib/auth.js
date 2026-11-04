import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { supabaseServer } from "@/lib/supabase";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function getCurrentUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Belum login");

  const { data, error } = await supabaseServer().auth.getUser(token);
  if (error || !data?.user) {
    throw new HttpError(401, "Token tidak valid atau kedaluwarsa");
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);
  if (!profile) throw new HttpError(403, "Profil pengguna tidak ditemukan");
  if (!profile.statusAktif) throw new HttpError(403, "Akun dinonaktifkan");

  return { user: data.user, profile };
}

// roles: contoh ['admin'] atau ['petugas', 'admin']. Kosong = semua yang sudah login.
export async function requireRole(request, roles = []) {
  const ctx = await getCurrentUser(request);
  if (roles.length > 0 && !roles.includes(ctx.profile.role)) {
    throw new HttpError(403, "Akses ditolak untuk peran ini");
  }
  return ctx;
}

export function handleError(err, label) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const code = err?.code || err?.cause?.code;
  if (code === "P0001") {
    const msg =
      err?.cause?.message ||
      err?.message ||
      "Aksi ditolak oleh aturan database";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
  if (code === "23505") {
    return NextResponse.json(
      { error: "Data bentrok dengan data yang sudah ada" },
      { status: 409 },
    );
  }
  if (["23503", "23514", "22P02", "22007"].includes(code)) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  console.error(label, err);
  const body = { error: "Terjadi kesalahan server" };
  if (process.env.NODE_ENV !== "production") {
    body.detail = String(err?.cause?.message || err?.message || err);
  }
  return NextResponse.json(body, { status: 500 });
}
