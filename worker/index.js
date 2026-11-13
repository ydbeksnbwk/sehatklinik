import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import pg from "pg";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const webpush = require("web-push");

const { Pool } = pg;

// 1. Validasi Environment
const REDIS_URL = process.env.REDIS_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@sehatklinik.local";

if (!DATABASE_URL) {
  console.error("[Worker] FATAL: DATABASE_URL tidak ditemukan di env.");
  process.exit(1);
}

if (!REDIS_URL) {
  console.error("[Worker] FATAL: REDIS_URL tidak ditemukan di env.");
  process.exit(1);
}

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn(
    "[Worker] PERINGATAN: VAPID keys belum lengkap. Pengiriman push web mungkin gagal."
  );
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// 2. Koneksi Database & Redis
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production" || DATABASE_URL.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : false,
});

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const QUEUE_NAME = "notifikasi-push";
const notifQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

console.log(`[Worker] Menginisialisasi antrean BullMQ '${QUEUE_NAME}'...`);

// 3. Worker Processor
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { notifikasiId } = job.data;
    if (!notifikasiId) return;

    // Ambil detail notifikasi
    const notifRes = await pool.query(
      `SELECT id, profile_id, pesan, jenis_kejadian, tautan, push_status, push_percobaan
       FROM notifikasi
       WHERE id = $1`,
      [notifikasiId]
    );

    if (notifRes.rows.length === 0) {
      return { status: "not_found" };
    }

    const notif = notifRes.rows[0];
    if (notif.push_status === "berhasil") {
      return { status: "already_delivered" };
    }

    // Ambil langganan aktif pengguna
    const subRes = await pool.query(
      `SELECT id, endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE profile_id = $1 AND aktif = true`,
      [notif.profile_id]
    );

    if (subRes.rows.length === 0) {
      await pool.query(
        `UPDATE notifikasi
         SET push_status = 'gagal',
             push_error = 'Tidak ada langganan push aktif untuk profil ini',
             push_diproses_at = NOW()
         WHERE id = $1`,
        [notifikasiId]
      );
      return { status: "no_active_subscriptions" };
    }

    const payload = JSON.stringify({
      title: "Klinik Tim 7",
      body: notif.pesan,
      url: notif.tautan || "/pasien",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      data: {
        id: notif.id,
        url: notif.tautan || "/pasien",
        jenisKejadian: notif.jenis_kejadian,
      },
    });

    let adaBerhasil = false;
    let endpointExpiredCount = 0;
    let lastError = null;

    for (const sub of subRes.rows) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, payload, {
          TTL: 60 * 60 * 24, // 24 jam
        });

        adaBerhasil = true;
        await pool.query(
          `UPDATE push_subscriptions
           SET last_success_at = NOW()
           WHERE id = $1`,
          [sub.id]
        );
      } catch (err) {
        lastError = err;
        const statusCode = err.statusCode || err.status;

        // Jika endpoint sudah 404 (Not Found) atau 410 (Gone), nonaktifkan subscription
        if (statusCode === 404 || statusCode === 410) {
          endpointExpiredCount++;
          await pool.query(
            `UPDATE push_subscriptions
             SET aktif = false
             WHERE id = $1`,
            [sub.id]
          );
        } else {
          console.error(
            `[Worker] Gagal mengirim push ke sub ${sub.id}:`,
            err.message
          );
        }
      }
    }

    if (adaBerhasil) {
      await pool.query(
        `UPDATE notifikasi
         SET push_status = 'berhasil',
             push_error = NULL,
             push_diproses_at = NOW()
         WHERE id = $1`,
        [notifikasiId]
      );
      return { status: "success" };
    }

    if (endpointExpiredCount === subRes.rows.length) {
      await pool.query(
        `UPDATE notifikasi
         SET push_status = 'gagal',
             push_error = 'Semua langganan push browser telah kedaluwarsa (404/410)',
             push_diproses_at = NOW()
         WHERE id = $1`,
        [notifikasiId]
      );
      return { status: "all_expired" };
    }

    // Jika belum berhasil dan masih ada kesalahan sementara, lemparkan error agar BullMQ me-retry
    throw lastError || new Error("Gagal mengirim notifikasi push ke semua langganan");
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Event Listeners Worker
worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} selesai diproses.`);
});

worker.on("failed", async (job, err) => {
  console.error(`[Worker] Job ${job?.id} gagal:`, err.message);
  if (!job?.data?.notifikasiId) return;

  const notifikasiId = job.data.notifikasiId;
  const attemptsMade = job.attemptsMade || 1;
  const maxAttempts = job.opts?.attempts || 5;

  const isFinalFailure = attemptsMade >= maxAttempts;

  try {
    await pool.query(
      `UPDATE notifikasi
       SET push_percobaan = $1,
           push_error = $2,
           push_status = CASE WHEN $3 THEN 'gagal' ELSE push_status END,
           push_diproses_at = CASE WHEN $3 THEN NOW() ELSE push_diproses_at END
       WHERE id = $4`,
      [attemptsMade, err.message?.slice(0, 500), isFinalFailure, notifikasiId]
    );
  } catch (dbErr) {
    console.error("[Worker] Gagal mengupdate status kegagalan ke database:", dbErr);
  }
});

// 4. Scanner Poller (Outbox Scanner)
// Memindai baris notifikasi dengan push_status = 'menunggu' setiap 20 detik
async function scanPendingNotifications() {
  try {
    const res = await pool.query(
      `SELECT id, created_at
       FROM notifikasi
       WHERE push_status = 'menunggu'
       ORDER BY created_at ASC
       LIMIT 50`
    );

    for (const row of res.rows) {
      await notifQueue.add(
        "kirim-push",
        { notifikasiId: row.id },
        {
          jobId: String(row.id), // Mencegah duplikasi job jika sudah ada di antrean
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    }

    if (res.rows.length > 0) {
      console.log(`[Worker Scanner] Memasukkan ${res.rows.length} notifikasi ke antrean.`);
    }
  } catch (err) {
    console.error("[Worker Scanner] Terjadi galat saat memindai notifikasi:", err.message);
  }
}

// Jalankan scanner berkala
const SCAN_INTERVAL_MS = 20000;
console.log(`[Worker] Menjalankan poller scanner tiap ${SCAN_INTERVAL_MS / 1000} detik...`);
scanPendingNotifications();
const pollerInterval = setInterval(scanPendingNotifications, SCAN_INTERVAL_MS);

// 5. Graceful Shutdown
async function shutdown(signal) {
  console.log(`[Worker] Menerima sinyal ${signal}, mematikan worker secara tertib...`);
  clearInterval(pollerInterval);
  try {
    await worker.close();
    await notifQueue.close();
    await redisConnection.quit();
    await pool.end();
    console.log("[Worker] Pembersihan resource selesai. Keluar.");
    process.exit(0);
  } catch (err) {
    console.error("[Worker] Galat saat shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
