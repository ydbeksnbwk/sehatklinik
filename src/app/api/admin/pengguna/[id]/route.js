import { apiHandler } from "@/lib/api-handler";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PenggunaUpdateSchema = z.object({
  role: z.enum(["admin", "petugas", "dokter", "pasien"]).optional(),
  statusAktif: z.boolean().optional(),
  nama: z.string().trim().min(1, "Nama minimal 1 karakter").max(150).optional(),
  telepon: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Format telepon harus 8-15 digit angka")
    .optional()
    .nullable(),
});

async function _GET(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;

    if (!UUID.test(id)) {
      throw new HttpError(400, "ID pengguna tidak valid", "BAD_REQUEST");
    }

    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    if (!userProfile) {
      throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
    }

    let email = null;
    try {
      const admin = supabaseAdmin();
      const { data: authUser } = await admin.auth.admin.getUserById(id);
      if (authUser?.user?.email) {
        email = authUser.user.email;
      }
    } catch {}

    return NextResponse.json({
      data: {
        ...userProfile,
        email,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/pengguna/[id]");
  }
}

async function _PATCH(request, { params }) {
  try {
    const { profile: currentAdmin } = await requireRole(request, ["admin"]);
    const { id } = await params;

    if (!UUID.test(id)) {
      throw new HttpError(400, "ID pengguna tidak valid", "BAD_REQUEST");
    }

    // BR-11: Admin tidak dapat mengubah akun atau perannya sendiri
    if (currentAdmin.id === id) {
      throw new HttpError(
        403,
        "Admin tidak dapat mengubah peran atau status akunnya sendiri (BR-11)",
        "FORBIDDEN"
      );
    }

    const [targetProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    if (!targetProfile) {
      throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = PenggunaUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data perbaruan pengguna tidak valid",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { role, statusAktif, nama, telepon } = parsed.data;

    // Perbarui metadata Supabase Auth jika role diubah
    if (role && role !== targetProfile.role) {
      try {
        const admin = supabaseAdmin();
        await admin.auth.admin.updateUserById(id, {
          app_metadata: { role },
          user_metadata: nama ? { nama, display_name: nama } : undefined,
        });
      } catch (authErr) {
        console.warn("Gagal memperbarui app_metadata di Supabase Auth:", authErr);
      }
    }

    const updateFields = {};
    if (role !== undefined) updateFields.role = role;
    if (statusAktif !== undefined) updateFields.statusAktif = statusAktif;
    if (nama !== undefined) updateFields.nama = nama;
    if (telepon !== undefined) updateFields.telepon = telepon;

    const [updated] = await db
      .update(profiles)
      .set(updateFields)
      .where(eq(profiles.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleError(err, "PATCH /api/admin/pengguna/[id]");
  }
}

async function _DELETE(request, { params }) {
  try {
    const { profile: currentAdmin } = await requireRole(request, ["admin"]);
    const { id } = await params;

    if (!UUID.test(id)) {
      throw new HttpError(400, "ID pengguna tidak valid", "BAD_REQUEST");
    }

    // BR-11: Admin tidak dapat mengubah/menonaktifkan akunnya sendiri
    if (currentAdmin.id === id) {
      throw new HttpError(
        403,
        "Admin tidak dapat menonaktifkan akunnya sendiri (BR-11)",
        "FORBIDDEN"
      );
    }

    const [targetProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    if (!targetProfile) {
      throw new HttpError(404, "Pengguna tidak ditemukan", "NOT_FOUND");
    }

    const [deactivated] = await db
      .update(profiles)
      .set({ statusAktif: false })
      .where(eq(profiles.id, id))
      .returning();

    return NextResponse.json({
      data: {
        id: deactivated.id,
        nama: deactivated.nama,
        statusAktif: false,
        message: "Akun pengguna berhasil dinonaktifkan.",
      },
    });
  } catch (err) {
    return handleError(err, "DELETE /api/admin/pengguna/[id]");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/admin/pengguna/[id]" });
export const PATCH = apiHandler(_PATCH, { route: "PATCH /api/admin/pengguna/[id]" });
export const DELETE = apiHandler(_DELETE, { route: "DELETE /api/admin/pengguna/[id]" });
