// src/utils/api.ts
// Helper fetch terpusat untuk komunikasi frontend ke API backend internal.
// Semua pemanggilan menggunakan credentials: 'same-origin' dan menolak supabase-js di peramban.

export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

export type ApiResponse<T> = {
  data?: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  error?: ApiError;
};

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  try {
    let res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers,
    });

    // Jika 401 pada endpoint terproteksi (bukan endpoint autentikasi), coba refresh sesi 1x
    const isAuthWhitelist =
      path.includes("/api/auth/login") ||
      path.includes("/api/auth/register") ||
      path.includes("/api/auth/refresh") ||
      path.includes("/login") ||
      path.includes("/register");

    if (res.status === 401 && !isAuthWhitelist && typeof window !== "undefined") {
      try {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
        });
        if (refreshRes.ok) {
          // Ulangi request asli dengan cookie baru
          res = await fetch(url, {
            ...options,
            credentials: "same-origin",
            headers,
          });
        }
      } catch {
        // Biarkan fallback ke penanganan 401 reguler
      }
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = json?.error || {
        code: `HTTP_${res.status}`,
        message: json?.message || `Terjadi kesalahan (HTTP ${res.status})`,
      };

      if (res.status === 401) {
        if (!isAuthWhitelist && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("auth:unauthorized", {
              detail: { path, status: 401 },
            })
          );
        }
      }

      return { error: err };
    }

    return json;
  } catch (netErr: unknown) {
    const message = netErr instanceof Error ? netErr.message : "Gagal terhubung ke server";
    return {
      error: {
        code: "NETWORK_ERROR",
        message,
      },
    };
  }
}

// API Publik
export async function apiGetDokter(params?: { q?: string; layananId?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.layananId) query.set("layananId", params.layananId);
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/public/dokter${qStr ? `?${qStr}` : ""}`);
}

export async function apiGetLayanan(params?: { q?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/public/layanan${qStr ? `?${qStr}` : ""}`);
}

export async function apiGetJadwal(params?: { dokterId?: string; hari?: number }) {
  const query = new URLSearchParams();
  if (params?.dokterId) query.set("dokterId", params.dokterId);
  if (params?.hari !== undefined && params.hari !== null) query.set("hari", String(params.hari));
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/public/jadwal${qStr ? `?${qStr}` : ""}`);
}

export async function apiGetProfilKlinik() {
  return fetchApi<any>("/api/public/klinik");
}

// Auth
export async function apiGetMe() {
  return fetchApi<{
    id: string;
    email: string;
    nama: string;
    telepon: string;
    role: string;
    pasienId?: string | null;
    noRekamMedis?: string | null;
    nik?: string;
    tanggalLahir?: string;
    jenisKelamin?: string;
    alamat?: string;
    kontakDarurat?: string;
  }>("/api/auth/me");
}

export async function apiLogin(payload: { email: string; password: string }) {
  return fetchApi<{
    user: {
      id: string;
      email: string;
      nama: string;
      telepon: string;
      role: string;
      pasienId?: string | null;
      noRekamMedis?: string | null;
      nik?: string;
      tanggalLahir?: string;
      jenisKelamin?: string;
      alamat?: string;
      kontakDarurat?: string;
    };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiLoginCepat(peran: "pasien" | "petugas" | "dokter" | "admin") {
  return fetchApi<{
    user: {
      id: string;
      email: string;
      nama: string;
      telepon: string;
      role: string;
      pasienId?: string | null;
      noRekamMedis?: string | null;
      nik?: string;
      tanggalLahir?: string;
      jenisKelamin?: string;
      alamat?: string;
      kontakDarurat?: string;
    };
  }>("/api/auth/login-cepat", {
    method: "POST",
    body: JSON.stringify({ peran }),
  });
}

export async function apiLogout(payload?: { endpoint?: string }) {
  return fetchApi<{ message: string }>("/api/auth/logout", {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

export async function apiRefreshSession() {
  return fetchApi<{ user: { id: string; email: string }; expiresIn: number }>(
    "/api/auth/refresh",
    {
      method: "POST",
    }
  );
}

export async function apiUpdateProfil(payload: {
  nama?: string;
  telepon?: string;
  nik?: string;
  tanggalLahir?: string;
  jenisKelamin?: string;
  alamat?: string;
  kontakDarurat?: string;
}) {
  return fetchApi<any>("/api/profil", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiRegister(payload: {
  email: string;
  password: string;
  nama: string;
  telepon?: string;
  nik: string;
  tanggalLahir: string;
  jenisKelamin: string;
  alamat?: string;
  kontakDarurat?: string;
}) {
  return fetchApi<any>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Kunjungan & Antrean
export async function apiGetKunjungan(params?: { tanggal?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.tanggal) query.set("tanggal", params.tanggal);
  if (params?.status) query.set("status", params.status);
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/kunjungan${qStr ? `?${qStr}` : ""}`);
}

