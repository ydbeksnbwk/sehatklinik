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
    const res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = json?.error || {
        code: `HTTP_${res.status}`,
        message: json?.message || `Terjadi kesalahan (HTTP ${res.status})`,
      };
      return { error: err };
    }

    return json;
  } catch (netErr: any) {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: netErr?.message || "Gagal terhubung ke server",
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

export async function apiLogout() {
  return fetchApi<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
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

