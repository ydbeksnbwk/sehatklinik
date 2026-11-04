import { asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter, dokterLayanan, layanan } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID, str } from "@/lib/akses";
import { supabaseAdmin } from "@/lib/supabase-admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Semua dokter, termasuk yang nonaktif, beserta layanannya.
export async function GET(request) {
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
export async function POST(request) {
  let userId = null;
  const admin = supabaseAdmin();
  try {
    await requireRole(request, ["admin"]);
    const b = await request.json().catch(() => ({}));
    const email = str(b.email).toLowerCase();
    const password = typeof b.password === "string" ? b.password : "";
    const nama = str(b.nama);
    const spesialisasi = str(b.spesialisasi);
    const noSip = str(b.noSip);
    const deskripsi = str(b.deskripsi) || null;
    const layananIds = Array.isArray(b.layananIds)
      ? [...new Set(b.layananIds)]
      : [];

    if (!EMAIL.test(email))
      throw new HttpError(400, "Format email tidak valid");
    if (password.length < 8)
      throw new HttpError(400, "Password minimal 8 karakter");
    if (nama.length < 1 || nama.length > 150)
      throw new HttpError(400, "Nama wajib diisi (maks 150 karakter)");
    if (!spesialisasi) throw new HttpError(400, "Spesialisasi wajib diisi");
    if (!noSip) throw new HttpError(400, "Nomor SIP wajib diisi");
    if (
      layananIds.length === 0 ||
      !layananIds.every((x) => typeof x === "string" && UUID.test(x))
    ) {
      throw new HttpError(
        400,
        "layananIds wajib berisi minimal satu id layanan yang valid",
      );
    }

    // Trigger handle_new_user membaca app_metadata.role dan membuat baris profiles.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "dokter" },
      user_metadata: { display_name: nama, nama, role: "dokter" },
    });
    if (error) {
      console.error(
        "POST /api/admin/dokter createUser",
        error.status,
        error.code,
        error.message,
      );
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
        .values({ profileId: userId, nama, spesialisasi, noSip, deskripsi })
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
