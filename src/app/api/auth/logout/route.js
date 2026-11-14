import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { hapusCookieSesi, handleError, getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(request) {
  try {
    // Menonaktifkan hanya subscription perangkat ini bila endpoint dikirim (PRD §7.4 & Butir 3)
    try {
      const { profile } = await getCurrentUser(request);
      if (profile?.id) {
        const body = await request.json().catch(() => ({}));
        if (body?.endpoint && typeof body.endpoint === "string" && body.endpoint.trim()) {
          await db
            .update(pushSubscriptions)
            .set({ aktif: false })
            .where(
              and(
                eq(pushSubscriptions.profileId, profile.id),
                eq(pushSubscriptions.endpoint, body.endpoint.trim())
              )
            );
        }
      }
    } catch {
      // Abaikan jika tidak ada sesi aktif atau token kedaluwarsa
    }

    try {
      await supabaseServer().auth.signOut();
    } catch {
      // Abaikan bila sesi sudah tidak ada di Supabase
    }

    const response = NextResponse.json({
      data: { message: "Logout berhasil" },
    });

    hapusCookieSesi(response);

    return response;
  } catch (err) {
    return handleError(err, "POST /api/auth/logout");
  }
}