export async function apiTambahKunjungan(payload: {
  jadwalId: string;
  layananId: string;
  tanggal: string;
  keluhan: string;
  pasienId?: string;
}) {
  return fetchApi<any>("/api/kunjungan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiTransisiKunjungan(id: string, payload: { aksi: string; alasan?: string }) {
  return fetchApi<any>(`/api/kunjungan/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiSimpanPemeriksaan(
  id: string,
  payload: {
    anamnesis: string;
    diagnosis: string;
    catatan?: string;
    tandaVital?: {
      sistolik?: number;
      diastolik?: number;
      suhu?: number;
      detakJantung?: number;
      lajuPernapasan?: number;
      beratBadan?: number;
      tinggiBadan?: number;
      berat_badan?: number;
      tinggi_badan?: number;
    };
    tindakan?: Array<{
      nama?: string;
      namaTindakan?: string;
      deskripsi?: string;
      keterangan?: string;
      saran?: string;
    }>;
  }
) {
  return fetchApi<any>(`/api/kunjungan/${id}/pemeriksaan`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Pasien
export async function apiGetPasien(params?: { q?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/pasien${qStr ? `?${qStr}` : ""}`);
}

export async function apiTambahPasien(payload: {
  nama: string;
  tanggalLahir: string;
  jenisKelamin: string;
  nik?: string;
  telepon?: string;
  alamat?: string;
  kontakDarurat?: string;
}) {
  return fetchApi<any>("/api/pasien", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiGetPushKunci() {
  return fetchApi<{ vapidPublicKey: string }>("/api/push/kunci");
}

export async function apiSimpanPushSubscription(payload: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  return fetchApi<{ id: string; aktif: boolean; createdAt: string }>("/api/push/langganan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiHapusPushSubscription(payload: { endpoint: string }) {
  return fetchApi<{ success: boolean }>("/api/push/langganan", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

// Notifikasi
export async function apiTandaiSemuaNotifikasiDibaca() {
  return fetchApi<{ diperbarui: number }>("/api/notifikasi", {
    method: "PATCH",
  });
}

export async function apiTandaiNotifikasiDibaca(id: string) {
  return fetchApi<{ id: string; isRead: boolean }>(`/api/notifikasi/${id}`, {
    method: "PATCH",
  });
}

// Pekerjaan Web Push Notifikasi (Admin & Petugas)
export type PekerjaanNotifikasiItem = {
  id: string;
  jenisKejadian: string | null;
  pesan: string;
  pushStatus: "menunggu" | "berhasil" | "terkirim" | "gagal";
  pushPercobaan: number;
  pushError: string | null;
  pushDiprosesAt: string | null;
  createdAt: string;
  tautan: string | null;
  namaPenerima: string;
};

export async function apiGetPekerjaanNotifikasi(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.status && params.status !== "semua") query.set("status", params.status);
  const qStr = query.toString();
  return fetchApi<PekerjaanNotifikasiItem[]>(
    `/api/admin/pekerjaan-notifikasi${qStr ? `?${qStr}` : ""}`
  );
}

// Admin: Layanan
export async function apiAdminGetLayanan(params?: {
  q?: string;
  aktif?: boolean | string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.aktif !== undefined) query.set("aktif", String(params.aktif));
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/admin/layanan${qStr ? `?${qStr}` : ""}`);
}

export async function apiAdminTambahLayanan(payload: {
  namaLayanan: string;
  deskripsi?: string;
  durasiMenit: number;
  aktif?: boolean;
}) {
  return fetchApi<any>("/api/admin/layanan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiAdminUpdateLayanan(
  id: string,
  payload: {
    namaLayanan?: string;
    deskripsi?: string;
    durasiMenit?: number;
    aktif?: boolean;
  }
) {
  return fetchApi<any>(`/api/admin/layanan/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiAdminHapusLayanan(id: string) {
  return fetchApi<{ id: string; aktif?: boolean; dinonaktifkan?: boolean; message: string }>(
    `/api/admin/layanan/${id}`,
    {
      method: "DELETE",
    }
  );
}

// Admin: Pengguna
export async function apiAdminGetPengguna(params?: {
  q?: string;
  role?: string;
  statusAktif?: boolean | string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.role) query.set("role", params.role);
  if (params?.statusAktif !== undefined) query.set("statusAktif", String(params.statusAktif));
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/admin/pengguna${qStr ? `?${qStr}` : ""}`);
}

export async function apiAdminTambahPengguna(payload: {
  email: string;
  password?: string;
  nama: string;
  role: string;
  telepon?: string;
}) {
  return fetchApi<any>("/api/admin/pengguna", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiAdminUpdatePengguna(
  id: string,
  payload: {
    nama?: string;
    role?: string;
    statusAktif?: boolean;
    telepon?: string;
  }
) {
  return fetchApi<any>(`/api/admin/pengguna/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiAdminNonaktifkanPengguna(id: string) {
  return fetchApi<{ id: string; nama?: string; statusAktif: boolean; message: string }>(
    `/api/admin/pengguna/${id}`,
    {
      method: "DELETE",
    }
  );
}

// Admin: Profil Klinik
export async function apiAdminGetProfilKlinik() {
  return fetchApi<any>("/api/admin/profil-klinik");
}

export async function apiAdminUpdateProfilKlinik(payload: {
  nama: string;
  deskripsi?: string;
  alamat?: string;
  latitude?: number;
  longitude?: number;
  kontak?: string;
  jamOperasional?: string | Record<string, unknown> | null;
}) {
  return fetchApi<{ message: string; profil: unknown }>("/api/admin/profil-klinik", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Admin: Rekap
export async function apiAdminGetRekap(params?: {
  dariTanggal?: string;
  sampaiTanggal?: string;
  dokterId?: string;
  layananId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.dariTanggal) query.set("dariTanggal", params.dariTanggal);
  if (params?.sampaiTanggal) query.set("sampaiTanggal", params.sampaiTanggal);
  if (params?.dokterId) query.set("dokterId", params.dokterId);
  if (params?.layananId) query.set("layananId", params.layananId);
  if (params?.status && params.status !== "semua") query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qStr = query.toString();
  return fetchApi<any[]>(`/api/admin/rekap${qStr ? `?${qStr}` : ""}`);
}

// Admin: Upload Foto Dokter
export async function apiAdminUploadFotoDokter(dokterId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi<{ id: string; nama: string; fotoPath: string; fotoUrl: string }>(
    `/api/admin/dokter/${dokterId}/foto`,
    {
      method: "POST",
      body: formData,
    }
  );
}

// Petugas: Koreksi Data Pasien
export async function apiPetugasKoreksiPasien(
  id: string,
  payload: {
    nama?: string;
    nik?: string | null;
    tanggalLahir?: string;
    jenisKelamin?: string;
    telepon?: string | null;
    alamat?: string | null;
    kontakDarurat?: string | null;
  }
) {
  return fetchApi<any>(`/api/petugas/pasien/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}




