import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum didefinisikan di environment!');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const tables = ['kunjungan', 'pasien', 'pemeriksaan', 'notifikasi', 'push_subscriptions'];

// Profil ID untuk pengujian
// Pasien A: Ani Wulandari
// Pasien B: Bagas Saputra
// Dokter: dr. Reyhan Adhitama
const ROLES_TO_TEST = [
  {
    label: 'pasien A (Ani)',
    dbRole: 'authenticated',
    claims: { sub: 'b0000000-0000-0000-0000-000000000001', role: 'authenticated' },
  },
  {
    label: 'pasien B (Bagas)',
    dbRole: 'authenticated',
    claims: { sub: 'b0000000-0000-0000-0000-000000000002', role: 'authenticated' },
  },
  {
    label: 'dokter (Reyhan)',
    dbRole: 'authenticated',
    claims: { sub: '16546208-3e50-4765-82ea-c38eebd434ed', role: 'authenticated' },
  },
  {
    label: 'anon',
    dbRole: 'anon',
    claims: { role: 'anon' },
  },
];

const results = [];

try {
  await client.query('BEGIN');

  // 1. Ambil jumlah baris sebenarnya sebagai role postgres
  const totals = {};
  for (const table of tables) {
    const res = await client.query('SELECT count(*)::int AS cnt FROM public.' + table);
    totals[table] = res.rows[0].cnt;
  }

  // 2. Uji tiap peran dengan RLS
  for (const { label, dbRole, claims } of ROLES_TO_TEST) {
    const spRole = 'sp_' + label.replace(/[^a-zA-Z0-9]/g, '_');
    await client.query('SAVEPOINT ' + spRole);

    // Set config jwt claims & role
    if (claims) {
      await client.query(
        "SELECT set_config('request.jwt.claims', $1, true)",
        [JSON.stringify(claims)]
      );
    }
    await client.query('SET LOCAL ROLE ' + dbRole);

    for (const table of tables) {
      const spTable = spRole + '_' + table;
      await client.query('SAVEPOINT ' + spTable);

      let visible = 0;
      let error = null;
      try {
        const res = await client.query('SELECT count(*)::int AS cnt FROM public.' + table);
        visible = res.rows[0].cnt;
        await client.query('RELEASE SAVEPOINT ' + spTable);
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT ' + spTable);
        error = err.code === '42501' ? '0 (akses ditolak / tidak di-grant)' : err.message;
      }

      results.push({
        peran: label,
        tabel: table,
        terlihat: error ? error : visible,
        total: totals[table],
      });
    }

    // Rollback ke savepoint peran untuk mereset role dan session context ke postgres
    await client.query('ROLLBACK TO SAVEPOINT ' + spRole);
  }

  await client.query('ROLLBACK');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Pengujian RLS gagal:', e.message);
  process.exit(1);
} finally {
  await client.end();
}

console.log('\n=== HASIL AUDIT BUKTI RLS LAPISAN DATABASE ===\n');
console.table(results);
