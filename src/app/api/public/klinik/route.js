import { NextResponse } from "next/server";
import { profilKlinik } from "@/db/schema";
import { handleError } from "@/lib/auth";
import { sebagaiAnon } from "@/lib/rls";

export async function GET() {
  try {
    const [row] = await sebagaiAnon((tx) =>
      tx.select().from(profilKlinik).limit(1),
    );
    if (!row) {
      return NextResponse.json(
        { error: "Profil klinik belum diisi" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: {
        id: row.id,
        nama: row.nama,
        deskripsi: row.deskripsi,
        alamat: row.alamat,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        kontak: row.kontak,
        jamOperasional: row.jamOperasional,
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/public/klinik");
  }
}
