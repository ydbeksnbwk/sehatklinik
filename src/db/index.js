import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const g = globalThis;
export const pool =
  g.__pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
if (process.env.NODE_ENV !== "production") g.__pgPool = pool;

export const db = drizzle(pool, { schema });
