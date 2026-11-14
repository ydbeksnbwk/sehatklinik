import { apiHandler } from "@/lib/api-handler";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { layanan } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";

const LayananCreateSchema = z.object({
  namaLayanan: z
    .string({ required_error: "Nama layanan wajib diisi" })
    .trim()
    .min(1, "Nama layanan wajib diisi")
    .max(100, "Nama layanan maksimal 100 karakter"),
  deskripsi: z.string().trim().optional().nullable(),
  durasiMenit: z.coerce
    .number({ required_error: "Durasi menit wajib diisi" })
    .int("Durasi harus bilangan bulat")
    .min(1, "Durasi minimal 1 menit")
    .max(480, "Durasi maksimal 480 menit"),
  aktif: z.boolean().optional().default(true),
});

async function _GET(request) {
  try {
    await requireRole(request, ["admin"]);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const aktifParam = searchParams.get("aktif");
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
          ilike(layanan.namaLayanan, `%${q}%`),
          ilike(layanan.deskripsi, `%${q}%`)
        )
      );
    }

    if (aktifParam === "true") {
      conditions.push(eq(layanan.aktif, true));
    } else if (aktifParam === "false") {
      conditions.push(eq(layanan.aktif, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(layanan)
      .where(whereClause);

    const rows = await db
      .select()
      .from(layanan)
      .where(whereClause)
      .orderBy(asc(layanan.namaLayanan))
      .limit(pageSize)
      .offset(offset);

    const totalPages = Math.ceil(total / pageSize) || 1;

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total: Number(total),
        totalPages,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/layanan");
  }
}

async function _POST(request) {
  try {
    await requireRole(request, ["admin"]);

    const body = await request.json().catch(() => ({}));
    const parsed = LayananCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data layanan tidak valid",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { namaLayanan, deskripsi, durasiMenit, aktif } = parsed.data;

    // Cek duplikasi nama layanan (case-insensitive)
    const [existing] = await db
      .select({ id: layanan.id })
      .from(layanan)
      .where(sql`lower(${layanan.namaLayanan}) = lower(${namaLayanan})`)
      .limit(1);

    if (existing) {
      throw new HttpError(
        409,
        `Layanan dengan nama '${namaLayanan}' sudah ada`,
        "DUPLICATE_NAME"
      );
    }

    const [inserted] = await db
      .insert(layanan)
      .values({
        namaLayanan,
        deskripsi: deskripsi || null,
        durasiMenit,
        aktif: aktif ?? true,
      })
      .returning();

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/admin/layanan");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/admin/layanan" });
export const POST = apiHandler(_POST, { route: "POST /api/admin/layanan" });
