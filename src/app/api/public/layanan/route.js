import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { layanan } from "@/db/schema";
import { handleError } from "@/lib/auth";
import { sebagaiAnon } from "@/lib/rls";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().replace(/[\\%_]/g, "\\$&");
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1,
    );
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10) || 10),
    );

    const conds = [eq(layanan.aktif, true)];
    if (q) {
      conds.push(
        or(
          ilike(layanan.namaLayanan, `%${q}%`),
          ilike(layanan.deskripsi, `%${q}%`),
        ),
      );
    }
    const where = and(...conds);

    const { total, rows } = await sebagaiAnon(async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(layanan)
        .where(where);
      const rows = await tx
        .select({
          id: layanan.id,
          namaLayanan: layanan.namaLayanan,
          deskripsi: layanan.deskripsi,
          durasiMenit: layanan.durasiMenit,
        })
        .from(layanan)
        .where(where)
        .orderBy(asc(layanan.namaLayanan))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      return { total, rows };
    });

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/public/layanan");
  }
}
