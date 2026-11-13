// src/app/api/admin/pekerjaan-notifikasi/route.js
// GET /api/admin/pekerjaan-notifikasi
// Endpoint pemantauan pekerjaan Web Push (PRD §7.5 & Butir 4)
// Otorisasi: admin dan petugas (dokter dan pasien 403)

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifikasi, profiles } from "@/db/schema";
import { handleError, requireRole } from "@/lib/auth";

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(["semua", "menunggu", "berhasil", "gagal"]).default("semua"),
});

export async function GET(request) {
  try {
    // 1. Otorisasi server-side: hanya admin dan petugas (dokter & pasien ditolak 403)
    await requireRole(request, ["admin", "petugas"]);

    // 2. Validasi parameter query dengan Zod
    const { searchParams } = new URL(request.url);
    const parsedQuery = QuerySchema.safeParse({
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 10,
      status: searchParams.get("status") || "semua",
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Parameter query tidak valid",
            fields: parsedQuery.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { page, pageSize, status } = parsedQuery.data;
    const offset = (page - 1) * pageSize;

    // 3. Kondisi filter push_status
    const conditions = [];
    if (status !== "semua") {
      conditions.push(eq(notifikasi.pushStatus, status));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 4. Hitung total baris untuk pagination
    const [totalRow] = await db
      .select({ count: sql`count(*)::int` })
      .from(notifikasi)
      .where(whereClause);

    const total = Number(totalRow?.count || 0);
    const totalPages = Math.ceil(total / pageSize) || 1;

    // 5. Query data dengan nama penerima dari relasi profiles
    const rows = await db
      .select({
        id: notifikasi.id,
        jenisKejadian: notifikasi.jenisKejadian,
        pesan: notifikasi.pesan,
        pushStatus: notifikasi.pushStatus,
        pushPercobaan: notifikasi.pushPercobaan,
        pushError: notifikasi.pushError,
        pushDiprosesAt: notifikasi.pushDiprosesAt,
        createdAt: notifikasi.createdAt,
        tautan: notifikasi.tautan,
        namaPenerima: sql`coalesce(${profiles.nama}, 'Pengguna')`.as("nama_penerima"),
      })
      .from(notifikasi)
      .leftJoin(profiles, eq(notifikasi.profileId, profiles.id))
      .where(whereClause)
      .orderBy(desc(notifikasi.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/admin/pekerjaan-notifikasi");
  }
}
