import { apiHandler } from "@/lib/api-handler";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PenggunaCreateSchema = z.object({
  email: z
    .string({ required_error: "Email wajib diisi" })
    .trim()
    .email("Format email tidak valid")
    .toLowerCase(),
  password: z
    .string({ required_error: "Password wajib diisi" })
    .min(8, "Password minimal 8 karakter"),
  nama: z
    .string({ required_error: "Nama wajib diisi" })
    .trim()
    .min(1, "Nama wajib diisi")
    .max(150, "Nama maksimal 150 karakter"),
  role: z.enum(["admin", "petugas", "dokter", "pasien"], {
    required_error: "Role wajib dipilih (admin, petugas, dokter, pasien)",
  }),
  telepon: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Format telepon harus 8-15 digit angka")
    .optional()
    .nullable(),
});

async function _GET(request) {
  try {
    await requireRole(request, ["admin"]);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const roleParam = searchParams.get("role")?.toLowerCase();
    const statusParam = searchParams.get("statusAktif");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (q) {
      conditions.push(
        or(
          ilike(profiles.nama, `%${q}%`),
          ilike(profiles.telepon, `%${q}%`)
        )
      );
    }

    if (roleParam && ["admin", "petugas", "dokter", "pasien"].includes(roleParam)) {
      conditions.push(eq(profiles.role, roleParam));
    }

    if (statusParam === "true") {
      conditions.push(eq(profiles.statusAktif, true));
    } else if (statusParam === "false") {
      conditions.push(eq(profiles.statusAktif, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(profiles)
      .where(whereClause);

    const rows = await db
      .select()
      .from(profiles)
      .where(whereClause)
      .orderBy(desc(profiles.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Ambil data email pengguna dari Supabase Auth Admin
    const emailMap = new Map();
    try {
      const admin = supabaseAdmin();
      const { data: authData } = await admin.auth.admin.listUsers({
        perPage: 1000,
      });
      if (authData?.users) {
        for (const u of authData.users) {
          emailMap.set(u.id, u.email);
        }
      }
    } catch {
      // Abaikan jika listUsers auth gagal, fallback email tetap null
    }

    const resultData = rows.map((r) => ({
      id: r.id,
      nama: r.nama,
      email: emailMap.get(r.id) || null,
      telepon: r.telepon,
      role: r.role,
      statusAktif: r.statusAktif,
      createdAt: r.createdAt,
    }));

    const totalPages = Math.ceil(total / pageSize) || 1;

    return NextResponse.json({
      data: resultData,
      meta: {
        page,
        pageSize,
        total: Number(total),
        totalPages,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/pengguna");
  }
}

async function _POST(request) {
  const admin = supabaseAdmin();
  let createdAuthUserId = null;
  try {
    await requireRole(request, ["admin"]);

    const body = await request.json().catch(() => ({}));
    const parsed = PenggunaCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data pengguna baru tidak valid",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { email, password, nama, role, telepon } = parsed.data;

    // Buat pengguna via Supabase Auth Admin dengan app_metadata.role
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { nama, display_name: nama, telepon },
    });

    if (authError) {
      const isDuplicate = /already|registered|exists/i.test(authError.message || "");
      throw new HttpError(
        isDuplicate ? 409 : 400,
        isDuplicate ? "Email sudah terdaftar" : `Gagal membuat akun staf: ${authError.message}`
      );
    }

    createdAuthUserId = authData.user.id;

    // Pastikan baris di profiles tersimpan dan terbarui
    const [profile] = await db
      .insert(profiles)
      .values({
        id: createdAuthUserId,
        nama,
        telepon: telepon || null,
        role,
        statusAktif: true,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          nama,
          telepon: telepon || null,
          role,
          statusAktif: true,
        },
      })
      .returning();

    return NextResponse.json(
      {
        data: {
          id: profile.id,
          email,
          nama: profile.nama,
          role: profile.role,
          statusAktif: profile.statusAktif,
          telepon: profile.telepon,
          createdAt: profile.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    // Kompensasi jika pembuatan profile gagal tapi auth user sempat dibuat
    if (createdAuthUserId) {
      try {
        await admin.auth.admin.deleteUser(createdAuthUserId);
      } catch {}
    }
    return handleError(err, "POST /api/admin/pengguna");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/admin/pengguna" });
export const POST = apiHandler(_POST, { route: "POST /api/admin/pengguna" });
