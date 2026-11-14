// scripts/bersihkan-outbox.mjs
// Pembersihan Outbox Notifikasi & Langganan Uji Sebelum Deployment (PRD §10 Tahap 6)
// Menjaga tabel persisten tanpa menghapus baris (audit trail tetap terjaga)

import pg from "pg";

// 1. Guard Keamanan
if (process.env.SEED_ALLOW !== "1") {
  console.error("=================================================================");
  console.error("GALAT: SEED_ALLOW=1 wajib disetel untuk menjalankan pembersihan outbox.");
  console.error("Contoh: $env:SEED_ALLOW=\"1\"; node --env-file=.env.local scripts/bersihkan-outbox.mjs [--dry-run]");
  console.error("=================================================================");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("GALAT: DATABASE_URL tidak ditemukan di environment.");
  process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");
const includeToday = process.argv.includes("--include-today") || process.argv.includes("--all-pending");

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function samarkanUjungEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return "";
  try {
    const url = new URL(endpoint);
    const tail = url.pathname.slice(-12);
    return `${url.origin}/...${tail}`;
  } catch {
    return `...${endpoint.slice(-12)}`;
  }
}

async function main() {
  console.log("==========================================================");
  console.log(`  PEMBERSIHAN OUTBOX SEBELUM DEPLOYMENT [${isDryRun ? "MODE DRY-RUN" : "EKSEKUSI REAL"}]`);
  console.log("==========================================================");

  await client.connect();

  try {
    // -------------------------------------------------------------------------
    // A. REKAP STATUS SEBELUM
    // -------------------------------------------------------------------------
    const rekapSebelum = await client.query(`
      SELECT push_status, count(*) AS jumlah
      FROM notifikasi
      GROUP BY push_status
      ORDER BY push_status
    `);

    console.log("\n[1] REKAP PUSH_STATUS NOTIFIKASI SEBELUM:");
    console.table(rekapSebelum.rows);

    // -------------------------------------------------------------------------
    // B. TARGET NOTIFIKASI KEDALUWARSA / SISA UJI NON-SEED
    // -------------------------------------------------------------------------
    // 1. Kriteria > 1 hari (bukan milik seed)
    const targetOlderRes = await client.query(`
      SELECT id, pesan, created_at
      FROM notifikasi
      WHERE push_status = 'menunggu'
        AND id::text NOT LIKE 'c0000000-0000-0000-0000-00000000000%'
        AND created_at < NOW() - INTERVAL '1 day'
      ORDER BY created_at ASC
    `);

    // 2. Kriteria sisa uji non-seed hari ini (< 1 hari)
    const targetTodayRes = await client.query(`
      SELECT id, pesan, created_at
      FROM notifikasi
      WHERE push_status = 'menunggu'
        AND id::text NOT LIKE 'c0000000-0000-0000-0000-00000000000%'
        AND created_at >= NOW() - INTERVAL '1 day'
      ORDER BY created_at ASC
    `);

    console.log(`\n[2] PEMERIKSAAN OUTBOX NOTIFIKASI BERSTATUS 'menunggu' (NON-SEED):`);
    console.log(`    - Lebih tua dari 1 hari  : ${targetOlderRes.rows.length} baris`);
    console.log(`    - Sisa uji hari ini      : ${targetTodayRes.rows.length} baris`);

    // Tentukan target yang akan dieksekusi
    // Jika includeToday aktif (atau bila dipanggil tanpa dry-run untuk persiapan deploy), bersihkan seluruh non-seed
    const targetNotifRows = (includeToday || !isDryRun)
      ? [...targetOlderRes.rows, ...targetTodayRes.rows]
      : targetOlderRes.rows;

    console.log(`    -> Total target notifikasi yang akan ditandai 'gagal': ${targetNotifRows.length} baris`);

    // -------------------------------------------------------------------------
    // C. TARGET SUBSCRIPTION MOCK/UJI YANG AKAN DINONAKTIFKAN
    // -------------------------------------------------------------------------
    // Kriteria:
    // - aktif = true
    // - endpoint mock/uji (example.com, fcm seed, fcm uji-suite, atau user_agent mock/uji)
    const targetSubRes = await client.query(`
      SELECT id, profile_id, endpoint, user_agent
      FROM push_subscriptions
      WHERE aktif = true
        AND (
          endpoint LIKE '%example.com%'
          OR endpoint LIKE '%seed-%'
          OR endpoint LIKE '%uji-suite%'
          OR user_agent ILIKE '%mock%'
          OR user_agent ILIKE '%uji%'
        )
    `);

    console.log(`\n[3] TARGET PUSH SUBSCRIPTIONS MOCK/UJI AKTIF: ${targetSubRes.rows.length} baris`);
    if (targetSubRes.rows.length > 0) {
      console.table(
        targetSubRes.rows.map((r) => ({
          id: r.id,
          endpoint: samarkanUjungEndpoint(r.endpoint),
          user_agent: (r.user_agent || "").slice(0, 35),
        }))
      );
    }

    // -------------------------------------------------------------------------
    // D. EKSEKUSI (BILA BUKAN DRY-RUN)
    // -------------------------------------------------------------------------
    if (isDryRun) {
      console.log("\n[DRY-RUN SELESAI] Tidak ada data yang diubah di database.");
      console.log("Jalankan tanpa flag --dry-run untuk mengeksekusi pembaruan.");
    } else {
      console.log("\n[4] MENGEKSEKUSI PEMUTAKHIRAN DATA SECARA TRANSAKSIONAL...");
      await client.query("BEGIN");

      let updatedNotif = 0;
      if (targetNotifRows.length > 0) {
        const notifIds = targetNotifRows.map((r) => r.id);
        const updateRes = await client.query(
          `
          UPDATE notifikasi
          SET push_status = 'gagal',
              push_error = 'Dibersihkan sebelum deploy (data uji lama)',
              push_diproses_at = NOW()
          WHERE id = ANY($1::uuid[])
          `,
          [notifIds]
        );
        updatedNotif = updateRes.rowCount;
      }

      let updatedSubs = 0;
      if (targetSubRes.rows.length > 0) {
        const subIds = targetSubRes.rows.map((r) => r.id);
        const subRes = await client.query(
          `
          UPDATE push_subscriptions
          SET aktif = false
          WHERE id = ANY($1::uuid[])
          `,
          [subIds]
        );
        updatedSubs = subRes.rowCount;
      }

      await client.query("COMMIT");
      console.log(`-> Berhasil memperbarui ${updatedNotif} notifikasi outbox menjadi 'gagal'.`);
      console.log(`-> Berhasil menonaktifkan ${updatedSubs} langganan push mock/uji.`);

      // -----------------------------------------------------------------------
      // E. REKAP STATUS SESUDAH
      // -----------------------------------------------------------------------
      const rekapSesudah = await client.query(`
        SELECT push_status, count(*) AS jumlah
        FROM notifikasi
        GROUP BY push_status
        ORDER BY push_status
      `);

      console.log("\n[5] REKAP PUSH_STATUS NOTIFIKASI SESUDAH PEMBERSIHAN:");
      console.table(rekapSesudah.rows);

      // Daftar langganan yang masih aktif saat ini
      const aktifSubs = await client.query(`
        SELECT id, endpoint, user_agent, created_at
        FROM push_subscriptions
        WHERE aktif = true
        ORDER BY created_at DESC
      `);

      console.log(`\n[6] DAFTAR PUSH SUBSCRIPTIONS AKTIF SAAT INI (${aktifSubs.rows.length} langganan):`);
      if (aktifSubs.rows.length === 0) {
        console.log("    (Tidak ada langganan push aktif; aman sebelum deployment).");
      } else {
        console.table(
          aktifSubs.rows.map((r) => ({
            id: r.id,
            endpoint: samarkanUjungEndpoint(r.endpoint),
            user_agent: (r.user_agent || "").slice(0, 35),
            created_at: r.created_at.toISOString(),
          }))
        );
      }
    }

    console.log("\n==========================================================");
    console.log("Pembersihan outbox selesai.");
    console.log("==========================================================");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("GALAT FATAL:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
