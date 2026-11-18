import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum didefinisikan!');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const query = `
    SELECT 
      t.tablename,
      t.rowsecurity AS rls_enabled,
      COUNT(p.policyname) AS jumlah_policy,
      COALESCE(string_agg(p.policyname || ' (' || p.cmd || ')', ', '), '-') AS daftar_policy
    FROM pg_tables t
    LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
    WHERE t.schemaname = 'public'
    GROUP BY t.tablename, t.rowsecurity
    ORDER BY t.tablename;
  `;

  const res = await client.query(query);
  console.log('\n=== DAFTAR TABEL & JUMLAH POLICY RLS (SCHEMA public) ===\n');
  console.table(res.rows.map(r => ({
    tabel: r.tablename,
    rls_enabled: r.rls_enabled,
    jumlah_policy: Number(r.jumlah_policy),
    daftar_policy: r.daftar_policy.length > 60 ? r.daftar_policy.substring(0, 57) + '...' : r.daftar_policy
  })));

  console.log('\nDetail Lengkap Policy:');
  for (const r of res.rows) {
    console.log(`- ${r.tablename} (RLS: ${r.rls_enabled}, Policy: ${r.jumlah_policy}): ${r.daftar_policy}`);
  }
} finally {
  await client.end();
}
