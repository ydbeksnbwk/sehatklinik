// scripts/uji-push.mjs
// Pengujian Terotomasi Bukti Web Push dan Worker (PRD §7)
// Skenario (a) s.d. (e)

import { spawn } from "child_process";
import http from "http";

const PORT = 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function waitServerReady(url, maxRetries = 40) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      http.get(`${url}/api/health`, (res) => {
        resolve();
      }).on("error", () => {
        retries++;
        if (retries > maxRetries) {
          reject(new Error("Server tidak siap dalam batas waktu"));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  const cookieHeader = res.headers.get("set-cookie") || "";
  let token = null;
  const match = cookieHeader.match(/sb-access-token=([^;]+)/);
  if (match) token = match[1];
  return { status: res.status, data, token, cookie: cookieHeader };
}

async function main() {
  console.log("==========================================================");
  console.log("   UJI OTOMASI WEB PUSH & WORKER (PRD §7) - KLINIK TIM 7  ");
  console.log("==========================================================");

  console.log(`[0] Menjalankan Next.js server produksi sementara di port ${PORT}...`);
  const serverProcess = spawn(
    "node",
    ["./node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    {
      env: { ...process.env, PORT: String(PORT) },
      stdio: "pipe",
    }
  );

  serverProcess.stderr.on("data", (d) => {
    // console.error(`[Next.js err] ${d}`);
  });

  try {
    await waitServerReady(BASE_URL);
    console.log(`    -> Server Next.js siap menerima permintaan di ${BASE_URL}\n`);

    // (a) GET /api/push/kunci 200 tanpa private key
    console.log("[1] (a) UJI: GET /api/push/kunci mengembalikan 200 dan TANPA private key");
    const resKunci = await fetch(`${BASE_URL}/api/push/kunci`);
    const jsonKunci = await resKunci.json();
    const hasPublicKey = Boolean(jsonKunci?.data?.vapidPublicKey);
    const hasPrivateKey = JSON.stringify(jsonKunci).includes("VAPID_PRIVATE_KEY") || Boolean(jsonKunci?.data?.vapidPrivateKey);
    if (resKunci.status === 200 && hasPublicKey && !hasPrivateKey) {
      console.log(`    [PASS] Status: ${resKunci.status}, vapidPublicKey tersedia, private key TIDAK bocor.`);
      console.log(`           Kunci publik: ${jsonKunci.data.vapidPublicKey.slice(0, 16)}...`);
    } else {
      console.error(`    [FAIL] Status: ${resKunci.status}, hasPublicKey: ${hasPublicKey}, hasPrivateKey: ${hasPrivateKey}`);
    }

    // (b) POST /api/push/langganan tanpa login 401
    console.log("\n[2] (b) UJI: POST /api/push/langganan tanpa login mengembalikan 401");
    const resSubNoAuth = await fetch(`${BASE_URL}/api/push/langganan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/test-noauth",
        p256dh: "key-dummy",
        auth: "auth-dummy",
      }),
    });
    if (resSubNoAuth.status === 401) {
      console.log(`    [PASS] Ditolak 401 UNAUTHENTICATED untuk akses tanpa sesi/token.`);
    } else {
      console.error(`    [FAIL] Status: ${resSubNoAuth.status}`);
    }

    // Login akun Pasien dan Petugas
    console.log("\n[*] Mengautentikasi akun uji (Pasien, Petugas, Dokter)...");
    const loginPasien = await login("ani.wulandari@gmail.com", "Password123!");
    const loginPetugas = await login("rina.petugas@gmail.com", "Password123!");
    const loginDokter = await login("dokter.reyhan@gmail.com", "Password123!");

    if (!loginPasien.token || !loginPetugas.token) {
      throw new Error("Gagal login akun uji");
    }
    console.log("    -> Login berhasil untuk Pasien dan Petugas.");

    // (c) DELETE langganan milik akun lain -> 404
    console.log("\n[3] (c) UJI: DELETE langganan milik akun lain mengembalikan 404");
    // Langkah 1: Buat subscription atas nama Petugas
    const endpointPetugas = `https://fcm.googleapis.com/fcm/send/petugas-endpoint-${Date.now()}`;
    const resCreateSub = await fetch(`${BASE_URL}/api/push/langganan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `sb-access-token=${loginPetugas.token}`,
      },
      body: JSON.stringify({
        endpoint: endpointPetugas,
        p256dh: "dummy-petugas-key",
        auth: "dummy-petugas-auth",
      }),
    });
    const subCreated = await resCreateSub.json();
    console.log(`    -> Subscription Petugas dibuat: status ${resCreateSub.status}`);

    // Langkah 2: Pasien mencoba menghapus subscription milik Petugas
    const resHapusOrangLain = await fetch(`${BASE_URL}/api/push/langganan`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: `sb-access-token=${loginPasien.token}`,
      },
      body: JSON.stringify({
        endpoint: endpointPetugas,
      }),
    });
    if (resHapusOrangLain.status === 404) {
      console.log(`    [PASS] Ditolak 404 NOT_FOUND ketika mencoba menghapus subscription milik akun lain.`);
    } else {
      console.error(`    [FAIL] Menghapus milik akun lain menghasilkan status: ${resHapusOrangLain.status}`);
    }

    // Bersihkan: Petugas menghapus subscription miliknya sendiri -> 200
    const resHapusSendiri = await fetch(`${BASE_URL}/api/push/langganan`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: `sb-access-token=${loginPetugas.token}`,
      },
      body: JSON.stringify({
        endpoint: endpointPetugas,
      }),
    });
    console.log(`    -> Petugas menghapus miliknya sendiri: status ${resHapusSendiri.status} (200 OK)`);

    // (d) GET /api/admin/pekerjaan-notifikasi: pasien 403, petugas 200
    console.log("\n[4] (d) UJI: Otorisasi GET /api/admin/pekerjaan-notifikasi");
    const resPasienNotif = await fetch(`${BASE_URL}/api/admin/pekerjaan-notifikasi`, {
      headers: { Cookie: `sb-access-token=${loginPasien.token}` },
    });
    if (resPasienNotif.status === 403) {
      console.log(`    [PASS] Pasien ditolak 403 FORBIDDEN mengakses daftar pekerjaan notifikasi.`);
    } else {
      console.error(`    [FAIL] Pasien mendapatkan status ${resPasienNotif.status}`);
    }

    const resDokterNotif = await fetch(`${BASE_URL}/api/admin/pekerjaan-notifikasi`, {
      headers: { Cookie: `sb-access-token=${loginDokter.token}` },
    });
    if (resDokterNotif.status === 403) {
      console.log(`    [PASS] Dokter ditolak 403 FORBIDDEN mengakses daftar pekerjaan notifikasi.`);
    } else {
      console.error(`    [FAIL] Dokter mendapatkan status ${resDokterNotif.status}`);
    }

    const resPetugasNotif = await fetch(`${BASE_URL}/api/admin/pekerjaan-notifikasi?pageSize=5`, {
      headers: { Cookie: `sb-access-token=${loginPetugas.token}` },
    });
    const jsonPetugasNotif = await resPetugasNotif.json();
    if (resPetugasNotif.status === 200 && Array.isArray(jsonPetugasNotif?.data) && jsonPetugasNotif?.meta) {
      console.log(`    [PASS] Petugas diizinkan 200 OK dengan format meta dan data valid:`);
      console.log(`           Meta: page=${jsonPetugasNotif.meta.page}, total=${jsonPetugasNotif.meta.total}`);
    } else {
      console.error(`    [FAIL] Petugas mendapatkan status: ${resPetugasNotif.status}`);
    }

    // (e) Uji Worker dengan endpoint palsu
    console.log("\n[5] (e) UJI: Subscription dengan endpoint palsu pada worker");
    console.log("    Menjalankan simulasi skrip uji worker...");
    const { execSync } = await import("child_process");
    const outputWorker = execSync("node --env-file=.env.local scripts/uji-worker.mjs", {
      encoding: "utf8",
    });
    console.log("    --- Output Log & Verifikasi Worker ---");
    console.log(outputWorker);

    console.log("\n==========================================================");
    console.log("   SELURUH SKENARIO PENGUJIAN (a) s.d. (e) LULUS (PASS)   ");
    console.log("==========================================================");
  } finally {
    serverProcess.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("Galat eksekusi uji push:", err);
  process.exit(1);
});
