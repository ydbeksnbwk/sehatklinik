// src/app/api/kunjungan/[id]/transition/route.js
// POST /api/kunjungan/[id]/transition
// State machine antrean & kunjungan (BR-05, 06, 07, 08, 09, 15, K11, K12, K14)
//
// CATATAN KONTRAK: Frontend (ClinicContext.tsx) memanggil endpoint ini.
// URL dipertahankan sesuai permintaan prompt Tahap 1A.

import { NextResponse } from "next/server";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { skemaTransisi } from "@/lib/validasi/kunjungan";
import { jalankanTransisi } from "@/lib/domain/transisi";

function galat(code, message, fields, status) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

export async function POST(request, { params }) {
  try {
    // Next.js 15: params harus di-await
    const { id: kunjunganId } = await params;

    const { profile } = await requireRole(request);

    // Admin selalu ditolak (K12)
    if (profile.role === "admin") {
      return galat("FORBIDDEN", "Admin tidak berwenang melakukan transisi antrean", null, 403);
    }

    const body = await request.json().catch(() => ({}));

    // Validasi Zod
    const parsed = skemaTransisi.safeParse(body);
    if (!parsed.success) {
      const fields = {};
      const issues = parsed.error.issues || [];
      issues.forEach((e) => {
        fields[e.path[0]] = e.message;
      });
      return galat("VALIDATION_ERROR", "Data tidak valid", fields, 400);
    }

    const { aksi, alasan } = parsed.data;

    const result = await jalankanTransisi({
      kunjunganId,
      aksi,
      alasan,
      role: profile.role,
      profileId: profile.id,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof HttpError) {
      const code = err.kode || (err.status === 403 ? "FORBIDDEN" : err.status === 404 ? "NOT_FOUND" : "STATUS_TIDAK_VALID");
      return galat(code, err.message, null, err.status);
    }
    return handleError(err, "POST /api/kunjungan/[id]/transition");
  }
}
