// src/lib/rate-limit.js
// Rate limiting untuk endpoint sensitif (login, register, kunjungan, push)
// Redis bila REDIS_URL tersedia, memori bila tidak, fail-open bila Redis galat (PRD §9)

import Redis from "ioredis";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export function ambilClientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}

// Memory store fallback
const memoryStore = new Map();

function cleanMemoryStore() {
  const now = Date.now();
  for (const [key, data] of memoryStore.entries()) {
    if (now > data.resetTime) {
      memoryStore.delete(key);
    }
  }
}

setInterval(cleanMemoryStore, 60000).unref?.();

// Lazy Redis client
let redisClient = null;
let lastRedisUrl = null;

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (redisClient && lastRedisUrl === redisUrl) {
    return redisClient;
  }

  try {
    lastRedisUrl = redisUrl;
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      retryStrategy() {
        return null; // Jangan retry terus-menerus jika koneksi gagal
      },
    });

    redisClient.on("error", (err) => {
      logger.warn({ msg: "Redis rate-limit error (fail-open aktif)", error: err?.message });
    });
  } catch (err) {
    logger.warn({ msg: "Gagal inisialisasi Redis client (fail-open aktif)", error: err?.message });
    return null;
  }

  return redisClient;
}

/**
 * Periksa rate limit untuk kunci tertentu.
 * @param {string} key - Identifier unik (mis. "login:ip:127.0.0.1")
 * @param {Object} options - { max: number, windowSeconds: number }
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfter: number }>}
 */
export async function checkRateLimit(key, { max = 10, windowSeconds = 60 } = {}) {
  const client = getRedisClient();

  // 1. Coba lewat Redis jika ada
  if (client) {
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.expire(redisKey, windowSeconds);
      }

      if (count > max) {
        const ttl = await client.ttl(redisKey);
        const retryAfter = Math.max(1, ttl > 0 ? ttl : windowSeconds);
        return { allowed: false, remaining: 0, retryAfter };
      }

      return { allowed: true, remaining: max - count, retryAfter: 0 };
    } catch (err) {
      // Fail-open bila Redis bermasalah
      logger.warn({
        msg: "Gagal memeriksa rate limit di Redis, beralih ke fail-open",
        key,
        error: err?.message,
      });
      return { allowed: true, remaining: max, retryAfter: 0 };
    }
  }

  // 2. Fallback memory store
  const now = Date.now();
  let record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowSeconds * 1000 };
    memoryStore.set(key, record);
    return { allowed: true, remaining: max - 1, retryAfter: 0 };
  }

  record.count++;

  if (record.count > max) {
    const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: max - record.count, retryAfter: 0 };
}

/**
 * Buat respons 429 Too Many Requests sesuai format PRD §8
 */
export function buildRateLimitResponse(retryAfter, max = 10) {
  return NextResponse.json(
    {
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Terlalu banyak permintaan, silakan coba lagi beberapa saat",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "x-ratelimit-limit": String(max),
        "x-ratelimit-remaining": "0",
      },
    }
  );
}
