import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { handleError, requireRole } from "@/lib/auth";

const LanggananSchema = z.object({
  endpoint: z.string().url("Format endpoint subscription tidak valid"),
  p256dh: z.string().min(1, "Kunci p256dh wajib diisi"),
  auth: z.string().min(1, "Kunci auth wajib diisi"),
  userAgent: z.string().optional().nullable(),
});

const BatalLanggananSchema = z.object({
  endpoint: z.string().url("Format endpoint subscription tidak valid"),
});

export async function POST(request) {
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

export async function DELETE(request) {
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

    await db
      .update(pushSubscriptions)
      .set({ aktif: false })
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.profileId, profile.id)
        )
      );

    return NextResponse.json({
      data: { success: true },
    });
  } catch (err) {
    return handleError(err, "DELETE /api/push/langganan");
  }
}
