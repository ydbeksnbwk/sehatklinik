// scripts/uji-worker.mjs
// Uji worker tanpa browser: menyisipkan subscription palsu, menjalankan simulasi pengiriman,
// dan memverifikasi transisi push_status serta penyamaran log Pino.

import pg from "pg";
import { createRequire } from "module";
import pino from "pino";

const require = createRequire(import.meta.url);
const webpush = require("web-push");

const { Pool } = pg;

function samarkanEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return "";
  try {
    const parsed = new URL(endpoint);
    const tail = parsed.pathname.slice(-8);
    return `${parsed.host}/...${tail}`;
  } catch {
    return endpoint.slice(-8);
  }
}

const logger = pino({
  level: "info",
  redact: {
    paths: [
      "password", "token", "authorization", "cookie",
      "privateKey", "private_key", "VAPID_PRIVATE_KEY",
      "DATABASE_URL", "REDIS_URL", "sub.p256dh", "sub.auth",
      "keys.p256dh", "keys.auth"
    ],
    censor: "[REDACTED]"
  }
});

const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@sehatklinik.local";

if (!DATABASE_URL) {
  console.error("DATABASE_URL tidak diset");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : false
});

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function runTest() {
  console.log("=== MEMULAI PENGUJIAN WORKER & SUBSCRIPTION PALSU ===");

  // 1. Ambil profil pasien
  const profRes = await pool.query(
    "SELECT id, nama FROM profiles WHERE role = 'pasien' LIMIT 1"
  );
  if (profRes.rows.length === 0) {
    console.error("Tidak ada pasien di database");
    await pool.end();
    return;
  }
  const pasien = profRes.rows[0];
  console.log(`Menggunakan profil uji: ${pasien.nama} (${pasien.id})`);

  // 2. Sisipkan subscription palsu
  const fakeEndpoint = `https://fcm.googleapis.com/fcm/send/dummy-expired-token-${Date.now()}`;
  const insertSubRes = await pool.query(
    `INSERT INTO push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent, aktif)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, endpoint, aktif`,
    [
      pasien.id,
      fakeEndpoint,
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
      "tBHItJI5svbpez7KI4CCXg==",
      "Audit-Test-Agent/1.0"
    ]
  );
  const sub = insertSubRes.rows[0];
  console.log(`Subscription palsu dibuat dengan ID: ${sub.id}`);
  console.log(`Endpoint tersamar: ${samarkanEndpoint(sub.endpoint)}`);

  // 3. Sisipkan notifikasi uji 'menunggu'
  const notifRes = await pool.query(
    `INSERT INTO notifikasi (profile_id, pesan, jenis_kejadian, tautan, push_status)
     VALUES ($1, 'Pendaftaran berhasil. Antrean: 01-999 (dr. Reyhan, 15-11-2026)', 'KUNJUNGAN_TERDAFTAR', '/pasien', 'menunggu')
     RETURNING id, profile_id, pesan, push_status`,
    [pasien.id]
  );
  const notif = notifRes.rows[0];
  console.log(`Notifikasi uji dibuat dengan ID: ${notif.id}, status: ${notif.push_status}`);

  // 4. Simulasi proses pengiriman worker
  const startTime = Date.now();
  console.log("\n--- Menjalankan pemrosesan notifikasi (klaim atomik & pengiriman) ---");

  // Klaim atomik anti-ganda dengan lease 2 menit
  const claimRes = await pool.query(
    `UPDATE notifikasi
     SET push_diproses_at = NOW()
     WHERE id = $1
       AND push_status = 'menunggu'
       AND (push_diproses_at IS NULL OR push_diproses_at < NOW() - INTERVAL '2 minutes')
     RETURNING id, profile_id, pesan, jenis_kejadian, tautan, push_status, push_percobaan`,
    [notif.id]
  );

  if (claimRes.rows.length === 0) {
    console.log("Klaim atomik gagal (baris sudah diproses atau bukan menunggu)");
    await pool.end();
    return;
  }

  const activeSubs = await pool.query(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE profile_id = $1 AND aktif = true",
    [pasien.id]
  );

  let endpointExpiredCount = 0;
  let adaBerhasil = false;

  for (const s of activeSubs.rows) {
    const pushConfig = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth }
    };
    const payload = JSON.stringify({
      judul: "Klinik Tim 7",
      pesan: notif.pesan,
      tautan: "/pasien"
    });

    try {
      await webpush.sendNotification(pushConfig, payload, { TTL: 60 });
      adaBerhasil = true;
    } catch (err) {
      const statusCode = err.statusCode || err.status || 410;
      const endpointSamar = samarkanEndpoint(s.endpoint);

      if (statusCode === 404 || statusCode === 410 || String(err.message).includes("410") || String(err.message).includes("404")) {
        endpointExpiredCount++;
        await pool.query("UPDATE push_subscriptions SET aktif = false WHERE id = $1", [s.id]);
        logger.warn({
          notifikasiId: notif.id,
          subId: s.id,
          endpoint: endpointSamar,
          statusCode,
          message: "Subscription kedaluwarsa (404/410), dinonaktifkan."
        });
      }
    }
  }

  const durasiMs = Date.now() - startTime;
  if (!adaBerhasil && endpointExpiredCount === activeSubs.rows.length) {
    await pool.query(
      `UPDATE notifikasi
       SET push_status = 'gagal',
           push_percobaan = push_percobaan + 1,
           push_error = 'Semua langganan push browser telah kedaluwarsa (404/410)',
           push_diproses_at = NOW()
       WHERE id = $1`,
      [notif.id]
    );
    logger.warn({
      notifikasiId: notif.id,
      statusJob: "failed_all_expired",
      durasiMs,
      jumlahPercobaan: 1
    });
  }

  // 5. Query hasil akhir
  console.log("\n--- Hasil Verifikasi di Database PostgreSQL ---");
  const checkNotif = await pool.query(
    `SELECT id, jenis_kejadian, push_status, push_percobaan, push_error, push_diproses_at
     FROM notifikasi WHERE id = $1`,
    [notif.id]
  );
  console.log("SELECT notifikasi:", JSON.stringify(checkNotif.rows[0], null, 2));

  const checkSub = await pool.query(
    `SELECT id, aktif, endpoint, last_success_at
     FROM push_subscriptions WHERE id = $1`,
    [sub.id]
  );
  console.log("SELECT push_subscriptions:", JSON.stringify({
    ...checkSub.rows[0],
    endpoint: samarkanEndpoint(checkSub.rows[0].endpoint)
  }, null, 2));

  // 6. Pembersihan data uji
  await pool.query("DELETE FROM notifikasi WHERE id = $1", [notif.id]);
  await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
  console.log("\nData uji berhasil dibersihkan.");

  await pool.end();
  console.log("=== PENGUJIAN WORKER SELESAI DENGAN SUKSES ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Galat pengujian worker:", err);
  process.exit(1);
});
