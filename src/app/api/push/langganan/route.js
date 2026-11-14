import { apiHandler } from "@/lib/api-handler";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { handleError, requireRole } from "@/lib/auth";

const LanggananSchema = z.object({
  endpoint: z.string().trim().url("Format endpoint subscription tidak valid"),
  p256dh: z.string().trim().min(1, "Kunci p256dh wajib diisi"),
  auth: z.string().trim().min(1, "Kunci auth wajib diisi"),
  userAgent: z.string().optional().nullable(),
});

const BatalLanggananSchema = z.object({
  endpoint: z.string().trim().url("Format endpoint subscription tidak valid"),
});

async function _POST(request) {
  try {
    const { profile } = await requireRole(request);
    const body = await request.json().catch(() => ({}));
    const parsed = LanggananSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Payload langganan push tidak valid",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { endpoint, p256dh, auth, userAgent } = parsed.data;
    const ua = userAgent || request.headers.get("user-agent") || null;

    const [hasil] = await db
      .insert(pushSubscriptions)
      .values({
        profileId: profile.id,
        endpoint,
        p256dh,
        auth,
        userAgent: ua,
        aktif: true,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          profileId: profile.id,
          p256dh,
          auth,
          userAgent: ua,
          aktif: true,
        },
      })
      .returning();

    return NextResponse.json(
      {
        data: {
          id: hasil.id,
          aktif: hasil.aktif,
          createdAt: hasil.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err, "POST /api/push/langganan");
  }
}

async function _DELETE(request) {
  try {
    const { profile } = await requireRole(request);
    const body = await request.json().catch(() => ({}));
    const parsed = BatalLanggananSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Payload pembatalan push tidak valid",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { endpoint } = parsed.data;

    // Cek keberadaan langganan; data milik orang lain atau tidak ada -> 404
    const [sub] = await db
      .select({ id: pushSubscriptions.id, profileId: pushSubscriptions.profileId })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (!sub || sub.profileId !== profile.id) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Langganan push tidak ditemukan",
          },
        },
        { status: 404 }
      );
    }

    await db
      .update(pushSubscriptions)
      .set({ aktif: false })
      .where(eq(pushSubscriptions.id, sub.id));

    return NextResponse.json({
      data: { success: true },
    });
  } catch (err) {
    return handleError(err, "DELETE /api/push/langganan");
  }
}

export const POST = apiHandler(_POST, { route: "POST /api/push/langganan" });
export const DELETE = apiHandler(_DELETE, { route: "DELETE /api/push/langganan" });
