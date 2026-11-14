// scripts/uji-1d.mjs
// Pengujian Otomatis Seluruh Skenario Bukti Tahap 1D
// Sistem Informasi Klinik Kesehatan (Tim 7)

import { spawn } from "child_process";
import http from "http";

const PORT = 3008;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function waitServerReady(url, maxRetries = 40) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      http
        .get(`${url}/api/health`, (res) => {
          resolve();
        })
        .on("error", () => {
          retries++;
          if (retries > maxRetries) {
            reject(new Error("Server Next.js tidak siap dalam batas waktu"));
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

async function kirim(method, path, body = null, token = null, isFormData = false) {
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["Cookie"] = `sb-access-token=${token}`;
  }
  const init = { method, headers };
  if (body) {
    if (isFormData) {
      init.body = body;
    } else {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, init);
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json };
}

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

async function main() {
  console.log("==========================================================");
  console.log("      UJI OTOMASI TAHAP 1D (KLINIK TIM 7)                 ");
  console.log("==========================================================");

  console.log(`[0] Menjalankan Next.js server produksi di port ${PORT}...`);
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
    console.log("    -> Server Next.js siap.");

    console.log("\n[1] Mengautentikasi akun uji peran (Pasien, Petugas, Dokter, Admin)...");
    const loginPasien = await login("ani.wulandari@gmail.com", "Password123!");
    const loginPetugas = await login("rina.petugas@gmail.com", "Password123!");
    const loginDokter = await login("dokter.reyhan@gmail.com", "Password123!");
    const loginAdmin = await login("admin.klinik@gmail.com", "Password123!");

    cek("Login Pasien", loginPasien.status === 200 && !!loginPasien.token);
    cek("Login Petugas", loginPetugas.status === 200 && !!loginPetugas.token);
    cek("Login Dokter", loginDokter.status === 200 && !!loginDokter.token);
    cek("Login Admin", loginAdmin.status === 200 && !!loginAdmin.token);

    const tokenPasien = loginPasien.token;
    const tokenPetugas = loginPetugas.token;
    const tokenDokter = loginDokter.token;
    const tokenAdmin = loginAdmin.token;

    // Ambil data referensi awal
    const meAdmin = await kirim("GET", "/api/auth/me", null, tokenAdmin);
    const adminId = meAdmin.data?.data?.id;

    const listDokter = await kirim("GET", "/api/public/dokter");
    const dokterId = listDokter.data?.data?.[0]?.id || "b9cd5971-4e73-4f8b-b0dd-0bc2ba064092";

    const listPasien = await kirim("GET", "/api/pasien", null, tokenPetugas);
    const pasienSample = listPasien.data?.data?.[0];
    const pasienSampleId = pasienSample?.id;

    console.log("\n[2] BUKTI 1: Tiap endpoint baru ditolak 401 tanpa login...");
    const dummyUUID = "00000000-0000-0000-0000-000000000000";
    const unauthTests = [
      ["GET /api/admin/layanan", "GET", "/api/admin/layanan"],
      ["POST /api/admin/layanan", "POST", "/api/admin/layanan", { namaLayanan: "Test", durasiMenit: 30 }],
      ["GET /api/admin/pengguna", "GET", "/api/admin/pengguna"],
      ["POST /api/admin/pengguna", "POST", "/api/admin/pengguna", { nama: "Test", email: "t@k.id", role: "petugas", password: "Password123!" }],
      ["GET /api/admin/profil-klinik", "GET", "/api/admin/profil-klinik"],
      ["PUT /api/admin/profil-klinik", "PUT", "/api/admin/profil-klinik", { nama: "Klinik" }],
      ["GET /api/admin/rekap", "GET", "/api/admin/rekap"],
      ["POST /api/admin/dokter/[id]/foto", "POST", `/api/admin/dokter/${dummyUUID}/foto`],
      ["PATCH /api/petugas/pasien/[id]", "PATCH", `/api/petugas/pasien/${dummyUUID}`, { nama: "Budi" }],
    ];

    for (const [label, method, path, body] of unauthTests) {
      const res = await kirim(method, path, body, null);
      cek(`${label} tanpa login -> 401`, res.status === 401, `(HTTP ${res.status})`);
    }

    console.log("\n[3] BUKTI 2: Tiap endpoint baru ditolak 403 untuk peran salah...");
    const roleTests = [
      ["Pasien akses GET /api/admin/layanan", "GET", "/api/admin/layanan", null, tokenPasien],
      ["Petugas akses GET /api/admin/layanan", "GET", "/api/admin/layanan", null, tokenPetugas],
      ["Dokter akses GET /api/admin/layanan", "GET", "/api/admin/layanan", null, tokenDokter],
      ["Pasien akses GET /api/admin/pengguna", "GET", "/api/admin/pengguna", null, tokenPasien],
      ["Petugas akses GET /api/admin/pengguna", "GET", "/api/admin/pengguna", null, tokenPetugas],
      ["Pasien akses GET /api/admin/profil-klinik", "GET", "/api/admin/profil-klinik", null, tokenPasien],
      ["Petugas akses PUT /api/admin/profil-klinik", "PUT", "/api/admin/profil-klinik", { nama: "X" }, tokenPetugas],
      ["Pasien akses GET /api/admin/rekap", "GET", "/api/admin/rekap", null, tokenPasien],
      ["Petugas akses GET /api/admin/rekap", "GET", "/api/admin/rekap", null, tokenPetugas],
      ["Pasien akses upload foto dokter", "POST", `/api/admin/dokter/${dokterId}/foto`, null, tokenPasien],
      ["Petugas akses upload foto dokter", "POST", `/api/admin/dokter/${dokterId}/foto`, null, tokenPetugas],
      ["Pasien akses PATCH koreksi pasien", "PATCH", `/api/petugas/pasien/${dummyUUID}`, { nama: "Test" }, tokenPasien],
      ["Admin akses PATCH koreksi pasien", "PATCH", `/api/petugas/pasien/${dummyUUID}`, { nama: "Test" }, tokenAdmin],
      ["Dokter akses PATCH koreksi pasien", "PATCH", `/api/petugas/pasien/${dummyUUID}`, { nama: "Test" }, tokenDokter],
    ];

    for (const [label, method, path, body, tok] of roleTests) {
      const res = await kirim(method, path, body, tok);
      cek(`${label} -> 403`, res.status === 403, `(HTTP ${res.status})`);
    }

    console.log("\n[4] BUKTI 3: Admin ubah perannya/akunnya sendiri ditolak (BR-11)...");
    if (adminId) {
      const resBR11Role = await kirim(
        "PATCH",
        `/api/admin/pengguna/${adminId}`,
        { role: "petugas" },
        tokenAdmin
      );
      cek(
        "Admin ubah peran akunnya sendiri -> ditolak 403 (BR-11)",
        resBR11Role.status === 403,
        `(HTTP ${resBR11Role.status} - ${resBR11Role.data?.error?.message})`
      );

      const resBR11Status = await kirim(
        "PATCH",
        `/api/admin/pengguna/${adminId}`,
        { statusAktif: false },
        tokenAdmin
      );
      cek(
        "Admin nonaktifkan akunnya sendiri -> ditolak 403 (BR-11)",
        resBR11Status.status === 403,
        `(HTTP ${resBR11Status.status} - ${resBR11Status.data?.error?.message})`
      );
    } else {
      console.warn("  [SKIP] adminId tidak ditemukan dari /api/auth/me");
    }

    console.log("\n[5] BUKTI 4: Unggah foto dokter: .exe, PDF, >2 MB ditolak; berkas PNG asli diterima...");
    // 5a. Berkas .exe (Magic bytes 'MZ' / \x4D\x5A)
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const fdExe = new FormData();
    fdExe.append("file", new Blob([exeBuffer], { type: "application/x-msdownload" }), "malware.exe");
    const resExe = await kirim("POST", `/api/admin/dokter/${dokterId}/foto`, fdExe, tokenAdmin, true);
    cek("Unggah file .exe ditolak", resExe.status === 422 || resExe.status === 400, `(HTTP ${resExe.status} - ${resExe.data?.error?.message})`);

    // 5b. Berkas PDF (Magic bytes '%PDF-' / \x25\x50\x44\x46)
    const pdfBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\n0000000000 65535 f \n");
    const fdPdf = new FormData();
    fdPdf.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), "document.pdf");
    const resPdf = await kirim("POST", `/api/admin/dokter/${dokterId}/foto`, fdPdf, tokenAdmin, true);
    cek("Unggah file PDF ditolak", resPdf.status === 422 || resPdf.status === 400, `(HTTP ${resPdf.status} - ${resPdf.data?.error?.message})`);

    // 5c. Berkas > 2 MB (2.2 MB dummy)
    const bigBuffer = Buffer.alloc(2.2 * 1024 * 1024, 0x89);
    const fdBig = new FormData();
    fdBig.append("file", new Blob([bigBuffer], { type: "image/png" }), "large.png");
    const resBig = await kirim("POST", `/api/admin/dokter/${dokterId}/foto`, fdBig, tokenAdmin, true);
    cek("Unggah berkas > 2 MB ditolak", resBig.status === 400, `(HTTP ${resBig.status} - ${resBig.data?.error?.message})`);

    // 5d. Berkas PNG asli (Header 89 50 4E 47 0D 0A 1A 0A + 1x1 dummy PNG chunk)
    const validPngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
      0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, // IDAT
      0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82 // IEND
    ]);
    const fdPng = new FormData();
    fdPng.append("file", new Blob([validPngBytes], { type: "image/png" }), "foto-dokter.png");
    const resPng = await kirim("POST", `/api/admin/dokter/${dokterId}/foto`, fdPng, tokenAdmin, true);
    cek("Unggah berkas PNG asli diterima", resPng.status === 200 && !!resPng.data?.data?.fotoPath, `(HTTP ${resPng.status} - Path: ${resPng.data?.data?.fotoPath})`);

    console.log("\n[6] BUKTI 5: Rekap kunjungan agregasi DB konsisten & kueri SELECT count...");
    const resRekap = await kirim("GET", "/api/admin/rekap", null, tokenAdmin);
    cek("GET /api/admin/rekap -> 200", resRekap.status === 200);
    const ringkasan = resRekap.data?.ringkasan;
    const meta = resRekap.data?.meta;
    if (ringkasan) {
      const { totalKunjungan, totalTerdaftar, totalHadir, totalSelesai, totalBatal } = ringkasan;
      const sumStatus = totalTerdaftar + totalHadir + totalSelesai + totalBatal;
      cek(
        "Total kunjungan = sum(terdaftar + hadir + selesai + batal)",
        totalKunjungan === sumStatus,
        `(Total: ${totalKunjungan}, SumStatus: ${sumStatus})`
      );
      cek(
        "Meta total konsisten dengan ringkasan total",
        meta?.total === totalKunjungan,
        `(Meta: ${meta?.total}, Ringkasan: ${totalKunjungan})`
      );
      console.log(`    Ringkasan Rekap Database:`);
      console.log(`    - Total Kunjungan: ${totalKunjungan}`);
      console.log(`    - Terdaftar      : ${totalTerdaftar}`);
      console.log(`    - Hadir          : ${totalHadir}`);
      console.log(`    - Selesai        : ${totalSelesai}`);
      console.log(`    - Batal          : ${totalBatal}`);
    }

    console.log("\n[7] BUKTI 6: PATCH koreksi pasien (pasien 403, NIK 15 digit 400, NIK duplikat 409, valid 200)...");
    if (pasienSampleId) {
      // 7a. Pasien panggil koreksi pasien -> 403
      const resPasienAkses = await kirim(
        "PATCH",
        `/api/petugas/pasien/${pasienSampleId}`,
        { nama: "Coba Ubah Sendiri" },
        tokenPasien
      );
      cek("Pasien mengoreksi data pasien -> 403 Forbidden", resPasienAkses.status === 403, `(HTTP ${resPasienAkses.status})`);

      // 7b. Petugas NIK 15 digit -> 400
      const resNik15 = await kirim(
        "PATCH",
        `/api/petugas/pasien/${pasienSampleId}`,
        { nik: "123456789012345" }, // 15 digit
        tokenPetugas
      );
      cek("Petugas koreksi NIK 15 digit -> 400 Bad Request", resNik15.status === 400, `(HTTP ${resNik15.status} - ${resNik15.data?.error?.fields?.nik || resNik15.data?.error?.message})`);

      // 7c. Petugas NIK duplikat -> 409
      // Cari pasien kedua untuk mencoba NIK yang sama
      const pasienDua = listPasien.data?.data?.[1];
      if (pasienDua && pasienDua.nik) {
        const resDuplikat = await kirim(
          "PATCH",
          `/api/petugas/pasien/${pasienSampleId}`,
          { nik: pasienDua.nik },
          tokenPetugas
        );
        cek("Petugas koreksi NIK duplikat -> 409 Conflict", resDuplikat.status === 409, `(HTTP ${resDuplikat.status} - ${resDuplikat.data?.error?.message})`);
      } else {
        // Buat NIK duplikat test: set ke pasienSample, lalu coba set ke pasienDua jika ada
        if (pasienDua) {
          const testNik = "3201019901990001";
          await kirim("PATCH", `/api/petugas/pasien/${pasienSampleId}`, { nik: testNik }, tokenPetugas);
          const resDuplikat = await kirim("PATCH", `/api/petugas/pasien/${pasienDua.id}`, { nik: testNik }, tokenPetugas);
          cek("Petugas koreksi NIK duplikat -> 409 Conflict", resDuplikat.status === 409, `(HTTP ${resDuplikat.status} - ${resDuplikat.data?.error?.message})`);
        }
      }

      // 7d. Petugas koreksi data valid -> 200
      const resValid = await kirim(
        "PATCH",
        `/api/petugas/pasien/${pasienSampleId}`,
        {
          nama: `${pasienSample.nama} (Terkoreksi)`,
          tanggalLahir: "1995-05-15",
          jenisKelamin: "Perempuan",
          telepon: "+628123456789",
        },
        tokenPetugas
      );
      cek(
        "Petugas koreksi data valid -> 200 OK",
        resValid.status === 200 && resValid.data?.data?.nama?.includes("(Terkoreksi)"),
        `(HTTP ${resValid.status} - Nama baru: ${resValid.data?.data?.nama})`
      );
    }

    console.log("\n==========================================================");
    console.log(`HASIL AKHIR PENGUJIAN TAHAP 1D: ${lulus} LULUS, ${gagal} GAGAL`);
    console.log("==========================================================");

  } finally {
    console.log("\n[Cleanup] Menghentikan server Next.js sementara...");
    serverProcess.kill();
  }

  if (gagal > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Kesalahan runtime pengujian:", err);
  process.exit(1);
});
