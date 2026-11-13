import { Queue, Worker, UnrecoverableError } from "bullmq";
import { Redis } from "ioredis";
import pg from "pg";
import webpush from "web-push";
import pino from "pino";

const { Pool } = pg;

// 1. Inisialisasi Logger Terstruktur Pino dengan Redaksi Data Sensitif
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "privateKey",
      "*.privateKey",
      "private_key",
      "*.private_key",
      "VAPID_PRIVATE_KEY",
      "DATABASE_URL",
      "REDIS_URL",
      "sub.p256dh",
      "sub.auth",
      "keys.p256dh",
      "keys.auth",
      "p256dh",
      "auth",
    ],
    censor: "[REDACTED]",
  },
});

export function samarkanEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return "";
  try {
    const parsed = new URL(endpoint);
    const tail = parsed.pathname.slice(-8);
    return `${parsed.host}/...${tail}`;
  } catch {
    return endpoint.slice(-8);
  }
}

// 2. Validasi Environment
const REDIS_URL = process.env.REDIS_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@sehatklinik.local";

if (!DATABASE_URL) {
  logger.fatal({ message: "DATABASE_URL tidak ditemukan di environment. Worker berhenti." });
  process.exit(1);
}

if (!REDIS_URL) {
  logger.fatal({ message: "REDIS_URL tidak ditemukan di environment. Worker berhenti." });
  process.exit(1);
}

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  logger.fatal({
    message: "Kunci VAPID tidak lengkap (VAPID_PUBLIC_KEY atau VAPID_PRIVATE_KEY kosong). Worker berhenti.",
  });
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// 3. Pool Database & Koneksi Redis
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

logger.info({ message: `Inisialisasi antrean BullMQ '${QUEUE_NAME}' berhasil.` });

// 4. Worker Processor
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const startTime = Date.now();
    const { notifikasiId } = job.data;
    if (!notifikasiId) return { status: "empty_payload" };

    // Anti-ganda atomik: klaim baris dengan satu UPDATE bersyarat
    // Hanya proses baris yang berstatus 'menunggu'
    const claimRes = await pool.query(
      `UPDATE notifikasi
       SET push_diproses_at = NOW()
       WHERE id = $1 AND push_status = 'menunggu'
       RETURNING id, profile_id, pesan, jenis_kejadian, tautan, push_status, push_percobaan`,
      [notifikasiId]
    );

    if (claimRes.rows.length === 0) {
      logger.info({
        notifikasiId,
        statusJob: "skipped",
        durasiMs: Date.now() - startTime,
        message: "Notifikasi sudah diproses atau tidak berstatus 'menunggu'.",
      });
      return { status: "already_processed_or_not_found" };
    }

    const notif = claimRes.rows[0];

    // Ambil subscription aktif milik pengguna
    const subRes = await pool.query(
      `SELECT id, endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE profile_id = $1 AND aktif = true`,
      [notif.profile_id]
    );

    if (subRes.rows.length === 0) {
      const durasiMs = Date.now() - startTime;
      await pool.query(
        `UPDATE notifikasi
         SET push_status = 'gagal',
             push_error = 'Tidak ada langganan push aktif untuk profil ini',
             push_diproses_at = NOW()
         WHERE id = $1`,
        [notifikasiId]
      );
      logger.warn({
        notifikasiId,
        statusJob: "failed",
        alasan: "no_active_subscriptions",
        durasiMs,
        jumlahPercobaan: job.attemptsMade + 1,
      });
      return { status: "no_active_subscriptions" };
    }

    // Payload JSON memuat judul, pesan, tautan (serta title, body, url untuk kompatibilitas)
    const payload = JSON.stringify({
      judul: "Klinik Tim 7",
      pesan: notif.pesan,
      tautan: notif.tautan || "/pasien",
      title: "Klinik Tim 7",
      body: notif.pesan,
      url: notif.tautan || "/pasien",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      data: {
        id: notif.id,
        url: notif.tautan || "/pasien",
        tautan: notif.tautan || "/pasien",
        jenisKejadian: notif.jenis_kejadian,
      },
    });

    let adaBerhasil = false;
    let endpointExpiredCount = 0;
    let lastPermanentError = null;
    let lastTransientError = null;

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
        logger.info({
          notifikasiId,
          subId: sub.id,
          endpoint: samarkanEndpoint(sub.endpoint),
          status: 201,
          message: "Web push berhasil terkirim ke subscription.",
        });
      } catch (err) {
        const statusCode = err.statusCode || err.status;
        const endpointSamar = samarkanEndpoint(sub.endpoint);

        // 404/410 -> Subscription kedaluwarsa, nonaktifkan permanen tanpa retry
        if (statusCode === 404 || statusCode === 410) {
          endpointExpiredCount++;
          await pool.query(
            `UPDATE push_subscriptions
             SET aktif = false
             WHERE id = $1`,
            [sub.id]
          );
          logger.warn({
            notifikasiId,
            subId: sub.id,
            endpoint: endpointSamar,
            statusCode,
            message: "Subscription kedaluwarsa (404/410), dinonaktifkan.",
          });
        } else if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
          // 400/401/403 -> Gagal permanen TANPA retry
          lastPermanentError = err;
          logger.error({
            notifikasiId,
            subId: sub.id,
            endpoint: endpointSamar,
            statusCode,
            err: err.message,
            message: "Gagal permanen (400/401/403) dari push service.",
          });
        } else {
          // 429 / 5xx / timeout / network error -> Retry sementara
          lastTransientError = err;
          logger.warn({
            notifikasiId,
            subId: sub.id,
            endpoint: endpointSamar,
            statusCode: statusCode || "unknown",
            err: err.message,
            message: "Galat sementara saat kirim web push, akan dicoba ulang.",
          });
        }
      }
    }

    const durasiMs = Date.now() - startTime;

    // Jika setidaknya satu subscription berhasil
    if (adaBerhasil) {
      await pool.query(
        `UPDATE notifikasi
         SET push_status = 'berhasil',
             push_error = NULL,
             push_diproses_at = NOW()
         WHERE id = $1`,
        [notifikasiId]
      );
      logger.info({
        notifikasiId,
        statusJob: "berhasil",
        durasiMs,
        jumlahPercobaan: job.attemptsMade + 1,
      });
      return { status: "success" };
    }

    // Jika semua subscription sudah kedaluwarsa (404/410)
    if (endpointExpiredCount === subRes.rows.length) {
      await pool.query(
        `UPDATE notifikasi
         SET push_status = 'gagal',
             push_error = 'Semua langganan push browser telah kedaluwarsa (404/410)',
             push_diproses_at = NOW()
         WHERE id = $1`,
        [notifikasiId]
      );
      logger.warn({
        notifikasiId,
        statusJob: "failed_all_expired",
        durasiMs,
        jumlahPercobaan: job.attemptsMade + 1,
      });
      return { status: "all_expired" };
    }

    // Jika terjadi galat permanen 400/401/403 tanpa ada galat transient
    if (lastPermanentError && !lastTransientError) {
      await pool.query(
        `UPDATE notifikasi
         SET push_status = 'gagal',
             push_error = $1,
             push_diproses_at = NOW()
         WHERE id = $2`,
        [(lastPermanentError.message || "Gagal permanen").slice(0, 500), notifikasiId]
      );
      logger.error({
        notifikasiId,
        statusJob: "failed_unrecoverable",
        durasiMs,
        jumlahPercobaan: job.attemptsMade + 1,
        err: lastPermanentError.message,
      });
      throw new UnrecoverableError(lastPermanentError.message);
    }

    // Jika terjadi galat sementara (429/5xx/timeout) -> lemparkan agar BullMQ me-retry
    const errToThrow = lastTransientError || lastPermanentError || new Error("Gagal mengirim push ke seluruh endpoint");
    throw errToThrow;
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Event Listeners Worker
worker.on("completed", (job) => {
  logger.info({
    jobId: job.id,
    notifikasiId: job.data?.notifikasiId,
    statusJob: "completed",
    durasiMs: job.processedOn ? Date.now() - job.processedOn : undefined,
    jumlahPercobaan: job.attemptsMade,
  });
});

