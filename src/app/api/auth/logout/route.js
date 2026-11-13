import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { hapusCookieSesi, handleError } from "@/lib/auth";

export async function POST() {
  try {
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
