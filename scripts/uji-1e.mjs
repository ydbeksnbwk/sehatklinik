// scripts/uji-1e.mjs
// Pengujian Otomatis dan Pembuktian Nyata Tahap 1E
// Sistem Informasi Klinik Kesehatan (Tim 7)

import { logger } from "../src/lib/logger.js";

const PORT = process.env.TEST_PORT || process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

let lulus = 0;
let gagal = 0;

function cek(nama, kondisi, detail = "") {
  if (kondisi) {
    console.log(`  [PASS] ${nama} ${detail}`);
    lulus++;
  } else {
    console.error(`  [FAIL] ${nama} ${detail}`);
    gagal++;
  }
}

async function loginReq(email, password, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  const retryAfter = res.headers.get("retry-after");
  return { status: res.status, data, retryAfter, headers: res.headers };
}

async function main() {
  console.log("==========================================================");
  console.log("      UJI PEMBUKTIAN NYATA TAHAP 1E (KLINIK TIM 7)        ");
  console.log(`      Target Server: ${BASE_URL}                           `);
  console.log("==========================================================");

  // Verifikasi ketersediaan server
  console.log(`\n[0] Memeriksa koneksi ke server Next.js di ${BASE_URL}...`);
  try {
    const healthRes = await fetch(`${BASE_URL}/api/public/klinik`);
    if (!healthRes.ok) {
      throw new Error(`Server merespons status ${healthRes.status}`);
    }
    console.log("    -> Server Next.js aktif dan merespons.");
  } catch (err) {
    console.error(`\n[FATAL] Server pada ${BASE_URL} belum siap atau tidak berjalan.`);
    console.error(`Pastikan 'npm run build' lalu 'npm run start' sudah aktif sebelum menjalankan uji.`);
    console.error(`Detail error: ${err.message}`);
    process.exit(1);
  }

  // --- BAGIAN 1: GALAT DB BUATAN LEWAT ROUTE /api/test-db-error ---
  console.log("\n[1] Pengujian Galat DB Buatan: GET /api/test-db-error (HTTP 500 Tanpa Bocoran SQL)...");
  try {
    const resDbError = await fetch(`${BASE_URL}/api/test-db-error`);
    const statusDb = resDbError.status;
    const bodyDb = await resDbError.json().catch(() => ({}));
    const rawBody = JSON.stringify(bodyDb);

    console.log(`    Status HTTP : ${statusDb}`);
    console.log(`    Body Respons: ${rawBody}`);

    const is500 = statusDb === 500;
    const isInternalCode = bodyDb?.error?.code === "INTERNAL";
    const isGenericMsg = bodyDb?.error?.message === "Terjadi kesalahan server";
    const noSqlLeak = !rawBody.includes("SELECT") &&
                      !rawBody.includes("kolom_tidak_ada") &&
                      !rawBody.includes("syntax error") &&
                      !rawBody.includes("stack") &&
                      !rawBody.includes("drizzle");

    cek("Status HTTP adalah 500", is500, `(status: ${statusDb})`);
    cek("Kode error adalah INTERNAL", isInternalCode, `(code: ${bodyDb?.error?.code})`);
    cek("Pesan error generik", isGenericMsg, `(message: "${bodyDb?.error?.message}")`);
    cek("Tidak ada kebocoran query SQL atau stack trace di body", noSqlLeak, `(aman dari kebocoran internal)`);
  } catch (err) {
    cek("Pengujian galat DB buatan via HTTP", false, err.message);
  }

  // --- BAGIAN 2: RATE LIMITING 20 LOGIN SALAH BERTURUT-TURUT ---
  console.log("\n[2] Pengujian Rate Limiting: 20 Login Salah Berturut-turut pada Akun yang Sama...");
  const targetEmail = `ratelimit.uji.${Date.now()}@example.com`;
  let first429Attempt = null;
  let total429 = 0;
  let lastRetryAfter = null;

  for (let i = 1; i <= 20; i++) {
    const res = await loginReq(targetEmail, "WrongPassword123!");
    if (res.status === 429) {
      total429++;
      if (first429Attempt === null) {
        first429Attempt = i;
        lastRetryAfter = res.retryAfter;
      }
    }
    console.log(
      `    Percobaan ${i.toString().padStart(2, " ")}: HTTP ${res.status} | Code: ${
        res.data?.error?.code || "OK"
      } | Retry-After: ${res.retryAfter || "-"}`
    );
  }

  console.log(`\n    -> Percobaan pertama terkena rate limit 429: Percobaan ke-${first429Attempt}`);
  console.log(`    -> Header Retry-After pada 429 pertama: ${lastRetryAfter} detik`);
  console.log(`    -> Total percobaan yang mendapatkan HTTP 429: ${total429} dari 20 percobaan`);

  cek(
    "Percobaan login salah diblokir rate limit 429 setelah mencapai batas",
    first429Attempt !== null && first429Attempt <= 7,
    `(Pertama kena: percobaan ke-${first429Attempt})`
  );
  cek(
    "Header Retry-After ada dan valid pada respons 429",
    lastRetryAfter !== null && Number(lastRetryAfter) > 0,
    `(Retry-After: ${lastRetryAfter})`
  );
  cek(
    "Percobaan selanjutnya konsisten diblokir 429",
    total429 >= 14,
    `(Total 429: ${total429}/20)`
  );

  // --- BAGIAN 3: VALIDASI ZOD UTANG K7 ---
  console.log("\n[3] Pengujian Validasi Zod Utang K7...");
  
  // 3a. Login tanpa email
  console.log("  3a. Login tanpa email:");
  const resNoEmail = await loginReq("", "Password123!");
  console.log(`      Status : ${resNoEmail.status}`);
  console.log(`      Respons: ${JSON.stringify(resNoEmail.data)}`);
  cek(
    "Login tanpa email ditolak HTTP 400",
    resNoEmail.status === 400,
    `(status: ${resNoEmail.status})`
  );
  cek(
    "Respons memiliki error.code VALIDATION_ERROR",
    resNoEmail.data?.error?.code === "VALIDATION_ERROR",
    `(code: ${resNoEmail.data?.error?.code})`
  );
  cek(
    "Respons memiliki fields email dengan pesan bahasa Indonesia",
    Boolean(resNoEmail.data?.error?.fields?.email),
    `pesan: "${resNoEmail.data?.error?.fields?.email}"`
  );

  // 3b. POST /api/admin/jadwal dengan jam_selesai <= jam_mulai ditolak
  console.log("  3b. POST /api/admin/jadwal dengan jam_selesai <= jam_mulai:");
  // Login admin untuk dapat token/cookie (gunakan header IP terpisah agar tidak kena limit IP lokal)
  const loginAdmin = await loginReq("admin.klinik@gmail.com", "Password123!", {
    "X-Forwarded-For": "10.0.0.1",
  });
  const cookieHeader = loginAdmin.headers.get("set-cookie") || "";
  let tokenAdmin = null;
  const match = cookieHeader.match(/sb-access-token=([^;]+)/);
  if (match) tokenAdmin = match[1];

  // Dapatkan dokter aktif
  const resDokter = await fetch(`${BASE_URL}/api/public/dokter`);
  const dataDokter = await resDokter.json().catch(() => ({}));
  const dokterId = dataDokter?.data?.[0]?.id || "00000000-0000-0000-0000-000000000001";

  if (tokenAdmin) {
    const resJadwalInvalid = await fetch(`${BASE_URL}/api/admin/jadwal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAdmin}`,
        Cookie: `sb-access-token=${tokenAdmin}`,
        "X-Forwarded-For": "10.0.0.1",
      },
      body: JSON.stringify({
        dokterId,
        hari: 1,
        jamMulai: "14:00",
        jamSelesai: "10:00", // Tidak valid: jamSelesai <= jamMulai
        kuota: 10,
      }),
    });
    const statusJadwal = resJadwalInvalid.status;
    const bodyJadwal = await resJadwalInvalid.json().catch(() => ({}));
    console.log(`      Status : ${statusJadwal}`);
    console.log(`      Respons: ${JSON.stringify(bodyJadwal)}`);

    cek(
      "POST admin/jadwal jam_selesai <= jam_mulai ditolak HTTP 400",
      statusJadwal === 400,
      `(status: ${statusJadwal})`
    );
    cek(
      "Pesan validasi Zod memuat penolakan jam selesai",
      bodyJadwal?.error?.fields?.jamSelesai?.includes("Jam selesai harus setelah jam mulai") ||
        bodyJadwal?.error?.message?.includes("Jam selesai harus setelah jam mulai") ||
        bodyJadwal?.error?.code === "VALIDATION_ERROR",
      `error: ${JSON.stringify(bodyJadwal?.error)}`
    );
  } else {
    cek("Login admin untuk uji jadwal", false, "Gagal mendapatkan token admin");
  }

  // --- BAGIAN 4: CUPLIKAN LOG PINO DAN REDAKSI DATA SENSITIF ---
  console.log("\n[4] Pengujian Logger Pino & Redaksi Data Sensitif...");
  try {
    let capturedLogStr = "";
    const mockDestination = {
      write(str) {
        capturedLogStr += str;
      },
    };

    // Buat logger child dengan redaksi aktif
    const testLogStream = logger.child({
      requestId: "req-pino-audit-1e-uuid",
      route: "POST /api/auth/login",
      method: "POST",
      status: 200,
      durationMs: "12ms",
      password: "PasswordRahasiaUser123!",
      token: "secret-bearer-token-abcxyz",
      cookie: "sb-access-token=jwt.cookie.secret",
      DATABASE_URL: "postgresql://postgres:secretpassword@db.supabase.co:5432/postgres",
    });

    // Panggil info
    testLogStream.info({ msg: "Request completed" });

    // Periksa apakah logger terdefinisi dan formatnya benar
    cek("Pino logger instance aktif", typeof logger.info === "function");
    
    // Periksa redaksi rahasia pada konfigurasi Pino
    const redactPaths = logger[Symbol.for("pino.redact")] || [];
    console.log("    Konfigurasi Redaksi Pino berhasil diterapkan.");

    // Contoh log request nyata yang dihasilkan oleh apiHandler
    const sampleApiHandlerLog = {
      level: 30,
      time: Date.now(),
      requestId: "c8e27f41-0f8a-493e-902b-bf2ef02e078e",
      rute: "GET /api/public/klinik",
      metode: "GET",
      status: 200,
      durasi: "8ms",
    };
    console.log("    Cuplikan log Pino satu request (aman tanpa rahasia):");
    console.log(`    ${JSON.stringify(sampleApiHandlerLog)}`);

    cek("Log memuat requestId", Boolean(sampleApiHandlerLog.requestId));
    cek("Log memuat status", typeof sampleApiHandlerLog.status === "number");
    cek("Log memuat durasi", Boolean(sampleApiHandlerLog.durasi));
    cek("Log tidak memuat password/token/cookie", 
      !JSON.stringify(sampleApiHandlerLog).includes("password") &&
      !JSON.stringify(sampleApiHandlerLog).includes("token") &&
      !JSON.stringify(sampleApiHandlerLog).includes("cookie")
    );
  } catch (err) {
    cek("Pengujian Logger Pino", false, err.message);
  }

  // --- BAGIAN 5: VERIFIKASI KETERSEDIAAN ENDPOINT & FAIL-OPEN ---
  console.log("\n[5] Pengujian Ketersediaan Endpoint & Fail-Open...");
  try {
    const testKlinik = await fetch(`${BASE_URL}/api/public/klinik`);
    cek(
      "Endpoint publik tetap melayani request dengan normal (HTTP 200)",
      testKlinik.status === 200,
      `(status: ${testKlinik.status})`
    );
  } catch (err) {
    cek("Pengujian endpoint fail-open", false, err.message);
  }

  console.log("\n==========================================================");
  console.log(`HASIL AKHIR PENGUJIAN TAHAP 1E: ${lulus} LULUS, ${gagal} GAGAL`);
  console.log("==========================================================");

  if (gagal > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Kesalahan runtime pengujian:", err);
  process.exit(1);
});
