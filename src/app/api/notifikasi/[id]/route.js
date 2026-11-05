import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { notifikasi } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { denganRls } from "@/lib/rls";

export async function PATCH(request, { params }) {
  try {
    const { profile } = await requireRole(request);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(400, "id tidak valid");

    const res = await denganRls(profile.id, (tx) =>
      tx
        .update(notifikasi)
        .set({ isRead: true })
        .where(and(eq(notifikasi.id, id), eq(notifikasi.profileId, profile.id)))
        .returning({ id: notifikasi.id }),
    );
    if (res.length === 0)
      throw new HttpError(404, "Notifikasi tidak ditemukan");

    return NextResponse.json({ data: { id, isRead: true } });
  } catch (err) {
    return handleError(err, "PATCH /api/notifikasi/[id]");
  }
}
