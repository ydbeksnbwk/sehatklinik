// src/lib/push-queue.js
// BullMQ queue producer untuk notifikasi Web Push
// Dibungkus aman agar jika Redis offline/mati, transaksi bisnis tetap berjalan sukses

import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@/db";
import { notifikasi } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: ["REDIS_URL", "DATABASE_URL", "password", "token"],
    censor: "[REDACTED]",
  },
});

let notifQueue = null;

function getQueue() {
  if (notifQueue) return notifQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1, // Cepat fail-open bila Redis offline
      connectTimeout: 2000,
      enableReadyCheck: false,
    });

    redis.on("error", (err) => {
      logger.warn({ message: "Peringatan koneksi Redis queue:", err: err.message });
    });

    notifQueue = new Queue("notifikasi-push", {
      connection: redis,
    });
    return notifQueue;
  } catch (err) {
    logger.warn({ message: "Gagal menginisialisasi BullMQ Queue:", err: err.message });
    return null;
  }
}

/**
 * Enqueue satu notifikasi ke antrean BullMQ.
 * Dibungkus try/catch agar kegagalan push tidak menggagalkan transaksi bisnis (PRD §7.1).
 */
export async function enqueuePushNotification(notifikasiId) {
  try {
    const queue = getQueue();
    if (!queue) return false;

    await queue.add(
      "kirim-push",
      { notifikasiId },
      {
        jobId: String(notifikasiId),
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    return true;
  } catch (err) {
    logger.warn({
      notifikasiId,
      err: err.message,
      message: "Gagal enqueue job ke BullMQ (Redis mati / offline). Pemindai outbox worker akan memproses.",
    });
    return false;
  }
}

/**
 * Enqueue notifikasi berstatus 'menunggu' yang baru saja dibuat.
 * Dipanggil setelah transaksi pendaftaran atau transisi kunjungan selesai di-commit.
 */
export async function enqueuePendingNotificationsForProfile(profileId) {
  try {
    const rows = await db
      .select({ id: notifikasi.id })
      .from(notifikasi)
      .where(eq(notifikasi.pushStatus, "menunggu"))
      .orderBy(desc(notifikasi.createdAt))
      .limit(5);

    for (const row of rows) {
      await enqueuePushNotification(row.id);
    }
  } catch (err) {
    logger.warn({
      err: err.message,
      message: "Gagal mencari baris notifikasi untuk enqueue BullMQ (non-fatal).",
    });
  }
}
