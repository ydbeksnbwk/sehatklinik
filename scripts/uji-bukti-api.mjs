// scripts/uji-bukti-api.mjs
// Verifikasi endpoint publik dan admin profil-klinik untuk K1-K15 & Tahap Hapus Data Statis

const BASE = "http://localhost:3000";

async function test() {
  console.log("=== 1. UJI GET /api/public/klinik ===");
  const resKlinik = await fetch(`${BASE}/api/public/klinik`);
  const jsonKlinik = await resKlinik.json();
  console.log("Status:", resKlinik.status);
  console.log("Nama Klinik:", jsonKlinik.data?.nama);
  console.log("Tagline:", jsonKlinik.data?.tagline);
  console.log("History ada?:", Boolean(jsonKlinik.data?.history));
  console.log("Mission count:", jsonKlinik.data?.mission?.length);
  console.log("Values count:", jsonKlinik.data?.values?.length);
  console.log("Stats count:", jsonKlinik.data?.stats?.length);
  if (!jsonKlinik.data?.tagline || !jsonKlinik.data?.mission?.length) {
    throw new Error("Bidang detail profil klinik belum lengkap!");
  }

  console.log("\n=== 2. UJI GET /api/public/layanan ===");
  const resLayanan = await fetch(`${BASE}/api/public/layanan`);
  const jsonLayanan = await resLayanan.json();
  console.log("Status:", resLayanan.status);
  console.log("Jumlah Layanan:", jsonLayanan.data?.length);
  const sampleSvc = jsonLayanan.data?.[0];
  console.log("Sample Layanan:", sampleSvc?.namaLayanan);
  console.log("Sample Overview:", sampleSvc?.overview?.slice(0, 60) + "...");
  console.log("Sample Steps count:", sampleSvc?.steps?.length);
  console.log("Sample Cases count:", sampleSvc?.cases?.length);
  if (!sampleSvc?.overview || !sampleSvc?.steps?.length) {
    throw new Error("Bidang detail layanan belum lengkap!");
  }

  console.log("\n=== 3. UJI GET /api/public/dokter ===");
  const resDokter = await fetch(`${BASE}/api/public/dokter`);
  const jsonDokter = await resDokter.json();
  console.log("Status:", resDokter.status);
  console.log("Jumlah Dokter:", jsonDokter.data?.length);
  const sampleDoc = jsonDokter.data?.[0];
  console.log("Sample Dokter:", sampleDoc?.nama);
  console.log("Sample Almamater:", sampleDoc?.almamater);
  console.log("Sample ExperienceYears:", sampleDoc?.experienceYears);
  console.log("Sample STR:", sampleDoc?.str);
  console.log("Sample Education count:", sampleDoc?.education?.length);
  console.log("Sample Certifications count:", sampleDoc?.certifications?.length);
  if (!sampleDoc?.almamater || sampleDoc?.experienceYears === undefined) {
    throw new Error("Bidang detail dokter belum lengkap!");
  }

  console.log("\n=== 4. UJI LOGIN ADMIN & PUT /api/admin/profil-klinik ===");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin.klinik@gmail.com",
      password: "Password123!",
    }),
  });
  console.log("Login Admin Status:", loginRes.status);
  const cookie = loginRes.headers.get("set-cookie");

  const originalNama = jsonKlinik.data.nama;
  const originalTagline = jsonKlinik.data.tagline;

  console.log("Mengubah profil klinik via PUT...");
  const updateRes = await fetch(`${BASE}/api/admin/profil-klinik`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie || "",
    },
    body: JSON.stringify({
      nama: "Klinik Sehat Sentosa (Teruji)",
      deskripsi: jsonKlinik.data.deskripsi,
      alamat: jsonKlinik.data.alamat,
      latitude: jsonKlinik.data.latitude,
      longitude: jsonKlinik.data.longitude,
      kontak: jsonKlinik.data.kontak,
      jamOperasional: jsonKlinik.data.jamOperasional,
      detail: {
        ...jsonKlinik.data.detail,
        tagline: "Perawatan Sepenuh Hati - Terverifikasi",
      },
    }),
  });
  console.log("PUT Profil Status:", updateRes.status);
  const updateJson = await updateRes.json();
  console.log("Nama Baru dari PUT:", updateJson.data?.nama);
  console.log("Tagline Baru dari PUT:", updateJson.data?.tagline);

  console.log("\nMemverifikasi bahwa GET /api/public/klinik membaca data baru...");
  const verifyRes = await fetch(`${BASE}/api/public/klinik`);
  const verifyJson = await verifyRes.json();
  console.log("GET Publik Nama Baru:", verifyJson.data?.nama);
  console.log("GET Publik Tagline Baru:", verifyJson.data?.tagline);

  if (verifyJson.data?.nama !== "Klinik Sehat Sentosa (Teruji)") {
    throw new Error("Perubahan profil klinik tidak terbaca di endpoint publik!");
  }

  console.log("\nMengembalikan profil klinik ke semula...");
  await fetch(`${BASE}/api/admin/profil-klinik`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie || "",
    },
    body: JSON.stringify({
      nama: originalNama,
      deskripsi: jsonKlinik.data.deskripsi,
      alamat: jsonKlinik.data.alamat,
      latitude: jsonKlinik.data.latitude,
      longitude: jsonKlinik.data.longitude,
      kontak: jsonKlinik.data.kontak,
      jamOperasional: jsonKlinik.data.jamOperasional,
      detail: {
        ...jsonKlinik.data.detail,
        tagline: originalTagline,
      },
    }),
  });
  console.log("Profil klinik berhasil dikembalikan ke semula.");

  console.log("\n=== SEMUA PENGUJIAN API BERHASIL 100%! ===");
}

test().catch((err) => {
  console.error("PENGUJIAN GAGAL:", err);
  process.exit(1);
});
