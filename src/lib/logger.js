// src/lib/logger.js
// Logger terstruktur Pino untuk sisi web (Route Handlers) dengan redaksi ketat data rahasia
// PRD §9 & K9

import pino from "pino";

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
      "SUPABASE_SERVICE_ROLE_KEY",
      "p256dh",
      "*.p256dh",
      "auth",
      "*.auth",
      "sub.p256dh",
      "sub.auth",
      "keys.p256dh",
      "keys.auth",
    ],
    censor: "[REDACTED]",
  },
});
