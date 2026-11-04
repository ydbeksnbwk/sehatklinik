import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { supabaseServer } from "@/lib/supabase";
import { handleError } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseServer().auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.session) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 },
      );
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, data.user.id))
      .limit(1);
    if (!profile) {
      return NextResponse.json(
        { error: "Profil pengguna tidak ditemukan" },
        { status: 403 },
      );
    }
    if (!profile.statusAktif) {
      return NextResponse.json(
        { error: "Akun dinonaktifkan" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: {
          id: profile.id,
          email: data.user.email,
          nama: profile.nama,
          telepon: profile.telepon,
          role: profile.role,
        },
      },
    });
  } catch (err) {
    return handleError(err, "POST /api/auth/login");
  }
}
