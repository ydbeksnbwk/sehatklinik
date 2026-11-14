import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dokter } from "@/db/schema";
import { HttpError, handleError, requireRole } from "@/lib/auth";
import { UUID } from "@/lib/akses";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Magic bytes:
// JPEG: FF D8 FF
// PNG: 89 50 4E 47 0D 0A 1A 0A
// WEBP: starts with "RIFF" (52 49 46 46), followed by 4 bytes size, then "WEBP" (57 45 42 50)
function getMimeAndExtFromMagicBytes(buffer) {
  if (buffer.length < 12) return null;

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export async function POST(request, { params }) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await params;
    if (!UUID.test(id)) {
      throw new HttpError(400, "id dokter tidak valid");
    }

    const [existingDoctor] = await db
      .select({ id: dokter.id })
      .from(dokter)
      .where(eq(dokter.id, id))
      .limit(1);

    if (!existingDoctor) {
      throw new HttpError(404, "Dokter tidak ditemukan");
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new HttpError(400, "Form data tidak valid");
    }

    const file = formData.get("file") || formData.get("foto");
    if (!file || typeof file === "string") {
      throw new HttpError(400, "Berkas foto wajib diunggah");
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_SIZE) {
      throw new HttpError(400, "Ukuran berkas melebihi batas maksimal 2 MB");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const typeInfo = getMimeAndExtFromMagicBytes(buffer);
    if (!typeInfo) {
      throw new HttpError(
        422,
        "Format berkas tidak didukung. Hanya menerima JPEG, PNG, atau WebP (terdeteksi dari isi berkas)",
      );
    }

    // Nama berkas oleh server
    const fileName = `foto-dokter-${id}-${Date.now()}.${typeInfo.ext}`;
    const storagePath = `dokter/${fileName}`;

    const admin = supabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from("foto-dokter")
      .upload(storagePath, buffer, {
        contentType: typeInfo.mime,
        upsert: true,
      });

    if (uploadError) {
      throw new HttpError(
        500,
        `Gagal mengunggah foto ke storage: ${uploadError.message}`,
      );
    }

    // Ambil public URL
    const { data: urlData } = admin.storage
      .from("foto-dokter")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || null;

    // Perbarui foto_path di database
    const [updated] = await db
      .update(dokter)
      .set({ fotoPath: storagePath })
      .where(eq(dokter.id, id))
      .returning({
        id: dokter.id,
        nama: dokter.nama,
        fotoPath: dokter.fotoPath,
      });

    return NextResponse.json({
      data: {
        id: updated.id,
        nama: updated.nama,
        fotoPath: updated.fotoPath,
        fotoUrl: publicUrl,
      },
    });
  } catch (err) {
    return handleError(err, "POST /api/admin/dokter/[id]/foto");
  }
}
