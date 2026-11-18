// src/lib/auth-service.js
// Layanan otentikasi bersama (DRY) untuk login standar & login cepat.
// K1, K5, K7, K9, PRD §8

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifikasi, pasien, profiles } from "@/db/schema";
import { supabaseServer } from "@/lib/supabase";
import { HttpError, pasangCookieSesi } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * Menjalankan autentikasi signInWithPassword di server,
 * memeriksa profil dan status_aktif, menyiapkan payload profil/pasien,
 * membuat notifikasi selamat datang bila belum ada, dan memasang cookie sesi HttpOnly.
 */
export async function eksekusiLogin({ email, password }) {
  const { data, error } = await supabaseServer().auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.session) {
    throw new HttpError(401, "Email atau password salah", "UNAUTHENTICATED");
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);

  if (!profile) {
    throw new HttpError(403, "Profil pengguna tidak ditemukan", "FORBIDDEN");
  }
  if (!profile.statusAktif) {
    throw new HttpError(403, "Akun dinonaktifkan", "FORBIDDEN");
  }

  let detailPasien = null;
  if (profile.role === "pasien") {
    const [p] = await db
      .select()
      .from(pasien)
      .where(eq(pasien.profileId, profile.id))
      .limit(1);
    detailPasien = p || null;
  }

  const meta = data.user.user_metadata || {};

  const userObj = {
    id: profile.id,
    email: data.user.email,
    nama: profile.nama,
    telepon: detailPasien?.telepon || profile.telepon || meta.telepon || "-",
    role: profile.role,
    pasienId: detailPasien?.id ?? null,
    noRekamMedis: detailPasien?.noRekamMedis ?? null,
    nik: detailPasien?.nik || meta.nik || "",
    tanggalLahir: detailPasien?.tanggalLahir || meta.tanggal_lahir || "2000-01-01",
    jenisKelamin: detailPasien?.jenisKelamin || meta.jenis_kelamin || "Laki-laki",
    alamat: detailPasien?.alamat || meta.alamat || "-",
    kontakDarurat: detailPasien?.kontakDarurat || meta.kontak_darurat || "-",
  };

  const response = NextResponse.json({
    data: {
      user: userObj,
    },
  });

  // Sambutan selamat datang idempoten
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
    logger.warn({ msg: "Gagal membuat notifikasi selamat datang login", err: notifErr?.message });
  }

  // Pasang cookie httpOnly (tanpa mengekspos token mentah di body respons)
  pasangCookieSesi(response, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in || 3600,
  });

  return { response, user: userObj, profile };
}
