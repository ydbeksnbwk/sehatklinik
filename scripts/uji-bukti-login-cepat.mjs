// scripts/uji-bukti-login-cepat.mjs
// Verifikasi Bukti Otomatis Fitur Login Cepat Demo

const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== PENGUJIAN VERIFIKASI BUKTI LOGIN CEPAT DEMO ===\n");

  const perans = ["pasien", "petugas", "dokter", "admin"];
  let allPassed = true;

  // 1. Tiap Peran -> 200, Set-Cookie HttpOnly, GET /api/auth/me menunjukkan peran benar
  console.log("1. Uji Autentikasi Tiap Peran:");
  for (const peran of perans) {
    const res = await fetch(`${BASE_URL}/api/auth/login-cepat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peran }),
    });

    const status = res.status;
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
    const accessCookie = cookies.find((c) => c.includes("sb-access-token="));
    const isHttpOnly = accessCookie ? /HttpOnly/i.test(accessCookie) : false;

    // Ambil session cookie untuk request /api/auth/me
    const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

    let meRole = "";
    if (accessCookie) {
      const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Cookie: cookieHeader },
      });
      const meBody = await meRes.json().catch(() => ({}));
      meRole = meBody.data?.role || "";
    }

    const passed = status === 200 && isHttpOnly && meRole === peran;
    if (!passed) allPassed = false;

    console.log(
      `   [${peran.toUpperCase()}] HTTP Status: ${status} | Set-Cookie HttpOnly: ${isHttpOnly} | GET /api/auth/me Role: "${meRole}" -> ${passed ? "PASS ✓" : "FAIL ✗"}`
    );
  }

  // 2. Peran tidak valid -> 400 Bad Request
  console.log("\n2. Uji Peran Tidak Valid (Zod validation):");
  const invalidRes = await fetch(`${BASE_URL}/api/auth/login-cepat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peran: "superadmin" }),
  });
  const invalidBody = await invalidRes.json().catch(() => ({}));
  const invalidPassed = invalidRes.status === 400 && invalidBody.error?.code === "VALIDATION_ERROR";
  if (!invalidPassed) allPassed = false;
  console.log(
    `   Payload: { peran: "superadmin" } -> Status: ${invalidRes.status} | Error Code: ${invalidBody.error?.code} | Pesan: "${invalidBody.error?.message}" -> ${invalidPassed ? "PASS ✓" : "FAIL ✗"}`
  );

  // 3. Uji Rate Limiting: 10 per menit per IP -> permintaan berikutnya menghasilkan 429
  console.log("\n3. Uji Rate Limiter (Maksimal 10 req/menit per IP):");
  let got429 = false;
  let attempt429 = -1;
  for (let i = 1; i <= 15; i++) {
    const r = await fetch(`${BASE_URL}/api/auth/login-cepat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peran: "pasien" }),
    });
    if (r.status === 429) {
      got429 = true;
      attempt429 = i;
      break;
    }
  }
  const rateLimitPassed = got429;
  if (!rateLimitPassed) allPassed = false;
  console.log(
    `   Respon HTTP 429 tercapai pada permintaan ke-${attempt429} -> ${rateLimitPassed ? "PASS ✓" : "FAIL ✗"}`
  );

  console.log("\n===================================================");
  if (allPassed) {
    console.log("PENGUJIAN LIVE SERVER SELESAI DENGAN SUKSES!");
  } else {
    console.log("ADA PENGUJIAN YANG GAGAL. SILAKAN PERIKSA LOG DI ATAS.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Kesalahan saat menjalankan uji:", err);
  process.exit(1);
});
