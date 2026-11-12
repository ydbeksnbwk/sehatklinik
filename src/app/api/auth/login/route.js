import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifikasi, profiles } from "@/db/schema";
import { supabaseServer } from "@/lib/supabase";
import { handleError, pasangCookieSesi } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Email dan password wajib diisi",
          },
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer().auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.session) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Email atau password salah",
          },
        },
        { status: 401 }
      );
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, data.user.id))
      .limit(1);
    if (!profile) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Profil pengguna tidak ditemukan",
          },
        },
        { status: 403 }
      );
    }
    if (!profile.statusAktif) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Akun dinonaktifkan",
          },
        },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      data: {
        user: {
          id: profile.id,
          email: data.user.email,
          nama: profile.nama,
          telepon: profile.telepon,
          role: profile.role,
        },
      },
    });

    // Cek apakah pengguna sudah memiliki notifikasi WELCOME, jika belum buatkan
    try {
      const [existingWelcome] = await db
        .select({ id: notifikasi.id })
        .from(notifikasi)
        .where(
          and(
            eq(notifikasi.profileId, profile.id),
            eq(notifikasi.jenisKejadian, "WELCOME")
          )
        )
        .limit(1);

      if (!existingWelcome) {
        const roleRoutes = {
          admin: "/admin",
          petugas: "/petugas",
          dokter: "/dokter-dashboard",
          pasien: "/pasien",
        };
        const targetRoute = roleRoutes[profile.role] || "/pasien";
        await db.insert(notifikasi).values({
          profileId: profile.id,
          pesan: `Halo ${profile.nama}, akun Anda aktif dan siap digunakan untuk pendaftaran serta pemantauan antrean.`,
          jenisKejadian: "WELCOME",
          tautan: targetRoute,
          pushStatus: "menunggu",
          isRead: false,
        });
      }
    } catch (notifErr) {
      console.warn("Gagal membuat notifikasi selamat datang login:", notifErr);
    }

    // Pasang cookie httpOnly (tanpa mengekspos token mentah di body respons)
    pasangCookieSesi(response, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in || 3600,
    });

    return response;
  } catch (err) {
    return handleError(err, "POST /api/auth/login");
  }
}
