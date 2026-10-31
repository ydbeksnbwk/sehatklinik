import pg from "pg";

const g = globalThis;
export const pool =
  g.__pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
if (process.env.NODE_ENV !== "production") g.__pgPool = pool;
