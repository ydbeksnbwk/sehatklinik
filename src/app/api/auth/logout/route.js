import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { hapusCookieSesi, handleError, getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request) {
  try {
    // Nonaktifkan seluruh subscription push aktif milik pengguna saat logout (PRD §7.4 / Butir 2.3)
    try {
      const { profile } = await getCurrentUser(request);
      if (profile?.id) {
        await db
          .update(pushSubscriptions)
          .set({ aktif: false })
          .where(eq(pushSubscriptions.profileId, profile.id));
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
