import { and, count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { notifikasi } from "@/db/schema";
import { handleError, requireRole } from "@/lib/auth";
import { denganRls } from "@/lib/rls";

export async function GET(request) {
  try {
    const { profile, user } = await requireRole(request);
    const userId = profile?.id || user?.id;
    const { searchParams } = new URL(request.url);
    const hanyaBelumDibaca = searchParams.get("belumDibaca") === "1";

    const hasil = await denganRls(userId, async (tx) => {
      // Isolasi ketat: hanya tampilkan notifikasi milik pengguna yang sedang login
      const conds = [eq(notifikasi.profileId, userId)];
      if (hanyaBelumDibaca) conds.push(eq(notifikasi.isRead, false));

      const rows = await tx
        .select({
          id: notifikasi.id,
          pesan: notifikasi.pesan,
          isRead: notifikasi.isRead,
          jenisKejadian: notifikasi.jenisKejadian,
          tautan: notifikasi.tautan,
          createdAt: notifikasi.createdAt,
        })
        .from(notifikasi)
        .where(and(...conds))
        .orderBy(desc(notifikasi.createdAt))
        .limit(50);

      const [{ n }] = await tx
        .select({ n: count() })
        .from(notifikasi)
        .where(
          and(
            eq(notifikasi.profileId, userId),
            eq(notifikasi.isRead, false),
          ),
        );
      return { rows, n };
    });

    return NextResponse.json({
      data: hasil.rows,
      meta: { belumDibaca: hasil.n },
    });
  } catch (err) {
    return handleError(err, "GET /api/notifikasi");
  }
}

// Tandai semua notifikasi milik pengguna sebagai sudah dibaca.
export async function PATCH(request) {
  try {
    const { profile, user } = await requireRole(request);
    const userId = profile?.id || user?.id;
    const res = await denganRls(userId, (tx) =>
      tx
        .update(notifikasi)
        .set({ isRead: true })
        .where(
          and(
            eq(notifikasi.profileId, userId),
            eq(notifikasi.isRead, false),
          ),
        )
        .returning({ id: notifikasi.id }),
    );
    return NextResponse.json({ data: { diperbarui: res.length } });
  } catch (err) {
    return handleError(err, "PATCH /api/notifikasi");
  }
}
