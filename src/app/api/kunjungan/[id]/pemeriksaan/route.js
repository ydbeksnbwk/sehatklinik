// src/app/api/kunjungan/[id]/pemeriksaan/route.js
// PUT /api/kunjungan/[id]/pemeriksaan
// Simpan/perbarui hasil pemeriksaan dan tindakan (BR-09, BR-10, BR-18)
//
// CATATAN KONTRAK: Frontend (ClinicContext.tsx) memanggil endpoint ini.
// URL dipertahankan sesuai permintaan prompt Tahap 1A.

import { NextResponse } from "next/server";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { skemaPemeriksaan } from "@/lib/validasi/kunjungan";
import { simpanPemeriksaan } from "@/lib/domain/pemeriksaan";

function galat(code, message, fields, status) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

export async function PUT(request, { params }) {
  try {
    // Next.js 15: params harus di-await
    const { id: kunjunganId } = await params;

    // Hanya dokter yang boleh menyimpan pemeriksaan
    const { profile } = await requireRole(request, ["dokter"]);

    const body = await request.json().catch(() => ({}));

    // Validasi Zod (termasuk BR-18 untuk rentang tanda vital)
    const parsed = skemaPemeriksaan.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      const issues = parsed.error.issues || [];
      issues.forEach((e) => {
        const path = e.path.join(".");
        fields[path] = e.message;
      });
      return galat("VALIDATION_ERROR", "Data pemeriksaan tidak valid", fields, 400);
    }

    const { anamnesis, diagnosis, catatan, tandaVital, tindakan } = parsed.data;

    // dokterId diambil dari sesi terverifikasi (profile.id), BUKAN dari body
    const result = await simpanPemeriksaan({
      kunjunganId,
      profileId: profile.id,
      anamnesis,
      diagnosis,
      catatan,
      tandaVital,
      tindakan,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof HttpError) {
      const code = err.kode || (err.status === 403 ? "FORBIDDEN" : err.status === 404 ? "NOT_FOUND" : "STATUS_TIDAK_VALID");
      return galat(code, err.message, null, err.status);
    }
    return handleError(err, "PUT /api/kunjungan/[id]/pemeriksaan");
  }
}
