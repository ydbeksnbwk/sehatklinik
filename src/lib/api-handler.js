// Pembungkus Route Handler Next.js terpadu (K7, BR-04)
// Menangani ZodError (400 fields), HttpError, galat DB, dan 500 generik tanpa bocor SQL/stack.

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/auth";
import { logger } from "@/lib/logger";

function kodeDefault(status) {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL";
  }
}

export function handleApiError(err, label = "API Error", requestId = null) {
  const headers = requestId ? { "x-request-id": requestId } : {};

  // 1. ZodError -> 400 dengan error.fields
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path[0] !== undefined ? String(issue.path[0]) : "umum";
      if (!fields[key]) {
        fields[key] = issue.message;
      }
    }
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data tidak valid",
          fields,
        },
      },
      { status: 400, headers }
    );
  }

  // 2. HttpError -> status terdefinisi
  if (err instanceof HttpError) {
    const code = err.kode || kodeDefault(err.status);
    const errorBody = {
      code,
      message: err.message,
    };
    if (err.fields) {
      errorBody.fields = err.fields;
    }
    return NextResponse.json({ error: errorBody }, { status: err.status, headers });
  }

  // 3. PostgreSQL Database Constraints & Rules
  const code = err?.code || err?.cause?.code;
  if (code === "P0001") {
    const msg =
      err?.cause?.message ||
      err?.message ||
      "Aksi ditolak oleh aturan database";
    return NextResponse.json(
      { error: { code: "ATURAN_DATABASE_DITOLAK", message: msg } },
      { status: 409, headers }
    );
  }
  if (code === "23505") {
    return NextResponse.json(
      { error: { code: "DUPLIKAT", message: "Data bentrok dengan data yang sudah ada" } },
      { status: 409, headers }
    );
  }
  if (["23503", "23514", "22P02", "22007"].includes(code)) {
    return NextResponse.json(
      { error: { code: "DATA_TIDAK_VALID", message: "Data tidak valid" } },
      { status: 400, headers }
    );
  }

  // 4. Galat Tak Terduga -> 500 generik tanpa membocorkan SQL / stack trace ke client
  logger.error({
    msg: label,
    requestId,
    error: err?.message,
    code: err?.code,
    stack: err?.stack,
  });

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: "Terjadi kesalahan server",
      },
    },
    { status: 500, headers }
  );
}

/**
 * Higher-order function untuk membungkus Route Handler Next.js.
 * @param {Function} handler - Fungsi handler async (request, context)
 * @param {Object} options - Opsi { route: string }
 */
export function apiHandler(handler, { route } = {}) {
  return async (request, context) => {
    const requestId =
      request.headers.get("x-request-id") ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    const start = performance.now();
    const method = request?.method || "GET";
    const ruteLabel = route || request?.nextUrl?.pathname || request?.url || "API";

    try {
      const response = await handler(request, context);
      const durasi = Math.round(performance.now() - start);
      const status = response?.status || 200;

      if (response && response.headers && !response.headers.has("x-request-id")) {
        response.headers.set("x-request-id", requestId);
      }

      logger.info({
        requestId,
        rute: ruteLabel,
        metode: method,
        status,
        durasi: `${durasi}ms`,
      });

      return response;
    } catch (err) {
      const durasi = Math.round(performance.now() - start);
      const errResp = handleApiError(err, `${method} ${ruteLabel}`, requestId);

      logger.error({
        requestId,
        rute: ruteLabel,
        metode: method,
        status: errResp.status,
        durasi: `${durasi}ms`,
        error: err?.message,
      });

      return errResp;
    }
  };
}
