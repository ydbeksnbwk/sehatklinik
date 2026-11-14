import { pool } from "@/db/index.js";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(
  async function GET() {
    await pool.query("select 1");
    return Response.json({ data: { database: "ok" } });
  },
  { route: "GET /api/health" }
);
