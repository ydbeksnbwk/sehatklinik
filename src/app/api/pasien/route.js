// src/app/api/pasien/route.js
// GET /api/pasien  - daftar pasien (petugas/admin, dengan paginasi dan pencarian)
// POST /api/pasien - tambah pasien baru walk-in (petugas)
//
// CATATAN KONTRAK: Frontend (ClinicContext.tsx) memanggil endpoint ini.
// URL dipertahankan sesuai permintaan prompt Tahap 1A.

import { NextResponse } from "next/server";
import { handleError, requireRole } from "@/lib/auth";
import { skemaTambahPasien } from "@/lib/validasi/pasien";
import { daftarPasien, tambahPasien } from "@/lib/domain/pasien";

function galat(code, message, fields, status) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

// GET /api/pasien?q=...&page=1&pageSize=10
// Hanya petugas dan admin
export async function GET(request) {
  try {
    const { profile } = await requireRole(request, ["petugas", "admin"]);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");

    const result = await daftarPasien({ q, page, pageSize });

    return NextResponse.json(result);
  } catch (err) {
    return handleError(err, "GET /api/pasien");
  }
}

// POST /api/pasien - tambah pasien baru
// Hanya petugas
export async function POST(request) {
  try {
    const { profile } = await requireRole(request, ["petugas"]);

    const body = await request.json().catch(() => ({}));

    // Validasi Zod
    const parsed = skemaTambahPasien.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      const issues = parsed.error.issues || [];
      issues.forEach((e) => {
        fields[e.path[0]] = e.message;
      });
      return galat("VALIDATION_ERROR", "Data tidak valid", fields, 400);
    }

    const { nama, tanggalLahir, jenisKelamin, nik, telepon, alamat, kontakDarurat } =
      parsed.data;

    const baru = await tambahPasien({
      nama,
      tanggalLahir,
      jenisKelamin,
      nik,
      telepon,
      alamat,
      kontakDarurat,
      profileId: null, // walk-in tidak punya akun
    });

    return NextResponse.json({ data: baru }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/pasien");
  }
}
