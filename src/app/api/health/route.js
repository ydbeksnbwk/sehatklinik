import { pool } from "@/db/index.js";

export async function GET() {
  try {
    await pool.query("select 1");
    return Response.json({ data: { database: "ok" } });
  } catch (err) {
    console.error("health gagal:", err.message);
    return Response.json(
      {
        error: { code: "DB_ERROR", message: "Database tidak dapat dihubungi" },
      },
      { status: 500 },
    );
  }
}
