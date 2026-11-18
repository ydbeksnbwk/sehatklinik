import { apiHandler } from "@/lib/api-handler";
import { NextResponse } from "next/server";
import { profilKlinik } from "@/db/schema";
import { handleError } from "@/lib/auth";
import { sebagaiAnon } from "@/lib/rls";

async function _GET() {
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
        detail: row.detail || {},
        tagline: row.detail?.tagline || "",
        emergencyPhone: row.detail?.emergencyPhone || "",
        whatsapp: row.detail?.whatsapp || "",
        email: row.detail?.email || "",
        history: row.detail?.history || "",
        vision: row.detail?.vision || "",
        mission: row.detail?.mission || [],
        values: row.detail?.values || [],
        accreditation: row.detail?.accreditation || "",
        accreditationNumber: row.detail?.accreditationNumber || "",
        facilities: row.detail?.facilities || [],
        stats: row.detail?.stats || [],
      },
    });
  } catch (err) {
    return handleError(err, "GET /api/public/klinik");
  }
}

export const GET = apiHandler(_GET, { route: "GET /api/public/klinik" });
