import { NextResponse } from "next/server";
import { requireRole, handleError } from "@/lib/auth";

export async function GET(request) {
  try {
    const { user, profile } = await requireRole(request);
    return NextResponse.json({
      data: {
        id: profile.id,
        email: user.email,
        nama: profile.nama,
        telepon: profile.telepon,
        role: profile.role,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/auth/me");
  }
}
