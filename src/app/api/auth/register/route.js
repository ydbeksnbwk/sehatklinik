// src/app/api/auth/register/route.js
// POST /api/auth/register - registrasi akun pasien baru
// Validasi Zod, akun via Supabase Auth Admin di server, profil via Drizzle.

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { pasien, profiles } from "@/db/schema";
import { handleError, HttpError } from "@/lib/auth";
import { hariIni } from "@/lib/tanggal";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { skemaRegistrasi } from "@/lib/validasi/auth";

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

export async function POST(request) {
  try {
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

    // 2. Validasi tanggal lahir logis
    if (tanggalLahir < "1900-01-01" || tanggalLahir > hariIni()) {
      return galat(
        "VALIDATION_ERROR",
        "Tanggal lahir tidak valid",
        { tanggalLahir: "Tanggal lahir tidak valid" },
        400
      );
    }

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

    // 4. Daftarkan akun di Supabase Auth Admin
    const phone = keFormatInternasional(telepon);
    const { data: authData, error: authError } = await supabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      ...(phone ? { phone, phone_confirm: true } : {}),
      user_metadata: {
        display_name: nama,
        nama,
        telepon,
        nik,
        tanggal_lahir: tanggalLahir,
        jenis_kelamin: jenisKelamin,
        alamat: alamat || "",
        kontak_darurat: kontakDarurat || "",
        role: "pasien",
      },
      app_metadata: {
        role: "pasien",
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
      console.error("POST /api/auth/register authError:", authError);
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
