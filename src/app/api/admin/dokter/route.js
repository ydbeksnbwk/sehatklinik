import { apiHandler } from "@/lib/api-handler";
import { asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter, dokterLayanan, layanan } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { skemaDokterCreate } from "@/lib/validasi/dokter";
import { logger } from "@/lib/logger";

// Semua dokter, termasuk yang nonaktif, beserta layanannya.
async function _GET(request) {
  try {
    await requireRole(request, ["admin"]);
    const rows = await db.select().from(dokter).orderBy(asc(dokter.nama));

    const map = {};
    if (rows.length > 0) {
      const rel = await db
        .select({
          dokterId: dokterLayanan.dokterId,
          id: layanan.id,
          namaLayanan: layanan.namaLayanan,
        })
        .from(dokterLayanan)
        .innerJoin(layanan, inArray(dokterLayanan.layananId, [layanan.id]))
        .where(
          inArray(
            dokterLayanan.dokterId,
            rows.map((r) => r.id),
          ),
        );
      for (const r of rel)
        (map[r.dokterId] ||= []).push({ id: r.id, namaLayanan: r.namaLayanan });
    }

    return NextResponse.json({
      data: rows.map((r) => ({ ...r, layanan: map[r.id] || [] })),
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/dokter");
  }
}

// Membuat akun login dokter + data dokter + relasi layanan.
async function _POST(request) {
  let userId = null;
  const admin = supabaseAdmin();
  try {
    await requireRole(request, ["admin"]);
    const b = await request.json().catch(() => ({}));
    const validated = skemaDokterCreate.parse(b);
    const { email, password, nama, spesialisasi, noSip, deskripsi, layananIds } = validated;

    // Trigger handle_new_user membaca app_metadata.role dan membuat baris profiles.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "dokter" },
      user_metadata: { display_name: nama, nama },
    });
    if (error) {
      logger.error({
        msg: "POST /api/admin/dokter createUser error",
        status: error.status,
        code: error.code,
        error: error.message,
      });
      const dup = /already|registered|exists/i.test(error.message || "");
      const rincian =
        process.env.NODE_ENV !== "production" ? `: ${error.message}` : "";
      throw new HttpError(
        dup ? 409 : 400,
        dup ? "Email sudah terdaftar" : `Gagal membuat akun dokter${rincian}`,
      );
    }
    userId = data.user.id;

    const hasil = await db.transaction(async (tx) => {
      const [d] = await tx
        .insert(dokter)
        .values({ profileId: userId, nama, spesialisasi, noSip, deskripsi: deskripsi || null })
        .returning({
          id: dokter.id,
          nama: dokter.nama,
          spesialisasi: dokter.spesialisasi,
        });
      await tx
        .insert(dokterLayanan)
        .values(layananIds.map((layananId) => ({ dokterId: d.id, layananId })));
      return d;
    });

    return NextResponse.json({ data: { ...hasil, email } }, { status: 201 });
  } catch (err) {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
    return handleError(err, "POST /api/admin/dokter");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/admin/dokter" });
export const POST = apiHandler(_POST, { route: "POST /api/admin/dokter" });
