import { apiHandler } from "@/lib/api-handler";
// POST /api/auth/register - registrasi akun pasien baru (validasi Zod, Auth Admin, Drizzle).

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifikasi, pasien, profiles } from "@/db/schema";
import { handleError, HttpError } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { skemaRegistrasi } from "@/lib/validasi/auth";
import { ambilClientIp, checkRateLimit, buildRateLimitResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

function galat(code, message, fields, status = 400) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

// 0812... -> 62812..., +62812... -> 62812... (format internasional untuk Supabase Auth)
function keFormatInternasional(t) {
  if (!t) return undefined;
  const digit = t.replace(/^\+/, "");
  return digit.startsWith("0") ? `62${digit.slice(1)}` : digit;
}

async function _POST(request) {
  try {
    // Rate Limiting per IP (PRD §9)
    const ip = ambilClientIp(request);
    const rl = await checkRateLimit(`register:ip:${ip}`, { max: 10, windowSeconds: 60 });
    if (!rl.allowed) {
      return buildRateLimitResponse(rl.retryAfter, 10);
    }

    const body = await request.json().catch(() => ({}));

    // 1. Validasi Zod: NIK 16 digit, password kuat, telepon, nama, dll.
    const parsed = skemaRegistrasi.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      const issues = parsed.error.issues || [];
      issues.forEach((e) => {
        fields[e.path[0]] = e.message;
      });
      return galat("VALIDATION_ERROR", "Data tidak valid", fields, 400);
    }

    const {
      email,
      password,
      nama,
      telepon,
      nik,
      tanggalLahir,
      jenisKelamin,
      alamat,
      kontakDarurat,
    } = parsed.data;

    // 2. Validasi tanggal lahir (kalender valid, bukan masa depan) sudah di skema Zod

    // 3. Cek apakah NIK sudah terdaftar di database
    const [dupNik] = await db
      .select({ id: pasien.id })
      .from(pasien)
      .where(eq(pasien.nik, nik))
      .limit(1);

    if (dupNik) {
      return galat(
        "DUPLIKAT",
        "NIK sudah terdaftar",
        { nik: "NIK sudah terdaftar" },
        409
      );
    }

    // 4. Buat akun di Supabase Auth lewat Admin Client
    const admin = supabaseAdmin();
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        phone: keFormatInternasional(telepon),
        email_confirm: true,
        phone_confirm: true,
        app_metadata: { role: "pasien" },
        user_metadata: {
          nama,
          nik,
          tanggal_lahir: tanggalLahir,
          jenis_kelamin: jenisKelamin,
          alamat: alamat || null,
          kontak_darurat: kontakDarurat || null,
          telepon: telepon || null,
        },
      });

    if (authError) {
      const msg = authError.message || "";
      if (/already|registered|exists/i.test(msg) && /phone/i.test(msg)) {
        return galat("DUPLIKAT", "Nomor telepon sudah terdaftar", { telepon: "Nomor telepon sudah terdaftar" }, 409);
      }
      if (/already|registered|exists/i.test(msg)) {
        return galat("DUPLIKAT", "Email sudah terdaftar", { email: "Email sudah terdaftar" }, 409);
      }
      logger.error({ msg: "POST /api/auth/register authError", error: authError.message });
      return galat("INTERNAL", "Gagal membuat akun autentikasi", null, 500);
    }

    const userId = authData.user.id;

    // 5. Pastikan profil dan pasien tersimpan via Drizzle (melengkapi trigger database)
    await db
      .insert(profiles)
      .values({
        id: userId,
        nama,
        telepon: telepon || null,
        role: "pasien",
        statusAktif: true,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          nama,
          telepon: telepon || null,
          role: "pasien",
          statusAktif: true,
        },
      });

    // Ambil atau buat baris pasien
    let [p] = await db
      .select({ id: pasien.id, noRekamMedis: pasien.noRekamMedis })
      .from(pasien)
      .where(eq(pasien.profileId, userId))
      .limit(1);

    if (!p) {
      const { sql } = await import("drizzle-orm");
      const [seqRes] = await db.execute(sql`SELECT nextval('seq_no_rekam_medis') AS seq`);
      const nextRM = `RM-${String(seqRes.seq).padStart(6, "0")}`;

      const [baru] = await db
        .insert(pasien)
        .values({
          noRekamMedis: nextRM,
          profileId: userId,
          nama,
          nik,
          tanggalLahir,
          jenisKelamin,
          telepon: telepon || null,
          alamat: alamat || null,
          kontakDarurat: kontakDarurat || null,
        })
        .onConflictDoNothing()
        .returning({ id: pasien.id, noRekamMedis: pasien.noRekamMedis });

      p = baru;
    } else {
      await db
        .update(pasien)
        .set({
          alamat: alamat || null,
          kontakDarurat: kontakDarurat || null,
          telepon: telepon || null,
          nik: nik || null,
          tanggalLahir: tanggalLahir || null,
          jenisKelamin: jenisKelamin || null,
        })
        .where(eq(pasien.id, p.id));
    }

    // 6. Simpan notifikasi selamat datang ke tabel notifikasi
    try {
      await db.insert(notifikasi).values({
        profileId: userId,
        pesan: `Halo ${nama}, akun Anda aktif dan siap digunakan untuk pendaftaran serta pemantauan antrean.`,
        jenisKejadian: "WELCOME",
        tautan: "/pasien",
        pushStatus: "menunggu",
        isRead: false,
      });
    } catch (notifErr) {
      logger.warn({ msg: "Gagal membuat notifikasi selamat datang register", err: notifErr?.message });
    }

    return NextResponse.json(
      {
        data: {
          id: userId,
          email,
          nama,
          role: "pasien",
          noRekamMedis: p?.noRekamMedis ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err, "POST /api/auth/register");
  }
}

export const POST = apiHandler(_POST, { route: "POST /api/auth/register" });
