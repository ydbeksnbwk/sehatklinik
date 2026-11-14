// scripts/uji-balapan-klaim.mjs
// Uji balapan dua pemroses bersamaan pada satu notifikasi (Race Condition Test)
// dan verifikasi penambahan push_percobaan setelah gagal.

import { pool, prosesPekerjaanNotifikasi, samarkanEndpoint } from "../worker/index.mjs";

async function main() {
  console.log("==========================================================");
  console.log("   UJI ANTI-GANDA: DUA PEMROSES BERSAMAAN PADA 1 NOTIFIKASI ");
  console.log("==========================================================");

  // 1. Ambil profil pasien untuk uji
  const profRes = await pool.query(
    "SELECT id, nama FROM profiles WHERE role = 'pasien' LIMIT 1"
  );
  if (profRes.rows.length === 0) {
    throw new Error("Tidak ada profil pasien di database");
  }
  const pasien = profRes.rows[0];
  console.log(`[1] Profil uji: ${pasien.nama} (${pasien.id})`);

  // 2. Sisipkan subscription palsu (FCM dummy yang mengembalikan 410)
  const dummyEndpoint = `https://fcm.googleapis.com/fcm/send/dummy-race-token-${Date.now()}`;
  const subRes = await pool.query(
    `INSERT INTO push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent, aktif)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, endpoint, aktif`,
    [
      pasien.id,
      dummyEndpoint,
      "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
      "tBHItJI5svbpez7KI4CCXg==",
      "Race-Condition-Test/1.0"
    ]
  );
  const sub = subRes.rows[0];
  console.log(`[2] Subscription dibuat: ID ${sub.id}, endpoint: ${samarkanEndpoint(sub.endpoint)}`);

  // 3. Sisipkan satu baris notifikasi status 'menunggu' dan push_diproses_at NULL
  const notifRes = await pool.query(
    `INSERT INTO notifikasi (profile_id, pesan, jenis_kejadian, tautan, push_status, push_diproses_at, push_percobaan)
     VALUES ($1, 'Pendaftaran berhasil. Antrean: 01-888 (dr. Reyhan, 15-11-2026)', 'KUNJUNGAN_TERDAFTAR', '/pasien', 'menunggu', NULL, 0)
     RETURNING id, profile_id, pesan, push_status, push_diproses_at, push_percobaan`,
    [pasien.id]
  );
  const notif = notifRes.rows[0];
  console.log(`[3] Notifikasi dibuat: ID ${notif.id}, status: ${notif.push_status}, diproses_at: ${notif.push_diproses_at}, percobaan awal: ${notif.push_percobaan}`);

  // 4. Jalankan dua pemroses secara paralel serentak pada notifikasi yang sama
  console.log("\n[4] Menjalankan dua pemroses (Pemroses-A dan Pemroses-B) secara bersamaan (Promise.all)...");
  
  const [hasilA, hasilB] = await Promise.all([
    prosesPekerjaanNotifikasi(notif.id, 0).then(r => ({ worker: "Pemroses-A", ...r })),
    prosesPekerjaanNotifikasi(notif.id, 0).then(r => ({ worker: "Pemroses-B", ...r }))
  ]);

  console.log("    Hasil Pemroses-A:", JSON.stringify(hasilA));
  console.log("    Hasil Pemroses-B:", JSON.stringify(hasilB));

  // Salah satu harus berhasil klaim dan memproses, yang satu lagi harus skipped
  const statuses = [hasilA.status, hasilB.status];
  const hasSkipped = statuses.includes("already_claimed_or_processed");
  const hasProcessed = statuses.includes("all_expired") || statuses.includes("success") || statuses.includes("failed");

  if (hasSkipped && hasProcessed) {
    console.log("    [PASS] Anti-ganda atomik berhasil: Hanya SATU pemroses yang mengeksekusi, pemroses kedua dilewati (skipped).");
  } else {
    console.error("    [FAIL] Keduanya atau tidak ada yang memproses:", statuses);
  }

  // 5. Verifikasi di database: SELECT push_percobaan dan push_status
  console.log("\n[5] Kueri verifikasi status dan push_percobaan di database:");
  const dbCheck = await pool.query(
    `SELECT id, jenis_kejadian, push_status, push_percobaan, push_error, push_diproses_at
     FROM notifikasi
     WHERE id = $1`,
    [notif.id]
  );
  const rowAfter = dbCheck.rows[0];
  console.log("SELECT notifikasi:", JSON.stringify(rowAfter, null, 2));

  if (rowAfter.push_percobaan === 1) {
    console.log(`    [PASS] push_percobaan bertambah menjadi ${rowAfter.push_percobaan} (bukan 0) setelah 1 kali percobaan gagal.`);
  } else {
    console.error(`    [FAIL] push_percobaan tidak bertambah: ${rowAfter.push_percobaan}`);
  }

  // 6. Bersihkan data uji
  await pool.query("DELETE FROM notifikasi WHERE id = $1", [notif.id]);
  await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
  console.log("\n[6] Data uji dibersihkan.");

  await pool.end();
  console.log("=== PENGUJIAN SELESAI DENGAN SUKSES ===");
}

main().catch(async (err) => {
  console.error("Galat pada pengujian:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
