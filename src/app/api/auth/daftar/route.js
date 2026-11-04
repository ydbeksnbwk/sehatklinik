import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { pasien } from "@/db/schema";
import { handleError } from "@/lib/auth";
import { hariIni, tanggalValid } from "@/lib/tanggal";
import { supabaseAdmin } from "@/lib/supabase-admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEPON = /^\+?[0-9]{8,15}$/;
const NIK = /^[0-9]{16}$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

// 0812... -> 62812..., +62812... -> 62812... (format yang disimpan Supabase Auth)
function keFormatInternasional(t) {
  if (!t) return undefined;
  const digit = t.replace(/^\+/, "");
  return digit.startsWith("0") ? `62${digit.slice(1)}` : digit;
}

export async function POST(request) {
  try {
    const b = await request.json().catch(() => ({}));
    const email = str(b.email).toLowerCase();
    const password = typeof b.password === "string" ? b.password : "";
    const nama = str(b.nama);
    const telepon = str(b.telepon);
    const nik = str(b.nik);
    const tanggalLahir = str(b.tanggalLahir);
    const jenisKelamin = str(b.jenisKelamin).toUpperCase();
    const alamat = str(b.alamat);
    const kontakDarurat = str(b.kontakDarurat);

    const details = {};
    if (!EMAIL.test(email)) details.email = "Format email tidak valid";
    if (password.length < 8) details.password = "Password minimal 8 karakter";
    if (nama.length < 1 || nama.length > 150)
      details.nama = "Nama wajib diisi (maks 150 karakter)";
    if (telepon && !TELEPON.test(telepon))
      details.telepon = "Telepon 8-15 digit, boleh diawali +";
    if (
      kontakDarurat &&
      !TELEPON.test(kontakDarurat) &&
      kontakDarurat.length > 50
    ) {
      details.kontakDarurat = "Kontak darurat terlalu panjang";
    }
    if (!NIK.test(nik)) details.nik = "NIK wajib diisi (16 digit)";
    if (
      !tanggalValid(tanggalLahir) ||
      tanggalLahir < "1900-01-01" ||
      tanggalLahir > hariIni()
    ) {
      details.tanggalLahir = "Tanggal lahir tidak valid (format YYYY-MM-DD)";
    }
    if (!["L", "P"].includes(jenisKelamin))
      details.jenisKelamin = "Isi L atau P";
    if (Object.keys(details).length > 0) {
      return NextResponse.json(
        { error: "Data tidak valid", details },
        { status: 400 },
      );
    }

    if (nik) {
      const [dupNik] = await db
        .select({ id: pasien.id })
        .from(pasien)
        .where(eq(pasien.nik, nik))
        .limit(1);
      if (dupNik) {
        return NextResponse.json(
          { error: "NIK sudah terdaftar" },
          { status: 409 },
        );
      }
    }

    // Trigger handle_new_user membaca user_metadata ini lalu membuat profiles + pasien.
    // Peran sengaja TIDAK dikirim: tanpa app_metadata.role, hasilnya otomatis 'pasien'.
    // display_name dipakai kolom "Display name" di dashboard Supabase Auth.
    const phone = keFormatInternasional(telepon);
    const { data, error } = await supabaseAdmin().auth.admin.createUser({
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
        alamat,
        kontak_darurat: kontakDarurat,
      },
    });
    if (error) {
      const msg = error.message || "";
      if (/phone/i.test(msg) && /already|registered|exists/i.test(msg)) {
        return NextResponse.json(
          { error: "Nomor telepon sudah terdaftar" },
          { status: 409 },
        );
      }
      if (/already|registered|exists/i.test(msg)) {
        return NextResponse.json(
          { error: "Email sudah terdaftar" },
          { status: 409 },
        );
      }
      console.error("POST /api/auth/daftar createUser", error);
      const status = error.status >= 500 ? 500 : 400;
      return NextResponse.json({ error: "Gagal membuat akun" }, { status });
    }

    const [p] = await db
      .select({ noRekamMedis: pasien.noRekamMedis })
      .from(pasien)
      .where(eq(pasien.profileId, data.user.id))
      .limit(1);

    return NextResponse.json(
      {
        data: {
          id: data.user.id,
          email,
          nama,
          role: "pasien",
          noRekamMedis: p?.noRekamMedis ?? null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err, "POST /api/auth/daftar");
  }
}
