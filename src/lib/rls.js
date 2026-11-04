import { sql } from "drizzle-orm";
import { db } from "@/db";

// Menjalankan fn dalam transaksi sebagai pengguna login, sehingga RLS database ikut bekerja.
export function denganRls(userId, fn) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`,
    );
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

// Untuk endpoint publik (tanpa login).
export function sebagaiAnon(fn) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role anon`);
    return fn(tx);
  });
}