worker.on("failed", async (job, err) => {
  const notifikasiId = job?.data?.notifikasiId;
  const attemptsMade = (job?.attemptsMade || 0) + 1;
  const maxAttempts = job?.opts?.attempts || 5;
  const isFinalFailure = attemptsMade >= maxAttempts || err instanceof UnrecoverableError;

  logger.error({
    jobId: job?.id,
    notifikasiId,
    statusJob: isFinalFailure ? "failed_final" : "failed_retry",
    durasiMs: job?.processedOn ? Date.now() - job.processedOn : undefined,
    jumlahPercobaan: attemptsMade,
    err: err.message,
  });

  if (!notifikasiId) return;

  try {
    await pool.query(
      `UPDATE notifikasi
       SET push_percobaan = $1,
           push_error = $2,
           push_status = CASE WHEN $3 THEN 'gagal' ELSE push_status END,
           push_diproses_at = CASE WHEN $3 THEN NOW() ELSE push_diproses_at END
       WHERE id = $4`,
      [attemptsMade, (err.message || "").slice(0, 500), isFinalFailure, notifikasiId]
    );
  } catch (dbErr) {
    logger.error({
      notifikasiId,
      errorDb: dbErr.message,
      message: "Gagal memperbarui status kegagalan ke database",
    });
  }
});

// 5. Scanner Poller (Outbox Scanner)
// Memindai baris notifikasi dengan push_status = 'menunggu' setiap 30 detik (PRD §7.1 & §7.4)
export async function scanPendingNotifications() {
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
          jobId: String(row.id), // Idempoten: Mencegah duplikasi job di antrean
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
      logger.info({
        jumlah: res.rows.length,
        message: `[Scanner] Memasukkan ${res.rows.length} notifikasi ke antrean BullMQ.`,
      });
    }
  } catch (err) {
    logger.error({
      err: err.message,
      message: "[Scanner] Galat saat memindai notifikasi menunggu",
    });
  }
}

// Jalankan scanner saat startup lalu berkala setiap 30 detik
const SCAN_INTERVAL_MS = 30000;
logger.info({
  intervalDetik: SCAN_INTERVAL_MS / 1000,
  message: `Menjalankan poller scanner tiap ${SCAN_INTERVAL_MS / 1000} detik...`,
});
scanPendingNotifications();
const pollerInterval = setInterval(scanPendingNotifications, SCAN_INTERVAL_MS);

// 6. Graceful Shutdown (SIGINT & SIGTERM)
let isShuttingDown = false;
export async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal, message: `Menerima sinyal ${signal}, menutup worker secara tertib...` });
  clearInterval(pollerInterval);
  try {
    await worker.close();
    await notifQueue.close();
    await redisConnection.quit();
    await pool.end();
    logger.info({ message: "Pembersihan resource worker selesai. Keluar 0." });
    process.exit(0);
  } catch (err) {
    logger.error({ err: err.message, message: "Galat saat shutdown worker" });
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
