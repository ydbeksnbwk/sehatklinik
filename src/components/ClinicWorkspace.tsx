"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import { useClinic, type ClinicUser } from "../context/ClinicContext";
import PublicSite from "./PublicSite";
import BrandArtwork from "./BrandArtwork";
import GenderAvatar from "./GenderAvatar";
import NotificationDrawer from "./NotificationDrawer";
import { downloadRekapExcel } from "../utils/exportRekapExcel";
import { printVisitSummary } from "../utils/printVisitSummary";
import { apiUpdateProfil } from "../utils/api";
import {
  DEMO_DATE,
  remaining,
  dateLabel,
  queueLabel,
  type Role,
  type Visit,
  type Patient,
  type Doctor,
  type Service,
  type Schedule,
  type Examination,
} from "../clinic-data";
import {
  getTodayFormatted,
  getTodayDateOnly,
  getTodayISODate,
  formatDateIndonesian,
} from "@/lib/date";

type IconType = ComponentType<{
  name: string;
  size?: number;
}>;

const getErrorMessage = (err: any): string => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err.fields && typeof err.fields === "object") {
    const list = Object.values(err.fields).flat().filter(Boolean);
    if (list.length > 0) return list.join(", ");
  }
  if (typeof err.message === "string") return err.message;
  return "Terjadi kesalahan saat pendaftaran. Silakan coba lagi.";
};
const menus: Record<Exclude<Role, "Publik">, [string, string][]> = {
  Admin: [
    ["Dashboard", "grid"],
    ["Data Dokter", "users"],
    ["Data Layanan", "heart"],
    ["Jadwal Praktik", "calendar"],
    ["Manajemen Pengguna", "users"],
    ["Profil Klinik", "clinic"],
    ["Pekerjaan Notifikasi", "bell"],
    ["Rekap Kunjungan", "chart"],
  ],
  Petugas: [
    ["Dashboard", "grid"],
    ["Antrean Hari Ini", "clock"],
    ["Pendaftaran Walk-in", "plus"],
    ["Data Pasien", "users"],
    ["Pekerjaan Notifikasi", "bell"],
  ],
  Dokter: [
    ["Dashboard", "grid"],
    ["Antrean Saya", "clock"],
    ["Riwayat Pasien", "file"],
  ],
  Pasien: [
    ["Dashboard", "grid"],
    ["Pendaftaran Kunjungan", "plus"],
    ["Antrean Saya", "clock"],
    ["Riwayat Kunjungan", "file"],
    ["Profil Saya", "users"],
  ],
};
const queueStates = [
  "Menunggu",
  "Dipanggil",
  "Sedang Diperiksa",
  "Selesai",
  "Dilewati",
  "Dibatalkan",
];
function Badge({ text }: { text: string }) {
  return (
    <span
      className={`badge ${
        ["Selesai", "Aktif", "Hadir"].includes(text)
          ? "green"
          : ["Dibatalkan", "Nonaktif"].includes(text)
            ? "red"
            : ["Menunggu", "Terdaftar", "Dilewati"].includes(text)
              ? "orange"
              : "blue"
      }`}
    >
      {text}
    </span>
  );
}
type FieldProps = {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
};
function Field({ label, children, icon }: FieldProps) {
  return (
    <label>
      {label}
      {icon}
      {children}
    </label>
  );
}

type Props = {
  Icon: IconType;
  initialPage?: string;
  initialRole?: Role;
  initialDetailId?: string;
};

export default function ClinicWorkspace({
  Icon,
  initialPage,
  initialRole,
  initialDetailId,
}: Props) {
  const clinicContext = useClinic();
  const {
    role,
    setRole,
    page,
    setPage,
    visits,
    setVisits,
    patients,
    setPatients,
    doctors,
    setDoctors,
    services,
    setServices,
    schedules,
    setSchedules,
    users,
    setUsers,
    currentUser,
    setCurrentUser,
    logout,
    clinic,
    setClinic,
    mobile,
    setMobile,
    search,
    setSearch,
    filter,
    setFilter,
    doctorFilter,
    setDoctorFilter,
    serviceFilter,
    setServiceFilter,
    range,
    setRange,
    pagination,
    setPagination,
    selected,
    setSelected,
    editor,
    setEditor,
    toast,
    setToast,
    error,
    setError,
    reason,
    setReason,
    exam,
    setExam,
    savedExam,
    setSavedExam,
    step,
    setStep,
    booking,
    setBooking,
    receipt,
    setReceipt,
    busy,
    setBusy,
    loadingData,
    editingProfile,
    setEditingProfile,
    unreadCount,
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    webPushPermission,
    requestWebPushPermission,
    notificationJobs,
    retryNotificationJob,
    sendDemoPushNotification,
    transition,
    submitBooking,
    saveExamination,
  } = clinicContext;

  const [mounted, setMounted] = useState(false);
  const [modalEmail, setModalEmail] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [modalShowPassword, setModalShowPassword] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [profilFieldErrors, setProfilFieldErrors] = useState<
    Record<string, string>
  >({});
  const [subFilter, setSubFilter] = useState("");
  const [doctorPhoto, setDoctorPhoto] = useState("");
  const [doctorPhotoError, setDoctorPhotoError] = useState("");
  const [reportAllDates, setReportAllDates] = useState(true);
  const [reportSortOrder, setReportSortOrder] = useState<"desc" | "asc">(
    "desc",
  );
  const [todayFormatted, setTodayFormatted] = useState("");
  const lastAutoOpenedVisitId = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setTodayFormatted(getTodayFormatted());
  }, []);

  useEffect(() => {
    setSubFilter("");
  }, [page]);

  const isStaffRole =
    initialRole === "Admin" ||
    initialRole === "Petugas" ||
    initialRole === "Dokter";

  const showAuthModal =
    mounted &&
    isStaffRole &&
    (!currentUser || currentUser.role !== initialRole);

  useEffect(() => {
    const userRole =
      currentUser?.role &&
      ["Pasien", "Petugas", "Dokter", "Admin"].includes(currentUser.role)
        ? (currentUser.role as Role)
        : null;

    let resolvedRole: Role = role;
    if (initialRole && initialRole !== "Publik") {
      resolvedRole = initialRole;
    } else if (userRole) {
      resolvedRole = userRole;
    } else if (initialRole) {
      resolvedRole = initialRole;
    } else {
      resolvedRole = role !== "Publik" ? role : "Publik";
    }

    if (role !== resolvedRole) {
      setRole(resolvedRole);
    }

    const resolveInitialPage = (rawPage?: string) => {
      if (!rawPage) return rawPage;
      if (rawPage === "Riwayat Kunjungan" && resolvedRole !== "Pasien") {
        return resolvedRole === "Admin" ? "Rekap Kunjungan" : "Semua Kunjungan";
      }
      if (rawPage === "Antrean Saya" && resolvedRole !== "Pasien") {
        return resolvedRole === "Admin"
          ? "Semua Kunjungan"
          : "Antrean Hari Ini";
      }
      return rawPage;
    };

    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab) {
        setPage(tab);
      } else {
        const nextPage = resolveInitialPage(initialPage);
        if (nextPage && page !== nextPage) {
          setPage(nextPage);
        }
      }
    } else {
      const nextPage = resolveInitialPage(initialPage);
      if (nextPage && page !== nextPage) {
        setPage(nextPage);
      }
    }
  }, [initialRole, initialPage]);

  useEffect(() => {
    if (initialRole || role === "Publik" || role === "Pasien") return;
    if (initialPage === "Riwayat Kunjungan" && page === "Riwayat Kunjungan") {
      setPage(role === "Admin" ? "Rekap Kunjungan" : "Semua Kunjungan");
    } else if (initialPage === "Antrean Saya" && page === "Antrean Saya") {
      setPage(role === "Admin" ? "Semua Kunjungan" : "Antrean Hari Ini");
    }
  }, [initialRole, initialPage, role, page]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (path === "/") {
        setRole("Publik");
        setPage("Beranda");
        setSelected(null);
      } else if (path === "/profil") {
        setRole("Publik");
        setPage("Profil");
        setSelected(null);
      } else if (path === "/layanan" || path.startsWith("/layanan/")) {
        setRole("Publik");
        setPage("Layanan");
        setSelected(null);
      } else if (
        path === "/dokter" ||
        (path.startsWith("/dokter/") && !path.startsWith("/dokter/dashboard"))
      ) {
        setRole("Publik");
        setPage("Dokter");
        setSelected(null);
      } else if (path === "/jadwal") {
        setRole("Publik");
        setPage("Jadwal");
        setSelected(null);
      } else if (path === "/lokasi") {
        setRole("Publik");
        setPage("Lokasi");
        setSelected(null);
      } else if (path === "/login") {
        setRole("Publik");
        setPage("Login");
        setSelected(null);
      } else if (path === "/daftar") {
        setRole("Publik");
        setPage("Registrasi");
        setSelected(null);
      } else if (path === "/admin") {
        setRole("Admin");
        setPage(tab || "Dashboard");
        setSelected(null);
      } else if (path === "/petugas") {
        setRole("Petugas");
        setPage(tab || "Dashboard");
        setSelected(null);
      } else if (path === "/dokter-dashboard" || path === "/dokter/dashboard") {
        setRole("Dokter");
        setPage(tab || "Dashboard");
        setSelected(null);
      } else if (path === "/pasien") {
        setRole("Pasien");
        setPage(tab || "Dashboard");
        setSelected(null);
      } else if (
        path.startsWith("/riwayat/") ||
        path.startsWith("/kunjungan/")
      ) {
        const rawId = decodeURIComponent(
          path.startsWith("/riwayat/")
            ? path.slice("/riwayat/".length)
            : path.slice("/kunjungan/".length),
        );
        const target = visits.find((v) => v.id === rawId);
        if (target) {
          setSelected(target.id);
        }
      } else if (path.startsWith("/dashboard")) {
        setPage(tab || "Dashboard");
        setSelected(null);
      }
    };
    handlePopState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setRole, setPage, visits]);
  useEffect(() => {
    if (!selected && !editor) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeVisit();
        setEditor(null);
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [selected, editor]);

  const userGender =
    currentUser?.jenisKelamin ||
    (currentUser as any)?.gender ||
    "Laki-laki";
  const userPatientId =
    currentUser?.pasienId ||
    currentUser?.noRekamMedis ||
    (currentUser as any)?.patientId ||
    currentUser?.id ||
    "RM-00000";

  const defaultPatientFallback: Patient = {
    id: userPatientId,
    name: currentUser?.name || "Pasien",
    phone: currentUser?.telepon || "-",
    birth: currentUser?.tanggalLahir || "2000-01-01",
    gender: userGender,
    address: currentUser?.alamat || "-",
    emergency: currentUser?.kontakDarurat || "-",
    account: true,
    nik: currentUser?.nik || "-",
  };
  const matchedPatient =
    currentUser?.role === "Pasien"
      ? patients.find(
          (p) =>
            p.id === userPatientId ||
            (currentUser.id && p.id === currentUser.id) ||
            (currentUser.pasienId && p.id === currentUser.pasienId) ||
            (currentUser.noRekamMedis && p.id === currentUser.noRekamMedis) ||
            (currentUser.name &&
              p.name.trim().toLowerCase() ===
                currentUser.name.trim().toLowerCase()),
        )
      : null;

  const patient: Patient =
    currentUser?.role === "Pasien"
      ? matchedPatient
        ? {
            ...matchedPatient,
            name: currentUser?.name || matchedPatient.name,
            phone:
              currentUser?.telepon && currentUser.telepon !== "-"
                ? currentUser.telepon
                : matchedPatient.phone,
            birth:
              currentUser?.tanggalLahir &&
              currentUser.tanggalLahir !== "2000-01-01"
                ? currentUser.tanggalLahir
                : matchedPatient.birth,
            gender:
              currentUser?.jenisKelamin ||
              (matchedPatient.gender && matchedPatient.gender !== "-"
                ? matchedPatient.gender
                : userGender),
            address:
              currentUser?.alamat && currentUser.alamat !== "-"
                ? currentUser.alamat
                : matchedPatient.address,
            emergency:
              currentUser?.kontakDarurat &&
              currentUser.kontakDarurat !== "-"
                ? currentUser.kontakDarurat
                : matchedPatient.emergency,
            nik: currentUser?.nik || matchedPatient.nik,
          }
        : defaultPatientFallback
      : patients[0] || defaultPatientFallback;

  const doctorName = (id: string) => {
    if (!id)
      return role === "Dokter"
        ? activeDoctor?.name || currentUser?.name || "dr. Reyhan Adhitama"
        : "Dokter";
    const found = doctors.find(
      (d) =>
        d.id === id || (id === "d1" && d.name.toLowerCase().includes("reyhan")),
    );
    if (found) return found.name;
    if (role === "Dokter")
      return activeDoctor?.name || currentUser?.name || "dr. Reyhan Adhitama";
    return "Dokter";
  };
  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name || "Layanan";
  const patientName = (id: string) =>
    patients.find((p) => p.id === id)?.name || "Pasien";
  const session = (id: string) => schedules.find((s) => s.id === id);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 4500);
  };
  const navigate = (target: string) => {
    setPage(target);
    setEditingProfile(false);
    setMobile(false);
    setSearch("");
    setFilter("");
    setDoctorFilter("");
    setServiceFilter("");
    setPagination(1);
    setStep(1);
    setReceipt(null);
    setError("");
    if (typeof window !== "undefined") {
      const publicRoutes: Record<string, string> = {
        Beranda: "/",
        Profil: "/profil",
        Layanan: "/layanan",
        Dokter: "/dokter",
        Jadwal: "/jadwal",
        Lokasi: "/lokasi",
        Login: "/login",
        Daftar: "/daftar",
        Registrasi: "/daftar",
      };
      const roleBasePaths: Record<Role, string> = {
        Publik: "/",
        Pasien: "/pasien",
        Petugas: "/petugas",
        Dokter: "/dokter-dashboard",
        Admin: "/admin",
      };

      let path: string;
      if (role === "Publik") {
        path = publicRoutes[target] || "/";
      } else {
        const basePath = roleBasePaths[role] || "/pasien";
        path =
          target === "Dashboard"
            ? basePath
            : `${basePath}?tab=${encodeURIComponent(target)}`;
      }

      const currentFullPath = window.location.pathname + window.location.search;
      if (currentFullPath !== path) {
        window.history.pushState(null, "", path);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const switchRole = (value: string) => {
    const nextRole = value as Role;
    setRole(nextRole);
    setSelected(null);
    setEditor(null);
    setBooking((b) => ({ ...b, patient: patients[0]?.id || "" }));
    if (typeof window !== "undefined") {
      const rolePaths: Record<Role, string> = {
        Publik: "/",
        Pasien: "/pasien",
        Petugas: "/petugas",
        Dokter: "/dokter-dashboard",
        Admin: "/admin",
      };
      const nextPath = rolePaths[nextRole] || "/";
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath);
      }
    }
    navigate(nextRole === "Publik" ? "Beranda" : "Dashboard");
  };
  const activeDoctor =
    (currentUser &&
      doctors.find(
        (d) => d.name.toLowerCase() === currentUser.name.toLowerCase(),
      )) ||
    doctors.find((d) => d.name.toLowerCase().includes("reyhan")) ||
    doctors[0];
  const activeDoctorId =
    activeDoctor?.id || "b9cd5971-4e73-4f8b-b0dd-0bc2ba064092";
  const formatQueue = (v: Visit) =>
    queueLabel(
      v,
      doctors.findIndex((d) => d.id === v.doctor),
    );

  const scoped = visits.filter((v) => {
    if (role === "Pasien") {
      const validIds = new Set(
        [
          patient.id,
          userPatientId,
          currentUser?.id,
          (currentUser as any)?.noRekamMedis,
        ].filter(Boolean),
      );
      return validIds.has(v.patient);
    }
    if (role === "Dokter") {
      return v.doctor === activeDoctorId;
    }
    return true;
  });
  const today = scoped.filter((v) => v.date === DEMO_DATE);
  const active = scoped.filter(
    (v) => !["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
  );
  const detail = scoped.find((v) => v.id === selected);
  const canMedical = role === "Dokter" || role === "Pasien";
  const openVisit = (v: Visit, syncUrl = true) => {
    setSelected(v.id);
    setError("");
    setReason("");
    setSavedExam(Boolean(v.examination));
    setExam(
      v.examination
        ? {
            ...structuredClone(v.examination),
            height: v.examination.height || "",
          }
        : {
            anamnesis: v.complaint,
            pressure: "",
            temperature: "",
            weight: "",
            height: "",
            diagnosis: "",
            notes: "",
            actions: [],
          },
    );
    if (syncUrl && typeof window !== "undefined") {
      const prefix =
        page === "Riwayat Kunjungan" || page === "Rekap Kunjungan"
          ? "/riwayat"
          : "/kunjungan";
      const nextPath = `${prefix}/${encodeURIComponent(v.id)}`;
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath);
      }
    }
  };
  const closeVisit = () => {
    setSelected(null);
    if (
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/riwayat/") ||
        window.location.pathname.startsWith("/kunjungan/"))
    ) {
      const roleBasePaths: Record<Role, string> = {
        Publik: "/",
        Pasien: "/pasien",
        Petugas: "/petugas",
        Dokter: "/dokter-dashboard",
        Admin: "/admin",
      };
      const basePath = roleBasePaths[role] || "/pasien";
      const restorePath =
        page === "Dashboard"
          ? basePath
          : `${basePath}?tab=${encodeURIComponent(page)}`;
      window.history.pushState(null, "", restorePath);
    }
  };
  useEffect(() => {
    if (role === "Publik") return;
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const urlId = path.startsWith("/riwayat/")
      ? decodeURIComponent(path.slice("/riwayat/".length))
      : path.startsWith("/kunjungan/")
        ? decodeURIComponent(path.slice("/kunjungan/".length))
        : "";
    const targetId = urlId || initialDetailId || "";
    if (!targetId || lastAutoOpenedVisitId.current === targetId) return;
    const matched = scoped.find((v) => v.id === targetId);
    if (matched) {
      lastAutoOpenedVisitId.current = targetId;
      openVisit(matched, false);
    }
  }, [initialDetailId, visits, role]);
  const updateVisit = (id: string, changes: Partial<Visit>) =>
    setVisits((previous) =>
      previous.map((v) => (v.id === id ? { ...v, ...changes } : v)),
    );
  useEffect(() => {
    if (typeof window !== "undefined") {
      const flash = sessionStorage.getItem("sehatklinik_flash");
      if (flash) {
        sessionStorage.removeItem("sehatklinik_flash");
        setToast(flash);
        const t = setTimeout(() => setToast(""), 4500);
        return () => clearTimeout(t);
      }
    }
  }, [setToast]);

  const showError = error && (
    <div className="ws-error" role="alert">
      <Icon name="help" size={18} />
      {getErrorMessage(error)}
    </div>
  );
  const showEditor = (type: string, id?: string) => {
    setEditor({ type, id });
    setError("");
    setDoctorPhotoError("");
    if (type === "Dokter" && id) {
      setDoctorPhoto(doctors.find((d) => d.id === id)?.photoUrl || "");
    } else {
      setDoctorPhoto("");
    }
  };
  const paginateList = <T,>(items: T[], perPage = 6) => {
    const maxPage = Math.max(1, Math.ceil(items.length / perPage));
    const current = Math.min(pagination, maxPage);
    const paged = items.slice((current - 1) * perPage, current * perPage);
    return { paged, current, maxPage };
  };
  const renderPaginationBar = (
    total: number,
    shown: number,
    label: string,
    maxPage: number,
    current: number,
  ) => (
    <div className="pagination">
      <span>
        Menampilkan {shown} dari {total} {label}
      </span>
      <div>
        <button
          type="button"
          aria-label="Halaman sebelumnya"
          disabled={current === 1}
          onClick={() => setPagination(current - 1)}
        >
          ‹
        </button>
        {Array.from({ length: maxPage }, (_, i) => i + 1).map((n) => (
          <button
            type="button"
            key={n}
            className={current === n ? "active" : ""}
            onClick={() => setPagination(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          aria-label="Halaman berikutnya"
          disabled={current === maxPage}
          onClick={() => setPagination(current + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
  const webPushBanner = (audience: "Pasien" | "Petugas") => {
    const stateClass =
      webPushPermission === "granted"
        ? "is-granted"
        : webPushPermission === "denied"
          ? "is-denied"
          : webPushPermission === "unsupported"
            ? "is-unsupported"
            : "";
    return (
      <section
        className={`ws-push-banner ${stateClass}`}
        aria-label="Status notifikasi Web Push"
      >
        <div className="ws-push-info">
          <span
            className={`icon-tile ${
              webPushPermission === "granted"
                ? "green"
                : webPushPermission === "denied"
                  ? "amber"
                  : webPushPermission === "unsupported"
                    ? "teal"
                    : "blue"
            }`}
          >
            <Icon
              name={
                webPushPermission === "denied" ||
                webPushPermission === "unsupported"
                  ? "help"
                  : "bell"
              }
              size={18}
            />
          </span>
          <div>
            {webPushPermission === "granted" ? (
              <>
                <h4>Notifikasi Web Push Aktif</h4>
                <p>
                  Browser Anda telah mengizinkan notifikasi. Pembaruan antrean{" "}
                  {audience === "Petugas"
                    ? "dan pendaftaran pasien baru"
                    : "dan status kunjungan Anda"}{" "}
                  akan dikirim secara langsung.
                </p>
              </>
            ) : webPushPermission === "denied" ? (
              <>
                <h4>Izin Notifikasi Ditolak Browser</h4>
                <p>
                  Browser memblokir notifikasi untuk situs ini. Untuk
                  mengaktifkan ulang: klik ikon gembok/pengaturan situs di kiri
                  bilah alamat browser → buka <b>Izin Situs</b> → ubah{" "}
                  <b>Notifikasi</b> menjadi <b>Izinkan</b>, lalu muat ulang
                  halaman.
                </p>
              </>
            ) : webPushPermission === "unsupported" ? (
              <>
                <h4>Browser Tidak Mendukung Push / Service Worker</h4>
                <p>
                  Perangkat atau mode peramban ini tidak mendukung Notification
                  API, Service Worker, atau Push Manager. Anda tetap dapat
                  memantau notifikasi dari ikon lonceng di bilah atas.
                </p>
              </>
            ) : (
              <>
                <h4>
                  {audience === "Petugas"
                    ? "Aktifkan Notifikasi Pendaftaran & Antrean"
                    : "Aktifkan Notifikasi Panggilan Antrean"}
                </h4>
                <p>
                  {audience === "Petugas"
                    ? "Terima peringatan real-time saat pendaftaran baru masuk atau status kunjungan berubah."
                    : "Dapatkan pemberitahuan real-time saat nomor antrean Anda dipanggil ke ruang periksa."}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="ws-push-actions">
          {webPushPermission === "default" && (
            <button
              type="button"
              className="primary"
              onClick={() => requestWebPushPermission()}
            >
              <Icon name="bell" size={16} />
              Aktifkan Notifikasi
            </button>
          )}
          {webPushPermission === "granted" && (
            <span className="ws-push-badge">Izin Diberikan · Aktif</span>
          )}
          {webPushPermission === "denied" && (
            <span className="ws-push-badge is-denied">Izin Diblokir</span>
          )}
          {webPushPermission === "unsupported" && (
            <span className="ws-push-badge is-unsupported">
              Push / SW Tidak Didukung
            </span>
          )}
        </div>
      </section>
    );
  };
  const statCards = (
    items: {
      title: string;
      value: number;
      icon: string;
      sub: string;
      color: string;
    }[],
  ) =>
    loadingData ? (
      <div
        className="ws-skeleton-grid"
        aria-busy="true"
        aria-label="Memuat ringkasan data"
      >
        {[0, 1, 2, 3].map((idx) => (
          <div className="ws-skeleton-card" key={idx}>
            <div className="ws-skeleton ws-skeleton-line short" />
            <div className="ws-skeleton ws-skeleton-line tall" />
            <div className="ws-skeleton ws-skeleton-line" />
          </div>
        ))}
      </div>
    ) : (
      <div className="stats">
        {items.map((s) => (
          <section className="stat" key={s.title}>
            <div className="stat-top">
              <span>{s.title}</span>
              <span className={`icon-tile ${s.color}`}>
                <Icon name={s.icon} />
              </span>
            </div>
            <div className="stat-value">
              {s.value.toString().padStart(2, "0")}
            </div>
            <div className="stat-bottom">{s.sub}</div>
          </section>
        ))}
      </div>
    );
  const matchVisitFilter = (v: Visit, useReportRange: boolean) => {
    const patientObj = patients.find((p) => p.id === v.patient);
    const searchTarget =
      role === "Pasien"
        ? `${doctorName(v.doctor)} ${serviceName(v.service)} ${v.id}`
        : `${patientName(v.patient)} ${patientObj?.nik || ""} ${doctorName(v.doctor)} ${serviceName(v.service)} ${v.id}`;
    return (
      searchTarget.toLowerCase().includes(search.toLowerCase()) &&
      (!filter || v.queue === filter) &&
      (!doctorFilter || v.doctor === doctorFilter) &&
      (!serviceFilter || v.service === serviceFilter) &&
      (!useReportRange ||
        reportAllDates ||
        ((!range.from || v.date >= range.from) &&
          (!range.to || v.date <= range.to)))
    );
  };
  const exportRekapExcel = async (itemsToExport: Visit[]) => {
    if (!itemsToExport.length) {
      notify("Tidak ada data kunjungan untuk diunduh pada filter saat ini.");
      return;
    }
    const periodLabel = reportAllDates
      ? "Semua Tanggal"
      : `${range.from ? dateLabel(range.from) : "Awal"} s/d ${range.to ? dateLabel(range.to) : "Akhir"}`;
    const fileSuffix = reportAllDates
      ? "Semua-Tanggal"
      : `${range.from || "awal"}-sd-${range.to || "akhir"}`;
    try {
      await downloadRekapExcel({
        visits: itemsToExport,
        patients,
        doctors,
        services,
        clinic,
        periodLabel,
        sortOrder: reportSortOrder,
        fileSuffix,
      });
      notify(
        `File Excel rekap (${itemsToExport.length} kunjungan) berhasil diunduh.`,
      );
    } catch {
      notify("Gagal membuat file Excel. Silakan coba kembali.");
    }
  };
  const statScope =
    role === "Admin"
      ? page === "Rekap Kunjungan"
        ? scoped.filter((v) => matchVisitFilter(v, true))
        : scoped
      : today;
  const stats = statCards([
    {
      title: role === "Admin" ? "Total kunjungan" : "Kunjungan hari ini",
      value: statScope.length,
      icon: "calendar",
      sub:
        role === "Admin"
          ? page === "Rekap Kunjungan"
            ? reportAllDates
              ? "Seluruh tanggal dan filter terpilih"
              : `Periode ${range.from || "awal"} s/d ${range.to || "akhir"}`
            : "Seluruh periode kunjungan"
          : todayFormatted || getTodayFormatted(),
      color: "blue",
    },
    {
      title: "Menunggu",
      value: statScope.filter((v) => v.queue === "Menunggu").length,
      icon: "clock",
      sub: "Terdaftar dan sudah hadir",
      color: "amber",
    },
    {
      title: "Selesai",
      value: statScope.filter((v) => v.queue === "Selesai").length,
      icon: "check",
      sub: "Kunjungan telah diselesaikan",
      color: "green",
    },
    {
      title: "Dibatalkan",
      value: statScope.filter((v) => v.status === "Dibatalkan").length,
      icon: "close",
      sub: "Tidak mengurangi sisa kuota",
      color: "red",
    },
  ]);
  const visitTable = (items: Visit[], title: string, report = false) => {
    const baseFiltered = items.filter((v) => matchVisitFilter(v, report));
    const filtered = report
      ? [...baseFiltered].sort((a, b) => {
          const cmp = a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
          return reportSortOrder === "asc" ? cmp : -cmp;
        })
      : baseFiltered;
    const maxPage = Math.max(1, Math.ceil(filtered.length / 6));
    const current = Math.min(pagination, maxPage);
    return (
      <section className="panel queue-panel">
        <div className="panel-heading">
          <div>
            <h3>
              {title}
              <span className="count">{filtered.length} kunjungan</span>
            </h3>
            <p>
              {role === "Admin"
                ? "Data administratif saja. Isi pemeriksaan tidak ditampilkan."
                : "Status kunjungan dan antrean ditampilkan secara terpisah."}
            </p>
          </div>
          {report ? (
            <button
              type="button"
              className="ws-excel-btn"
              onClick={() => exportRekapExcel(filtered)}
            >
              <Icon name="download" size={16} />
              Unduh Excel (.xlsx)
            </button>
          ) : (
            <Icon name="file" size={18} />
          )}
        </div>
        {report && (
          <div className="ws-report-range">
            <div className="ws-report-mode">
              <button
                type="button"
                className={reportAllDates ? "primary" : "secondary"}
                onClick={() => {
                  setReportAllDates(true);
                  setPagination(1);
                }}
              >
                Semua Tanggal
              </button>
              <button
                type="button"
                className={!reportAllDates ? "primary" : "secondary"}
                onClick={() => {
                  setReportAllDates(false);
                  if (!range.from || !range.to) {
                    const todayStr = getTodayISODate();
                    const firstDayOfMonth = `${todayStr.slice(0, 7)}-01`;
                    setRange({
                      from: range.from || firstDayOfMonth,
                      to: range.to || todayStr,
                    });
                  }
                  setPagination(1);
                }}
              >
                Pilih Rentang Tanggal
              </button>
            </div>
            <Field label="Dari tanggal">
              <input
                type="date"
                value={reportAllDates ? "" : range.from}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val && !range.to) {
                    setReportAllDates(true);
                    setRange({ ...range, from: "" });
                  } else {
                    setReportAllDates(false);
                    setRange({ ...range, from: val });
                  }
                  setPagination(1);
                }}
              />
            </Field>
            <Field label="Sampai tanggal">
              <input
                type="date"
                min={(!reportAllDates && range.from) || undefined}
                value={reportAllDates ? "" : range.to}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val && !range.from) {
                    setReportAllDates(true);
                    setRange({ ...range, to: "" });
                  } else {
                    setReportAllDates(false);
                    setRange({ ...range, to: val });
                  }
                  setPagination(1);
                }}
              />
            </Field>
            <Field label="Urutkan tanggal">
              <select
                aria-label="Urutan tanggal"
                value={reportSortOrder}
                onChange={(e) => {
                  setReportSortOrder(e.target.value as "desc" | "asc");
                  setPagination(1);
                }}
              >
                <option value="desc">Terbaru → Terlama</option>
                <option value="asc">Terlama → Terbaru</option>
              </select>
            </Field>
            <div className="ws-report-count">
              <b>{filtered.length}</b>
              <small>
                {reportAllDates
                  ? "total seluruh kunjungan"
                  : "kunjungan pada periode terpilih"}
              </small>
            </div>
          </div>
        )}
        <div className="table-tools">
          <div className="search">
            <Icon name="search" size={17} />
            <input
              aria-label="Cari kunjungan"
              placeholder={
                role === "Pasien"
                  ? "Cari dokter, layanan, atau referensi…"
                  : "Cari nama, NIK, atau referensi…"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination(1);
              }}
            />
          </div>
          <div className="filters">
            {role !== "Dokter" && (
              <select
                aria-label="Filter dokter"
                value={doctorFilter}
                onChange={(e) => {
                  setDoctorFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua dokter</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Filter layanan"
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPagination(1);
              }}
            >
              <option value="">Semua layanan</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter status antrean"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPagination(1);
              }}
            >
              <option value="">Semua status</option>
              {queueStates.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  report ? "Referensi" : "Antrean / Referensi",
                  ...(role !== "Pasien" ? ["Pasien"] : []),
                  "Dokter & layanan",
                  "Tanggal / Sumber",
                  "Kunjungan",
                  report ? "Status Pelayanan" : "Antrean",
                  "Detail",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingData
                ? Array.from({ length: 4 }, (_, idx) => (
                    <tr key={`skeleton-${idx}`}>
                      <td colSpan={role !== "Pasien" ? 7 : 6}>
                        <div className="ws-skeleton ws-skeleton-line" />
                      </td>
                    </tr>
                  ))
                : filtered.slice((current - 1) * 6, current * 6).map((v) => {
                    const patientObj = patients.find((p) => p.id === v.patient);
                    return (
                      <tr key={v.id}>
                        <td>
                          {report ? (
                            <b>{v.id}</b>
                          ) : (
                            <>
                              <span className="queue-number">
                                {formatQueue(v)}
                              </span>
                              <small>{v.id}</small>
                            </>
                          )}
                        </td>
                        {role !== "Pasien" && (
                          <td>
                            <div className="person">
                              <GenderAvatar
                                gender={patientObj?.gender}
                                name={patientName(v.patient)}
                              />
                              <div>
                                <b>{patientName(v.patient)}</b>
                                <small>
                                  {patientObj?.nik
                                    ? `NIK: ${patientObj.nik}`
                                    : patientObj?.gender || ""}
                                </small>
                              </div>
                            </div>
                          </td>
                        )}
                        <td>
                          <b>
                            {role === "Dokter"
                              ? activeDoctor?.name || doctorName(v.doctor)
                              : doctorName(v.doctor)}
                          </b>
                          <small>{serviceName(v.service)}</small>
                        </td>
                        <td>
                          {dateLabel(v.date)}
                          <small>{v.source}</small>
                        </td>
                        <td>
                          <Badge text={v.status} />
                        </td>
                        <td>
                          <Badge text={v.queue} />
                          {v.reason &&
                            ["Dibatalkan", "Dilewati"].includes(v.queue) && (
                              <small>{v.reason}</small>
                            )}
                        </td>
                        <td>
                          <button
                            className="square"
                            aria-label={`Detail ${v.id}`}
                            onClick={() => openVisit(v)}
                          >
                            <Icon name="arrow" size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!loadingData && !filtered.length && (
            <div className="empty">
              <Icon name="search" size={30} />
              <h3>Belum ada kunjungan yang cocok</h3>
              <p>Ubah pencarian atau filter untuk melihat data lainnya.</p>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length
              ? `${(current - 1) * 6 + 1}–${Math.min(current * 6, filtered.length)}`
              : "0"}{" "}
            dari {filtered.length} kunjungan
          </span>
          <div>
            <button
              aria-label="Halaman sebelumnya"
              disabled={current === 1}
              onClick={() => setPagination(current - 1)}
            >
              ‹
            </button>
            {Array.from({ length: maxPage }, (_, i) => (
              <button
                key={i}
                className={current === i + 1 ? "active" : ""}
                onClick={() => setPagination(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              aria-label="Halaman berikutnya"
              disabled={current === maxPage}
              onClick={() => setPagination(current + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </section>
    );
  };
  const schedulePanel = (() => {
    const targetDate = booking?.date || DEMO_DATE;
    const targetDay = new Date(`${targetDate}T12:00:00`).getDay();

    // Ambil jadwal aktif pada hari target
    const daySchedules = schedules.filter((s) => {
      if (s.active === false) return false;
      if (role === "Dokter" && s.doctor !== activeDoctorId) return false;
      if (s.day !== undefined && s.day !== null) {
        return s.day === targetDay;
      }
      return true;
    });

    // Kelompokkan per dokter agar tidak muncul ganda
    const groupedByDoctor = new Map<string, Schedule[]>();
    for (const s of daySchedules) {
      const list = groupedByDoctor.get(s.doctor) || [];
      list.push(s);
      groupedByDoctor.set(s.doctor, list);
    }

    return (
      <section className="panel ws-sessions">
        <div className="panel-heading">
          <div>
            <h3>Jadwal & ketersediaan</h3>
            <p suppressHydrationWarning>
              {formatDateIndonesian(targetDate, true)} · Kuota per sesi
            </p>
          </div>
          <Icon name="calendar" size={19} />
        </div>
        {groupedByDoctor.size === 0 ? (
          <div
            style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}
          >
            <p>Tidak ada jadwal praktik dokter pada hari ini.</p>
          </div>
        ) : (
          Array.from(groupedByDoctor.entries()).map(
            ([doctorId, docSessions]) => {
              // Jika dokter memiliki lebih dari 1 sesi jam di hari itu, buat 1 baris isinya jamnya saja
              const timeLabels = docSessions
                .map((s) => `${s.start} – ${s.end}`)
                .join(" · ");
              const totalQuota = docSessions.reduce(
                (sum, s) => sum + s.quota,
                0,
              );
              const totalLeft = docSessions.reduce(
                (sum, s) => sum + remaining(s, targetDate, visits),
                0,
              );

              return (
                <div className="ws-session" key={doctorId}>
                  <GenderAvatar name={doctorName(doctorId)} />
                  <div>
                    <b>{doctorName(doctorId)}</b>
                    <small>{timeLabels}</small>
                    <div className="ws-quota-track">
                      <span
                        style={{
                          width:
                            totalQuota > 0
                              ? `${((totalQuota - totalLeft) / totalQuota) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                  <span className={totalLeft ? "ws-quota" : "ws-quota full"}>
                    {totalLeft ? `${totalLeft}/${totalQuota} tersisa` : "Penuh"}
                  </span>
                </div>
              );
            },
          )
        )}
      </section>
    );
  })();
  const workflow = (
    <section className="panel ws-workflow">
      <div className="panel-heading">
        <div>
          <h3>Alur pelayanan klinik</h3>
          <p>Kunjungan tertib, informasi tetap terjaga.</p>
        </div>
      </div>
      <div className="ws-workflow-steps">
        {[
          ["Terdaftar", "Nomor antrean terbit", "calendar"],
          ["Hadir", "Check-in oleh petugas", "users"],
          ["Dipanggil", "Pasien menuju ruang", "bell"],
          ["Diperiksa", "Hanya oleh dokter", "heart"],
          ["Selesai", "Ringkasan untuk pasien", "check"],
        ].map((s, i) => (
          <div key={s[0]}>
            <span>
              <Icon name={s[2]} size={18} />
            </span>
            <b>{s[0]}</b>
            <small>{s[1]}</small>
            {i < 4 && <Icon name="arrow" size={14} />}
          </div>
        ))}
      </div>
    </section>
  );
  const patientCard = (v: Visit) => (
    <section className="panel ws-ticket" key={v.id}>
      <div className="panel-heading">
        <div>
          <h3>Nomor antrean Anda</h3>
          <p>{v.id}</p>
        </div>
        <Badge text={v.queue} />
      </div>
      <div className="ticket">{formatQueue(v)}</div>
      <div className="confirmation">
        <h3>{doctorName(v.doctor)}</h3>
        <p>
          {serviceName(v.service)} · {dateLabel(v.date)}
        </p>
        <p>
          {session(v.schedule)?.start} – {session(v.schedule)?.end} WIB
        </p>
        <div className="ws-ticket-meta">
          <span>
            Kunjungan <Badge text={v.status} />
          </span>
          <span>
            Pendaftaran <b>{v.source}</b>
          </span>
        </div>
        <div className="notice">
          <Icon name="clock" size={19} />
          {v.status === "Terdaftar"
            ? "Lakukan check-in di loket sebelum antrean dapat dipanggil."
            : v.queue === "Dipanggil"
              ? "Anda dipanggil. Silakan menuju ruang pemeriksaan."
              : v.queue === "Sedang Diperiksa"
                ? "Pemeriksaan Anda sedang berlangsung."
                : "Anda sudah check-in. Silakan menunggu panggilan."}
        </div>
        <ol className="patient-queue-progress" aria-label="Tahapan antrean">
          {["Terdaftar", "Check-in", "Dipanggil", "Diperiksa", "Selesai"].map(
            (label, index) => {
              const current =
                v.queue === "Sedang Diperiksa"
                  ? 3
                  : v.queue === "Dipanggil"
                    ? 2
                    : v.status === "Hadir"
                      ? 1
                      : 0;
              return (
                <li
                  key={label}
                  className={
                    index < current
                      ? "complete"
                      : index === current
                        ? "current"
                        : ""
                  }
                  aria-current={index === current ? "step" : undefined}
                >
                  <span>
                    {index < current ? (
                      <Icon name="check" size={15} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <small>{label}</small>
                </li>
              );
            },
          )}
        </ol>
        <button className="primary" onClick={() => openVisit(v)}>
          Lihat Detail Kunjungan
          <Icon name="arrow" size={16} />
        </button>
        {v.queue === "Menunggu" && (
          <button className="danger-link" onClick={() => openVisit(v)}>
            Batalkan kunjungan
          </button>
        )}
      </div>
    </section>
  );
  const patientDashboard = (
    <>
      <div className="patient-welcome">
        <div>
          <span className="eyebrow">RUANG SEHAT ANDA</span>
          <h2>Lebih mudah merawat diri.</h2>
          <p>
            Daftar kunjungan, pantau antrean, dan baca riwayat Anda di satu
            tempat.
          </p>
          <button
            className="primary"
            onClick={() => navigate("Pendaftaran Kunjungan")}
          >
            <Icon name="plus" size={17} />
            Daftar Kunjungan
          </button>
        </div>
        <Icon name="heart" size={115} />
      </div>
      {webPushBanner("Pasien")}
      {statCards([
        {
          title: "Seluruh kunjungan",
          value: scoped.length,
          icon: "calendar",
          sub: "Riwayat pelayanan Anda",
          color: "blue",
        },
        {
          title: "Kunjungan aktif",
          value: active.length,
          icon: "clock",
          sub: "Terdaftar atau sedang dilayani",
          color: "amber",
        },
        {
          title: "Kunjungan selesai",
          value: scoped.filter((v) => v.queue === "Selesai").length,
          icon: "check",
          sub: "Ringkasan tersedia di riwayat",
          color: "green",
        },
        {
          title: "Dibatalkan",
          value: scoped.filter((v) => v.queue === "Dibatalkan").length,
          icon: "close",
          sub: "Kunjungan yang dibatalkan",
          color: "red",
        },
      ])}
      <div className="patient-overview-grid">
        <section className="panel patient-next-visit">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RENCANA PERAWATAN</span>
              <h3>Kunjungan berikutnya</h3>
            </div>
            <Icon name="calendar" size={21} />
          </div>
          {active.length ? (
            (() => {
              const next = [...active].sort(
                (a, b) => a.date.localeCompare(b.date) || a.number - b.number,
              )[0];
              return (
                <div className="patient-panel-body">
                  <div className="patient-appointment-date">
                    <Icon name="calendar" size={22} />
                    <div>
                      <b>{dateLabel(next.date)}</b>
                      <small>
                        {session(next.schedule)?.start} –{" "}
                        {session(next.schedule)?.end} WIB
                      </small>
                    </div>
                    <Badge text={next.queue} />
                  </div>
                  <h2>{doctorName(next.doctor)}</h2>
                  <p className="muted">
                    {serviceName(next.service)} · {next.id}
                  </p>
                  <div className="notice">
                    <Icon name="help" size={19} />
                    {next.status === "Terdaftar"
                      ? "Kunjungan sudah terdaftar. Lakukan check-in di loket saat tiba di klinik."
                      : "Buka Antrean Saya untuk melihat tahapan pelayanan dan detail tiket Anda."}
                  </div>
                  <button
                    className="primary"
                    onClick={() => navigate("Antrean Saya")}
                  >
                    Pantau Antrean
                    <Icon name="arrow" size={17} />
                  </button>
                </div>
              );
            })()
          ) : (
            <div className="empty">
              <Icon name="calendar" size={30} />
              <h3>Belum ada kunjungan aktif</h3>
              <p>Atur waktu perawatan Anda melalui pendaftaran kunjungan.</p>
              <button
                className="primary"
                onClick={() => navigate("Pendaftaran Kunjungan")}
              >
                Daftar Kunjungan
              </button>
            </div>
          )}
        </section>
        <section className="panel patient-shortcuts">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">DALAM SATU RUANG</span>
              <h3>Akses cepat</h3>
            </div>
          </div>
          <div className="patient-panel-body">
            {[
              [
                "Pendaftaran Kunjungan",
                "calendar",
                "Daftar kunjungan",
                "Pilih layanan, dokter, dan sesi.",
              ],
              [
                "Antrean Saya",
                "clock",
                "Pantau antrean",
                "Lihat tiket dan tahapan pelayanan.",
              ],
              [
                "Profil Saya",
                "users",
                "Profil pribadi",
                "Lihat data diri dan kontak Anda.",
              ],
            ].map(([target, icon, label, description]) => (
              <button
                className="patient-shortcut"
                key={target}
                onClick={() => navigate(target)}
              >
                <span className="icon-tile blue">
                  <Icon name={icon} size={19} />
                </span>
                <span>
                  <b>{label}</b>
                  <small>{description}</small>
                </span>
                <Icon name="arrow" size={17} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="panel patient-recent-visits">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PERJALANAN SEHAT ANDA</span>
            <h3>Riwayat terakhir</h3>
          </div>
          <button
            className="text-button"
            onClick={() => navigate("Riwayat Kunjungan")}
          >
            Semua riwayat
            <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="patient-panel-body">
          {loadingData ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {[0, 1, 2].map((idx) => (
                <div
                  className="ws-skeleton ws-skeleton-line"
                  style={{ height: "42px" }}
                  key={idx}
                />
              ))}
            </div>
          ) : scoped.some((v) =>
              ["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
            ) ? (
            [...scoped]
              .filter((v) =>
                ["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
              )
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 3)
              .map((v) => (
                <button
                  className="patient-history-row"
                  key={v.id}
                  onClick={() => openVisit(v)}
                >
                  <span className="icon-tile blue">
                    <Icon name="file" size={19} />
                  </span>
                  <span>
                    <b>{serviceName(v.service)}</b>
                    <small>
                      {doctorName(v.doctor)} · {dateLabel(v.date)}
                    </small>
                  </span>
                  <Badge text={v.queue} />
                  <Icon name="arrow" size={17} />
                </button>
              ))
          ) : (
            <p className="muted">
              Riwayat akan tampil setelah Anda menjalani kunjungan.
            </p>
          )}
        </div>
      </section>
    </>
  );
  const patientQueue = (
    <div className="patient-queue-layout">
      <div className="patient-queue-tickets">
        {active.length ? (
          active.map(patientCard)
        ) : (
          <section className="panel empty">
            <Icon name="clock" size={34} />
            <h3>Tidak ada antrean aktif</h3>
            <p>
              Kunjungan yang selesai atau dibatalkan tersedia pada Riwayat
              Kunjungan.
            </p>
            <button
              className="primary"
              onClick={() => navigate("Pendaftaran Kunjungan")}
            >
              Daftar Kunjungan
            </button>
          </section>
        )}
      </div>
      <aside className="patient-queue-sidebar">
        <section className="panel patient-queue-guide">
          <span className="icon-tile blue">
            <Icon name="clock" size={23} />
          </span>
          <span className="eyebrow">PANDUAN ANTREAN</span>
          <h3>
            Datang lebih tenang,
            <br />
            ikuti setiap tahapnya.
          </h3>
          <ol>
            <li>
              <b>Tunjukkan bukti pendaftaran</b>
              <p>Bawa nomor referensi dan identitas Anda ke loket.</p>
            </li>
            <li>
              <b>Lakukan check-in</b>
              <p>
                Antrean baru dapat dipanggil setelah kehadiran dikonfirmasi
                petugas.
              </p>
            </li>
            <li>
              <b>Tunggu panggilan dokter</b>
              <p>Saat status Dipanggil, silakan menuju ruang pemeriksaan.</p>
            </li>
          </ol>
          <div className="notice">
            <Icon name="help" size={18} />
            Nomor antrean berlaku per dokter dan tanggal. Nomor berbeda dokter
            tidak dapat dibandingkan.
          </div>
          <p className="patient-queue-footnote">
            Pembatalan hanya tersedia sebelum dipanggil. Perubahan status
            mengikuti data simulasi pada sesi ini.
          </p>
        </section>
      </aside>
    </div>
  );
  const registration = (
    <div className="ws-booking-grid">
      <section className="panel form-panel">
        <div className="steps">
          {["Layanan & dokter", "Tanggal & sesi", "Konfirmasi"].map((s, i) => (
            <span key={s} className={step >= i + 1 ? "current" : ""}>
              <b>{i + 1}</b>
              {s}
            </span>
          ))}
        </div>
        {receipt ? (
          <div className="confirmation">
            <span className="success-icon">
              <Icon name="check" size={42} />
            </span>
            <h2>Pendaftaran berhasil</h2>
            <p>{receipt.id}</p>
            <div className="ticket">{formatQueue(receipt)}</div>
            <h3>{patientName(receipt.patient)}</h3>
            <p>
              {doctorName(receipt.doctor)} · {serviceName(receipt.service)}
            </p>
            <p>
              {dateLabel(receipt.date)} · {session(receipt.schedule)?.start} –{" "}
              {session(receipt.schedule)?.end}
            </p>
            <div className="component-row ws-center">
              <Badge text={receipt.status} />
              <Badge text={receipt.queue} />
            </div>
            <p>
              Simpan nomor referensi ini dan lakukan check-in saat tiba di
              klinik.
            </p>
            <button
              className="primary"
              onClick={() =>
                navigate(
                  role === "Petugas" ? "Antrean Hari Ini" : "Antrean Saya",
                )
              }
            >
              Lihat Antrean
              <Icon name="arrow" size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={submitBooking}>
            <span className="eyebrow">LANGKAH {step} DARI 3</span>
            <h3>
              {step === 1
                ? "Pilih perawatan yang Anda butuhkan"
                : step === 2
                  ? "Temukan waktu yang sesuai"
                  : "Periksa kembali kunjungan Anda"}
            </h3>
            <p className="muted">
              {role === "Petugas"
                ? "Pendaftaran walk-in menggunakan data pasien, tanpa memerlukan akun."
                : "Nomor antrean dibuat otomatis per dokter dan tanggal."}
            </p>
            {step === 1 ? (
              <>
                {role === "Petugas" && (
                  <>
                    <Field label="Pasien">
                      <select
                        value={booking.patient}
                        onChange={(e) =>
                          setBooking({ ...booking, patient: e.target.value })
                        }
                      >
                        {patients.length === 0 ? (
                          <option value="">Belum ada pasien terdaftar</option>
                        ) : (
                          patients.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.nik ? ` · NIK: ${p.nik}` : ""}
                              {!p.account ? " · Tanpa akun" : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </Field>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => showEditor("Pasien")}
                    >
                      + Catat pasien baru tanpa akun
                    </button>
                  </>
                )}
                <Field label="Layanan">
                  <select
                    value={booking.service}
                    onChange={(e) => {
                      const doctor = doctors.find(
                        (d) => d.active && d.services.includes(e.target.value),
                      );
                      setBooking({
                        ...booking,
                        service: e.target.value,
                        doctor: doctor?.id || "",
                        schedule: "",
                      });
                    }}
                  >
                    {services
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.duration} menit
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Dokter">
                  <select
                    required
                    value={booking.doctor}
                    onChange={(e) =>
                      setBooking({
                        ...booking,
                        doctor: e.target.value,
                        schedule: "",
                      })
                    }
                  >
                    <option value="">Pilih dokter</option>
                    {doctors
                      .filter(
                        (d) => d.active && d.services.includes(booking.service),
                      )
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Keluhan utama">
                  <textarea
                    required
                    maxLength={500}
                    placeholder="Ceritakan keluhan dan sejak kapan dirasakan…"
                    value={booking.complaint}
                    onChange={(e) =>
                      setBooking({ ...booking, complaint: e.target.value })
                    }
                  />
                </Field>
              </>
            ) : step === 2 ? (
              <>
                <Field label="Tanggal kunjungan">
                  <input
                    type="date"
                    required
                    min={DEMO_DATE}
                    value={booking.date}
                    onChange={(e) =>
                      setBooking({
                        ...booking,
                        date: e.target.value,
                        schedule: "",
                      })
                    }
                  />
                </Field>
                <Field label="Sesi praktik">
                  <select
                    required
                    value={booking.schedule}
                    onChange={(e) =>
                      setBooking({ ...booking, schedule: e.target.value })
                    }
                  >
                    <option value="">Pilih sesi praktik</option>
                    {schedules
                      .filter(
                        (s) =>
                          s.active &&
                          s.doctor === booking.doctor &&
                          s.day ===
                            new Date(`${booking.date}T12:00:00`).getDay(),
                      )
                      .map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={remaining(s, booking.date, visits) === 0}
                        >
                          {s.start} – {s.end} ·{" "}
                          {remaining(s, booking.date, visits)
                            ? `${remaining(s, booking.date, visits)} dari ${s.quota} kuota tersisa`
                            : "Penuh"}
                        </option>
                      ))}
                  </select>
                </Field>
                {!schedules.some(
                  (s) =>
                    s.active &&
                    s.doctor === booking.doctor &&
                    s.day === new Date(`${booking.date}T12:00:00`).getDay(),
                ) && (
                  <div className="notice">
                    Tidak ada sesi pada tanggal ini. Jadwal demo tersedia setiap
                    Senin.
                  </div>
                )}
                <div className="notice">
                  <Icon name="clock" />
                  Kuota penuh tidak dapat dipilih. Jadwal penuh dokter lain juga
                  ditampilkan pada panel ketersediaan.
                </div>
              </>
            ) : (
              <div className="ws-summary">
                <div>
                  <span>Pasien</span>
                  <b>{patientName(booking.patient)}</b>
                </div>
                <div>
                  <span>Layanan</span>
                  <b>{serviceName(booking.service)}</b>
                </div>
                <div>
                  <span>Dokter</span>
                  <b>{doctorName(booking.doctor)}</b>
                </div>
                <div>
                  <span>Jadwal</span>
                  <b>
                    {dateLabel(booking.date)}
                    <small>
                      {session(booking.schedule)?.start} –{" "}
                      {session(booking.schedule)?.end} WIB
                    </small>
                  </b>
                </div>
                <div>
                  <span>Keluhan</span>
                  <b>{booking.complaint}</b>
                </div>
                <div>
                  <span>Sumber</span>
                  <b>{role === "Petugas" ? "Walk-in" : "Online"}</b>
                </div>
                <div className="notice">
                  <Icon name="shield" size={18} />
                  Kunjungan aktif ganda pada sesi yang sama tidak diperbolehkan.
                </div>
              </div>
            )}
            {showError}
            <div className="form-actions">
              {step > 1 && (
                <button
                  className="secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  Kembali
                </button>
              )}
              <button className="primary" disabled={busy} type="submit">
                {busy
                  ? "Menyimpan pendaftaran..."
                  : step === 3
                    ? "Konfirmasi Pendaftaran"
                    : "Lanjutkan"}
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        )}
      </section>
      <div>
        {schedulePanel}
        <div className="notice" suppressHydrationWarning>
          <Icon name="help" size={20} />
          Jadwal praktik dan ketersediaan kuota diperbarui secara real-time
          untuk hari ini ({todayFormatted || getTodayFormatted()}).
        </div>
      </div>
    </div>
  );
  const saveEditor = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editor || busy) return;
    const data = new FormData(e.currentTarget);
    const get = (key: string) => String(data.get(key) || "").trim();
    const active = get("active") !== "Nonaktif";
    setBusy(true);
    try {
      if (editor.type === "Pasien") {
        const value: Patient = {
          id:
            editor.id || `RM-${String(128 + patients.length).padStart(5, "0")}`,
          name: get("name"),
          phone: get("phone"),
          birth: get("birth"),
          gender: get("gender"),
          address: get("address"),
          emergency: get("emergency"),
          account: false,
        };
        setPatients((p) =>
          editor.id
            ? p.map((item) =>
                item.id === editor.id
                  ? { ...value, account: item.account }
                  : item,
              )
            : [...p, value],
        );
        if (!editor.id) setBooking((b) => ({ ...b, patient: value.id }));
      } else if (editor.type === "Dokter") {
        if (doctorPhotoError) {
          setError(doctorPhotoError);
          return;
        }
        if (doctors.some((d) => d.sip === get("sip") && d.id !== editor.id)) {
          setError("Nomor SIP sudah terdaftar.");
          return;
        }
        const linked = data.getAll("services").map(String);
        if (!linked.length) {
          setError("Pilih setidaknya satu layanan untuk dokter.");
          return;
        }
        const existingDoc = editor.id
          ? doctors.find((item) => item.id === editor.id)
          : null;
        const value: Doctor = {
          id: editor.id || `d${Date.now()}`,
          name: get("name"),
          specialty: get("specialty"),
          sip: get("sip"),
          str: existingDoc?.str || "31.1.2.100.1.24.999888",
          services: linked,
          active,
          photoUrl: doctorPhoto || undefined,
          education: existingDoc?.education || [
            {
              degree: "Pendidikan Dokter & Profesi",
              institution: "Fakultas Kedokteran",
              year: "2018",
            },
          ],
          experienceYears: existingDoc?.experienceYears || 5,
          almamater: existingDoc?.almamater || "Universitas Indonesia",
          certifications: existingDoc?.certifications || [
            "Sertifikasi Kompetensi Klinis IDI",
          ],
          bio:
            existingDoc?.bio || "Dokter berdedikasi melayani pasien keluarga.",
        };
        setDoctors((d) =>
          editor.id
            ? d.map((item) => (item.id === editor.id ? value : item))
            : [...d, value],
        );
      } else if (editor.type === "Layanan") {
        if (
          services.some(
            (s) =>
              s.name.toLowerCase() === get("name").toLowerCase() &&
              s.id !== editor.id,
          )
        ) {
          setError("Nama layanan sudah digunakan.");
          return;
        }
        const existingSrv = editor.id
          ? services.find((item) => item.id === editor.id)
          : null;
        const value: Service = {
          id: editor.id || `s${Date.now()}`,
          name: get("name"),
          description: get("description"),
          duration: Number(get("duration")),
          active,
          overview: existingSrv?.overview || get("description"),
          steps: existingSrv?.steps || [
            {
              step: 1,
              title: "Skrining Awal",
              description: "Pemeriksaan tanda vital",
            },
            {
              step: 2,
              title: "Anamnesis",
              description: "Konsultasi keluhan pasien",
            },
            {
              step: 3,
              title: "Pemeriksaan Fisik",
              description: "Pemeriksaan organ terarah",
            },
            {
              step: 4,
              title: "Edukasi & Terapi",
              description: "Penetapan resep dan rencana kontrol",
            },
          ],
          cases: existingSrv?.cases || ["Pemeriksaan keluhan medis umum"],
          facilities: existingSrv?.facilities || [
            "Peralatan diagnostik medis terstandar",
          ],
          preparation:
            existingSrv?.preparation || "Membawa kartu identitas resmi.",
        };
        setServices((s) =>
          editor.id
            ? s.map((item) => (item.id === editor.id ? value : item))
            : [...s, value],
        );
      } else if (editor.type === "Jadwal") {
        if (get("start") >= get("end")) {
          setError("Jam selesai harus setelah jam mulai.");
          return;
        }
        if (
          active &&
          schedules.some(
            (s) =>
              s.id !== editor.id &&
              s.active &&
              s.doctor === get("doctor") &&
              s.day === Number(get("day")) &&
              s.start < get("end") &&
              s.end > get("start"),
          )
        ) {
          setError("Jadwal bentrok dengan sesi aktif dokter yang sama.");
          return;
        }
        const value = {
          id: editor.id || `j${Date.now()}`,
          doctor: get("doctor"),
          day: Number(get("day")),
          start: get("start"),
          end: get("end"),
          quota: Number(get("quota")),
          active,
        };
        setSchedules((s) =>
          editor.id
            ? s.map((item) => (item.id === editor.id ? value : item))
            : [...s, value],
        );
      } else if (editor.type === "Pengguna") {
        if (users.some((u) => u.email === get("email"))) {
          setError("Email sudah digunakan.");
          return;
        }
        const newStaffName = get("name");
        const newStaffRole = get("role");
        setUsers((u) => [
          ...u,
          {
            name: newStaffName,
            email: get("email"),
            role: newStaffRole,
            active: true,
            password: get("password") || "password123",
          },
        ]);
        setEditor(null);
        setError("");
        notify(
          `Akun staf ${newStaffName} (${newStaffRole}) berhasil didaftarkan. Pengguna kini dapat login ke dashboard ${newStaffRole}.`,
        );
        return;
      }
      setEditor(null);
      setError("");
      notify(
        "Data demo berhasil diperbarui. Perubahan hanya berlaku selama sesi ini.",
      );
    } finally {
      setBusy(false);
    }
  };
  const editRecord =
    editor?.type === "Dokter" ? doctors.find((d) => d.id === editor.id) : null;
  const editService =
    editor?.type === "Layanan"
      ? services.find((s) => s.id === editor.id)
      : null;
  const editSchedule =
    editor?.type === "Jadwal"
      ? schedules.find((s) => s.id === editor.id)
      : null;
  const editPatient =
    editor?.type === "Pasien" ? patients.find((p) => p.id === editor.id) : null;
  const management = () => {
    if (page === "Pendaftaran Kunjungan" || page === "Pendaftaran Walk-in")
      return registration;
    if (page === "Antrean Saya" && role === "Pasien") return patientQueue;
    if (page === "Antrean Hari Ini" || page === "Antrean Saya")
      return visitTable(
        today,
        role === "Dokter" ? "Antrean dokter Anda hari ini" : "Antrean hari ini",
      );
    if (page === "Riwayat Kunjungan" || page === "Riwayat Pasien")
      return visitTable(
        scoped.filter((v) =>
          ["Selesai", "Dibatalkan", "Dilewati"].includes(v.queue),
        ),
        role === "Pasien"
          ? "Riwayat kunjungan Anda"
          : "Riwayat pasien yang Anda tangani",
      );
    if (page === "Rekap Kunjungan") {
      const dateMap = new Map<string, number>();
      for (const v of statScope) {
        dateMap.set(v.date, (dateMap.get(v.date) || 0) + 1);
      }
      const trendDates = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-10);
      const maxTrend = Math.max(...trendDates.map(([, count]) => count), 1);
      const doneCount = statScope.filter((v) => v.queue === "Selesai").length;
      const cancelledCount = statScope.filter((v) =>
        ["Dibatalkan", "Dilewati"].includes(v.queue),
      ).length;
      const onlineCount = statScope.filter((v) => v.source === "Online").length;
      const walkinCount = statScope.length - onlineCount;
      return (
        <>
          {stats}
          {!loadingData && (
            <div className="report-charts">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Grafik Tren Kunjungan</h3>
                    <p>
                      Distribusi harian kunjungan (
                      {reportAllDates
                        ? "seluruh periode"
                        : `${range.from || "awal"} s/d ${range.to || "akhir"}`}
                      )
                    </p>
                  </div>
                  <Icon name="chart" size={18} />
                </div>
                {trendDates.length ? (
                  <div
                    className="ws-trend-bars"
                    role="img"
                    aria-label="Grafik batang tren kunjungan per tanggal"
                  >
                    {trendDates.map(([dateKey, count]) => {
                      const pct = Math.max(
                        8,
                        Math.round((count / maxTrend) * 100),
                      );
                      const parts = dateKey.split("-");
                      const shortDate =
                        parts.length === 3
                          ? `${parts[2]}/${parts[1]}`
                          : dateKey;
                      return (
                        <div
                          className="ws-trend-col"
                          key={dateKey}
                          title={`${dateLabel(dateKey)}: ${count} kunjungan`}
                        >
                          <span className="ws-trend-count">{count}</span>
                          <div className="ws-trend-track">
                            <span
                              className="ws-trend-fill"
                              style={{ height: `${pct}%` }}
                            />
                          </div>
                          <span className="ws-trend-label">{shortDate}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty" style={{ padding: "28px" }}>
                    <Icon name="chart" size={26} />
                    <p>Belum ada kunjungan pada rentang tanggal ini.</p>
                  </div>
                )}
                <div className="ws-trend-legend">
                  <span>
                    Selesai: <b>{doneCount}</b>
                  </span>
                  <span>
                    Aktif / Antrean:{" "}
                    <b>
                      {Math.max(
                        0,
                        statScope.length - doneCount - cancelledCount,
                      )}
                    </b>
                  </span>
                  <span>
                    Batal / Lewat: <b>{cancelledCount}</b>
                  </span>
                </div>
              </section>
              <section className="panel ws-distribution">
                <div className="panel-heading">
                  <div>
                    <h3>Distribusi Layanan & Sumber</h3>
                    <p>{statScope.length} kunjungan pada cakupan periode</p>
                  </div>
                  <Icon name="heart" size={18} />
                </div>
                {services.map((s) => {
                  const count = statScope.filter(
                    (v) => v.service === s.id,
                  ).length;
                  return (
                    <div className="ws-distribution-row" key={s.id}>
                      <div>
                        <span>{s.name}</span>
                        <b>
                          {count} <small>kunjungan</small>
                        </b>
                      </div>
                      <div className="ws-quota-track">
                        <span
                          style={{
                            width: `${(count / Math.max(statScope.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div
                  className="ws-trend-legend"
                  style={{ paddingInline: 0, paddingBottom: 0 }}
                >
                  <span>
                    Online: <b>{onlineCount}</b>
                  </span>
                  <span>
                    Walk-in: <b>{walkinCount}</b>
                  </span>
                </div>
              </section>
            </div>
          )}
          {visitTable(scoped, "Rekap administratif kunjungan", true)}
        </>
      );
    }
    if (page === "Data Pasien") {
      const list = patients.filter(
        (p) =>
          (!filter || (filter === "Berakun" ? p.account : !p.account)) &&
          `${p.name} ${p.id} ${p.nik || ""} ${p.phone}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
      const { paged: pagedPatients, current, maxPage } = paginateList(list, 6);
      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>
                Data pasien <span className="count">{list.length} pasien</span>
              </h3>
              <p>Pasien berakun maupun walk-in. Tanpa akses isi pemeriksaan.</p>
            </div>
          </div>
          <div className="table-tools">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                placeholder="Cari nama, NIK, atau telepon…"
                aria-label="Cari pasien"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(1);
                }}
              />
            </div>
            <div className="filters">
              <select
                aria-label="Filter tipe pasien"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua tipe</option>
                <option value="Berakun">Berakun</option>
                <option value="Walk-in">Walk-in · Tanpa akun</option>
              </select>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pasien</th>
                  <th>NIK</th>
                  <th>Telepon</th>
                  <th>Tipe pasien</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loadingData
                  ? Array.from({ length: 4 }, (_, idx) => (
                      <tr key={`pasien-skel-${idx}`}>
                        <td colSpan={5}>
                          <div className="ws-skeleton ws-skeleton-line" />
                        </td>
                      </tr>
                    ))
                  : pagedPatients.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <b>{p.name}</b>
                          <small>{p.gender}</small>
                        </td>
                        <td>{p.nik || "-"}</td>
                        <td>{p.phone}</td>
                        <td>
                          <Badge
                            text={
                              p.account ? "Berakun" : "Walk-in · Tanpa akun"
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => showEditor("Pasien", p.id)}
                          >
                            Edit administrasi
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!loadingData && !list.length && (
              <div className="empty">
                Pasien tidak ditemukan. Anda dapat mencatat pasien baru.
              </div>
            )}
          </div>
          {renderPaginationBar(
            list.length,
            pagedPatients.length,
            "pasien",
            maxPage,
            current,
          )}
        </section>
      );
    }
    if (page === "Data Dokter") {
      const list = doctors.filter(
        (d) =>
          (!filter || (filter === "Aktif" ? d.active : !d.active)) &&
          `${d.name} ${d.specialty} ${d.sip}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
      const { paged: pagedDoctors, current, maxPage } = paginateList(list, 6);
      return (
        <>
          <div className="section-toolbar">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                aria-label="Cari dokter"
                placeholder="Cari dokter, spesialisasi, atau SIP…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(1);
                }}
              />
            </div>
            <div className="filters">
              <select
                aria-label="Filter status dokter"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>
            <button className="primary" onClick={() => showEditor("Dokter")}>
              <Icon name="plus" size={16} />
              Tambah Dokter
            </button>
          </div>
          {loadingData ? (
            <div className="doctor-cards" aria-busy="true">
              {[0, 1, 2].map((idx) => (
                <section
                  className="panel doctor-card ws-skeleton-card"
                  key={idx}
                >
                  <div className="ws-skeleton ws-skeleton-line short" />
                  <div className="ws-skeleton ws-skeleton-line tall" />
                  <div className="ws-skeleton ws-skeleton-line" />
                </section>
              ))}
            </div>
          ) : pagedDoctors.length ? (
            <div className="doctor-cards">
              {pagedDoctors.map((d) => (
                <section className="panel doctor-card" key={d.id}>
                  {d.photoUrl ? (
                    <div className="avatar large">
                      <img
                        src={d.photoUrl}
                        alt={d.name}
                        className="ws-doctor-photo"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          const isFemale =
                            /nadira|annisa|alea|siti|putri|sarah|maya/i.test(
                              d.name,
                            );
                          target.src = isFemale
                            ? "/images/avatar-female.jpg"
                            : "/images/avatar-male.jpg";
                        }}
                      />
                    </div>
                  ) : (
                    <GenderAvatar size="large" name={d.name} />
                  )}
                  <Badge text={d.active ? "Aktif" : "Nonaktif"} />
                  <h3>{d.name}</h3>
                  <p>{d.specialty}</p>

                  {/* Riwayat Pendidikan Dokter */}
                  <div
                    className="doctor-edu-preview"
                    style={{ margin: "8px 0" }}
                  >
                    <span className="doctor-almamater-pill">
                      <Icon name="education" size={13} />
                      {d.almamater}
                    </span>
                    <small
                      style={{
                        display: "block",
                        color: "#64748b",
                        fontSize: "10.5px",
                      }}
                    >
                      {d.education?.[0]?.degree || "Pendidikan Dokter"} ·{" "}
                      {d.experienceYears}+ Thn Pengalaman
                    </small>
                    <small
                      style={{
                        display: "block",
                        color: "#94a3b8",
                        fontSize: "10px",
                        marginTop: "2px",
                      }}
                    >
                      STR: {d.str} · SIP: {d.sip}
                    </small>
                  </div>

                  <div className="ws-tags">
                    {d.services.map((s) => (
                      <span key={s}>{serviceName(s)}</span>
                    ))}
                  </div>
                  <button
                    className="secondary"
                    onClick={() => showEditor("Dokter", d.id)}
                  >
                    Edit Dokter & Pendidikan
                    <Icon name="arrow" size={15} />
                  </button>
                </section>
              ))}
            </div>
          ) : (
            <div className="panel empty">Dokter tidak ditemukan.</div>
          )}
          <section className="panel" style={{ marginTop: "18px" }}>
            {renderPaginationBar(
              list.length,
              pagedDoctors.length,
              "dokter",
              maxPage,
              current,
            )}
          </section>
        </>
      );
    }
    if (page === "Data Layanan") {
      const list = services.filter(
        (s) =>
          (!filter || (filter === "Aktif" ? s.active : !s.active)) &&
          `${s.name} ${s.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
      const { paged: pagedServices, current, maxPage } = paginateList(list, 6);
      return (
        <>
          <div className="section-toolbar">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                aria-label="Cari layanan"
                placeholder="Cari nama atau deskripsi layanan…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(1);
                }}
              />
            </div>
            <div className="filters">
              <select
                aria-label="Filter status layanan"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>
            <button className="primary" onClick={() => showEditor("Layanan")}>
              <Icon name="plus" size={16} />
              Tambah Layanan
            </button>
          </div>
          {loadingData ? (
            <div className="doctor-cards" aria-busy="true">
              {[0, 1, 2].map((idx) => (
                <section
                  className="panel doctor-card ws-skeleton-card"
                  key={idx}
                >
                  <div className="ws-skeleton ws-skeleton-line short" />
                  <div className="ws-skeleton ws-skeleton-line tall" />
                  <div className="ws-skeleton ws-skeleton-line" />
                </section>
              ))}
            </div>
          ) : pagedServices.length ? (
            <div className="doctor-cards">
              {pagedServices.map((s) => (
                <section className="panel doctor-card" key={s.id}>
                  <span className="icon-tile blue">
                    <Icon name="heart" size={25} />
                  </span>
                  <Badge text={s.active ? "Aktif" : "Nonaktif"} />
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <p>
                    <Icon name="clock" size={15} />
                    {s.duration} menit per kunjungan
                  </p>

                  {/* 4 Tahapan Alur Pelayanan */}
                  {s.steps && s.steps.length > 0 && (
                    <div
                      style={{
                        margin: "10px 0",
                        padding: "8px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #edf2f7",
                      }}
                    >
                      <small
                        style={{
                          fontWeight: 600,
                          color: "#1e40af",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Alur Pelayanan (4 Tahap):
                      </small>
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        {s.steps.map((st) => (
                          <span
                            key={st.step}
                            style={{
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "9px",
                            }}
                          >
                            {st.step}. {st.title.split(" ")[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="secondary"
                    onClick={() => showEditor("Layanan", s.id)}
                  >
                    Edit Layanan & Alur
                  </button>
                </section>
              ))}
            </div>
          ) : (
            <div className="panel empty">Layanan tidak ditemukan.</div>
          )}
          <section className="panel" style={{ marginTop: "18px" }}>
            {renderPaginationBar(
              list.length,
              pagedServices.length,
              "layanan",
              maxPage,
              current,
            )}
          </section>
        </>
      );
    }
    if (page === "Jadwal Praktik") {
      const dayShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
      const dayOrder = [1, 2, 3, 4, 5, 6, 0];
      const groupedByDoc = new Map<string, Schedule[]>();
      for (const s of schedules) {
        const list = groupedByDoc.get(s.doctor) || [];
        const isDuplicateSlot = list.some(
          (item) =>
            item.day === s.day && item.start === s.start && item.end === s.end,
        );
        if (!isDuplicateSlot) {
          list.push(s);
          groupedByDoc.set(s.doctor, list);
        }
      }
      const doctorRows = Array.from(groupedByDoc.entries()).map(
        ([doctorId, docSchedules]) => {
          const sorted = [...docSchedules].sort((a, b) => {
            const dDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
            return dDiff !== 0 ? dDiff : a.start.localeCompare(b.start);
          });
          const docObj = doctors.find((d) => d.id === doctorId);
          const uniqueTimes = Array.from(
            new Set(sorted.map((s) => `${s.start} – ${s.end}`)),
          );
          const quotas = sorted.map((s) => s.quota);
          const minQuota = Math.min(...quotas);
          const maxQuota = Math.max(...quotas);
          const quotaText =
            minQuota === maxQuota
              ? `${minQuota} pasien`
              : `${minQuota}–${maxQuota} pasien`;
          const mondaySessions = sorted.filter((s) => s.day === 1);
          const activeCount = sorted.filter((s) => s.active).length;
          const primarySched =
            mondaySessions[0] || sorted.find((s) => s.active) || sorted[0];
          return {
            doctorId,
            docObj,
            sorted,
            uniqueTimes,
            quotaText,
            mondaySessions,
            activeCount,
            primarySched,
          };
        },
      );
      const filteredDoctorRows = doctorRows.filter((row) => {
        const docTitle =
          `${doctorName(row.doctorId)} ${row.docObj?.specialty || ""}`.toLowerCase();
        const matchSearch = docTitle.includes(search.toLowerCase());
        const matchFilter =
          !filter ||
          (filter === "Aktif" ? row.activeCount > 0 : row.activeCount === 0);
        return matchSearch && matchFilter;
      });
      const {
        paged: pagedDoctorRows,
        current,
        maxPage,
      } = paginateList(filteredDoctorRows, 6);

      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>
                Jadwal praktik & kuota{" "}
                <span className="count">
                  {filteredDoctorRows.length} dokter
                </span>
              </h3>
              <p>
                Satu baris per dokter menampilkan seluruh hari praktiknya. Klik
                hari untuk mengedit sesi tersebut.
              </p>
            </div>
            <button className="primary" onClick={() => showEditor("Jadwal")}>
              <Icon name="plus" size={16} />
              Tambah Jadwal
            </button>
          </div>
          <div className="table-tools">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                aria-label="Cari jadwal dokter"
                placeholder="Cari dokter atau spesialisasi…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(1);
                }}
              />
            </div>
            <div className="filters">
              <select
                aria-label="Filter status jadwal"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua status</option>
                <option value="Aktif">Jadwal aktif</option>
                <option value="Nonaktif">Sesi nonaktif</option>
              </select>
            </div>
          </div>
          <div className="table-scroll ws-spaced-table">
            <table>
              <thead>
                <tr>
                  {[
                    "Dokter",
                    "Hari praktik",
                    "Jam praktik",
                    "Kuota / sesi",
                    "Sisa hari demo",
                    "Status",
                    "Aksi",
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingData
                  ? Array.from({ length: 4 }, (_, idx) => (
                      <tr key={`jadwal-skel-${idx}`}>
                        <td colSpan={7}>
                          <div className="ws-skeleton ws-skeleton-line" />
                        </td>
                      </tr>
                    ))
                  : pagedDoctorRows.map(
                      ({
                        doctorId,
                        docObj,
                        sorted,
                        uniqueTimes,
                        quotaText,
                        mondaySessions,
                        activeCount,
                        primarySched,
                      }) => (
                        <tr key={doctorId}>
                          <td>
                            <b>{doctorName(doctorId)}</b>
                            {docObj?.specialty && (
                              <small>{docObj.specialty}</small>
                            )}
                          </td>
                          <td>
                            <div className="ws-day-chips">
                              {sorted.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className={`ws-day-chip ${s.active ? "" : "inactive"}`}
                                  title={`Edit jadwal ${dayShort[s.day]} (${s.start} – ${s.end})`}
                                  onClick={() => showEditor("Jadwal", s.id)}
                                >
                                  <b>{dayShort[s.day]}</b>
                                  <span>
                                    {s.start}–{s.end}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            {uniqueTimes.map((t) => (
                              <div key={t}>{t}</div>
                            ))}
                          </td>
                          <td>{quotaText}</td>
                          <td>
                            {mondaySessions.length > 0
                              ? `${mondaySessions.reduce(
                                  (sum, s) =>
                                    sum + remaining(s, DEMO_DATE, visits),
                                  0,
                                )} tersisa`
                              : "—"}
                          </td>
                          <td>
                            <Badge
                              text={activeCount > 0 ? "Aktif" : "Nonaktif"}
                            />
                            <small>
                              {activeCount}/{sorted.length} hari aktif
                            </small>
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() =>
                                showEditor("Jadwal", primarySched.id)
                              }
                            >
                              Edit Jadwal
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
              </tbody>
            </table>
            {!loadingData && !filteredDoctorRows.length && (
              <div className="empty">Jadwal dokter tidak ditemukan.</div>
            )}
          </div>
          {renderPaginationBar(
            filteredDoctorRows.length,
            pagedDoctorRows.length,
            "dokter",
            maxPage,
            current,
          )}
        </section>
      );
    }
    if (page === "Manajemen Pengguna") {
      const filteredUsers = users.filter(
        (u) =>
          (!filter || u.role === filter) &&
          (!subFilter || (subFilter === "Aktif" ? u.active : !u.active)) &&
          `${u.name} ${u.email} ${u.role}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
      const {
        paged: pagedUsers,
        current,
        maxPage,
      } = paginateList(filteredUsers, 6);
      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>
                Akun & peran pengguna{" "}
                <span className="count">{filteredUsers.length} akun</span>
              </h3>
              <p>Akun staf dibuat oleh admin. Pasien mendaftar mandiri.</p>
            </div>
            <button className="primary" onClick={() => showEditor("Pengguna")}>
              <Icon name="plus" size={16} />
              Tambah Akun Staf
            </button>
          </div>
          <div className="table-tools">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                aria-label="Cari pengguna staf"
                placeholder="Cari nama atau email staf…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(1);
                }}
              />
            </div>
            <div className="filters">
              <select
                aria-label="Filter peran pengguna"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua peran</option>
                <option value="Admin">Admin</option>
                <option value="Petugas">Petugas</option>
                <option value="Dokter">Dokter</option>
              </select>
              <select
                aria-label="Filter status pengguna"
                value={subFilter}
                onChange={(e) => {
                  setSubFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="table-scroll ws-spaced-table">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loadingData
                  ? Array.from({ length: 4 }, (_, idx) => (
                      <tr key={`user-skel-${idx}`}>
                        <td colSpan={5}>
                          <div className="ws-skeleton ws-skeleton-line" />
                        </td>
                      </tr>
                    ))
                  : pagedUsers.map((u) => {
                      const isProtected =
                        u.email === "rina@sehatklinik.id" ||
                        (currentUser?.email && u.email === currentUser.email);
                      return (
                        <tr key={u.email}>
                          <td>
                            <b>{u.name}</b>
                          </td>
                          <td>{u.email}</td>
                          <td>{u.role}</td>
                          <td>
                            <Badge text={u.active ? "Aktif" : "Nonaktif"} />
                          </td>
                          <td>
                            <button
                              className="text-button"
                              disabled={Boolean(isProtected)}
                              onClick={() => {
                                setUsers((previous) =>
                                  previous.map((item) =>
                                    item.email === u.email
                                      ? { ...item, active: !item.active }
                                      : item,
                                  ),
                                );
                                notify("Status akun demo diperbarui.");
                              }}
                            >
                              {isProtected
                                ? "Akun Anda"
                                : u.active
                                  ? "Nonaktifkan"
                                  : "Aktifkan"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {!loadingData && !filteredUsers.length && (
              <div className="empty">
                Tidak ada data akun staf yang sesuai filter.
              </div>
            )}
          </div>
          {renderPaginationBar(
            filteredUsers.length,
            pagedUsers.length,
            "pengguna",
            maxPage,
            current,
          )}
          <div className="notice ws-inset">
            <Icon name="shield" size={20} />
            Ini simulasi tampilan akun. Pembuatan akun dan pembatasan akses
            server belum terhubung.
          </div>
        </section>
      );
    }
    if (page === "Profil Saya" && !editingProfile)
      return (
        <div className="patient-profile-layout">
          <section className="panel patient-profile-identity">
            <GenderAvatar
              size="large"
              gender={patient.gender}
              name={patient.name}
            />
            <h2>{patient.name}</h2>
            {patient.nik && <p className="muted">NIK: {patient.nik}</p>}
            <Badge text="Pasien" />
            <div className="patient-profile-fixed">
              <Icon name="shield" size={19} />
              <p>
                Peran dan data identitas dikelola klinik, tidak dapat diubah
                melalui profil.
              </p>
            </div>
          </section>
          <section className="panel patient-profile-details">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PROFIL PRIBADI</span>
                <h3>Informasi profil Anda</h3>
                <p>
                  Data ditampilkan hanya-baca. Pilih Edit Profil untuk melakukan
                  perubahan.
                </p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setProfilFieldErrors({});
                  setEditingProfile(true);
                }}
              >
                <Icon name="users" size={17} />
                Edit Profil
              </button>
            </div>
            <div className="patient-panel-body">
              <h3 className="patient-detail-heading">
                <Icon name="users" size={18} />
                Data diri
              </h3>
              <dl className="patient-profile-fields">
                {[
                  ["Nama lengkap", patient.name],
                  ["NIK (Nomor Induk Kependudukan)", patient.nik || "-"],
                  ["Tanggal lahir", dateLabel(patient.birth)],
                  ["Jenis kelamin", patient.gender],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Belum diisi"}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="patient-detail-heading">
                <Icon name="clinic" size={18} />
                Kontak & alamat
              </h3>
              <dl className="patient-profile-fields">
                {[
                  ["Nomor telepon", patient.phone],
                  ["Kontak darurat", patient.emergency],
                  ["Alamat", patient.address],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className={label === "Alamat" ? "full-width" : ""}
                  >
                    <dt>{label}</dt>
                    <dd>{value || "Belum diisi"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      );
    if (page === "Pekerjaan Notifikasi") {
      const statusFilter = filter || "";
      const roleFilter = subFilter || "";
      const filteredJobs = notificationJobs.filter(
        (j) =>
          (!statusFilter || j.status === statusFilter) &&
          (!roleFilter || j.recipientRole === roleFilter) &&
          `${j.id} ${j.recipientName} ${j.eventType} ${j.visitId}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
      const {
        paged: pagedJobs,
        current,
        maxPage,
      } = paginateList(filteredJobs, 6);
      return (
        <section className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">POLA OUTBOX BULLMQ & REDIS</span>
              <h3>
                Pelacak Antrean Pekerjaan Notifikasi (Tabel notifikasi_job)
              </h3>
              <p>
                Status pengiriman push notification ke browser secara asinkron
                sesuai spesifikasi SRS Bab III & IV.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="secondary"
                onClick={() => sendDemoPushNotification("ANTREAN_DIPANGGIL")}
              >
                <Icon name="bell" size={14} />
                Uji Panggilan Antrean
              </button>
              <button
                className="secondary"
                onClick={() => sendDemoPushNotification("GILIRAN_MENDEKAT")}
              >
                <Icon name="clock" size={14} />
                Uji Giliran Mendekat
              </button>
            </div>
          </div>
          <div className="table-tools">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                aria-label="Cari pekerjaan notifikasi"
                placeholder="Cari ID job, penerima, atau event…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(1);
                }}
              />
            </div>
            <div className="filters">
              <select
                aria-label="Filter status notifikasi"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">
                  Semua status ({notificationJobs.length})
                </option>
                <option value="berhasil">
                  Berhasil (
                  {
                    notificationJobs.filter((j) => j.status === "berhasil")
                      .length
                  }
                  )
                </option>
                <option value="menunggu">
                  Menunggu (
                  {
                    notificationJobs.filter((j) => j.status === "menunggu")
                      .length
                  }
                  )
                </option>
                <option value="gagal">
                  Gagal (
                  {notificationJobs.filter((j) => j.status === "gagal").length})
                </option>
              </select>
              <select
                aria-label="Filter peran penerima notifikasi"
                value={subFilter}
                onChange={(e) => {
                  setSubFilter(e.target.value);
                  setPagination(1);
                }}
              >
                <option value="">Semua peran</option>
                <option value="Pasien">Pasien</option>
                <option value="Petugas">Petugas</option>
                <option value="Dokter">Dokter</option>
                <option value="Admin">Admin</option>
                <option value="Semua">Semua</option>
              </select>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID Job</th>
                  <th>Penerima</th>
                  <th>Peran</th>
                  <th>Jenis Kejadian</th>
                  <th>No. Antrean</th>
                  <th>Kunjungan ID</th>
                  <th>Status Outbox</th>
                  <th>Percobaan</th>
                  <th>Keterangan / Error</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loadingData
                  ? Array.from({ length: 4 }, (_, idx) => (
                      <tr key={`job-skel-${idx}`}>
                        <td colSpan={10}>
                          <div className="ws-skeleton ws-skeleton-line" />
                        </td>
                      </tr>
                    ))
                  : pagedJobs.map((j) => (
                      <tr key={j.id}>
                        <td>
                          <code>{j.id}</code>
                        </td>
                        <td>
                          <b>{j.recipientName}</b>
                        </td>
                        <td>
                          <span className="tiny-tag">{j.recipientRole}</span>
                        </td>
                        <td>
                          <code>{j.eventType}</code>
                        </td>
                        <td>
                          {j.queueNumber ? (
                            <span className="queue-number">
                              {j.queueNumber}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <small>{j.visitId}</small>
                        </td>
                        <td>
                          <span
                            className={`job-status-badge ${
                              j.status === "berhasil"
                                ? "status-success"
                                : j.status === "gagal"
                                  ? "status-failed"
                                  : "status-queued"
                            }`}
                          >
                            {j.status === "berhasil"
                              ? "Berhasil"
                              : j.status === "gagal"
                                ? "Gagal"
                                : "Menunggu"}
                          </span>
                        </td>
                        <td>{j.attempts}x</td>
                        <td>
                          {j.error ? (
                            <span
                              style={{ color: "#dc2626", fontSize: "10.5px" }}
                            >
                              {getErrorMessage(j.error)}
                            </span>
                          ) : (
                            <span
                              style={{ color: "#16a34a", fontSize: "10.5px" }}
                            >
                              Diproses worker
                            </span>
                          )}
                        </td>
                        <td>
                          {j.status === "gagal" ? (
                            <button
                              className="notif-retry-btn"
                              onClick={() => retryNotificationJob(j.id)}
                            >
                              <Icon name="refresh" size={12} />
                              Retry
                            </button>
                          ) : (
                            <span
                              style={{ color: "#94a3b8", fontSize: "10px" }}
                            >
                              Tuntas
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!loadingData && !filteredJobs.length && (
              <div className="empty">
                Tidak ada pekerjaan notifikasi yang cocok.
              </div>
            )}
          </div>
          {renderPaginationBar(
            filteredJobs.length,
            pagedJobs.length,
            "pekerjaan",
            maxPage,
            current,
          )}
        </section>
      );
    }
    if (page === "Profil Saya" || page === "Profil Klinik")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {role === "Admin" && (
            <section className="panel ws-clinic-profile-panel">
              <div className="ws-clinic-hero-head">
                <div>
                  <span className="eyebrow">
                    IDENTITAS FASILITAS KESEHATAN TINGKAT PERTAMA (FKTP)
                  </span>
                  <h2
                    style={{
                      fontSize: "22px",
                      margin: "4px 0",
                      color: "#0f172a",
                    }}
                  >
                    {clinic.name}
                  </h2>
                  <p
                    style={{
                      color: "#2563eb",
                      fontWeight: 600,
                      fontSize: "12.5px",
                    }}
                  >
                    {clinic.tagline ||
                      "Perawatan Sepenuh Hati, Hidup Lebih Berarti"}
                  </p>
                </div>
                <span className="clinic-accredit-badge">
                  <Icon name="award" size={15} />
                  Akreditasi Paripurna Kemenkes
                </span>
              </div>

              <p
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  lineHeight: 1.7,
                  marginBottom: "20px",
                }}
              >
                {clinic.history || clinic.description}
              </p>

              <div className="ws-clinic-stats-grid">
                {clinic.stats?.map((st) => (
                  <div key={st.label}>
                    <b
                      style={{
                        color: "#2563eb",
                        fontSize: "18px",
                        display: "block",
                      }}
                    >
                      {st.value}
                    </b>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      {st.label}
                    </span>
                    <small
                      style={{
                        display: "block",
                        color: "#64748b",
                        fontSize: "10px",
                      }}
                    >
                      {st.sub}
                    </small>
                  </div>
                ))}
              </div>

              <div className="ws-clinic-vm-grid">
                <div className="ws-clinic-vm-card">
                  <b
                    style={{
                      color: "#0f172a",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <Icon name="heart" size={15} /> Visi Rumah Sakit / Klinik
                  </b>
                  <p style={{ color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                    {clinic.vision}
                  </p>
                </div>
                <div className="ws-clinic-vm-card">
                  <b
                    style={{
                      color: "#0f172a",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <Icon name="shield" size={15} /> 4 Nilai Utama Layanan
                  </b>
                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      flexWrap: "wrap",
                      marginTop: "4px",
                    }}
                  >
                    {clinic.values?.map((v) => (
                      <span
                        key={v.title}
                        style={{
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "10.5px",
                        }}
                      >
                        {v.title.split("(")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="panel form-panel">
            <span className="eyebrow">
              {role === "Admin"
                ? "EDIT INFORMASI PUBLIK KLINIK"
                : "INFORMASI PRIBADI"}
            </span>
            <h3>
              {role === "Pasien"
                ? "Edit Profil"
                : "Perbarui Data Publik Klinik"}
            </h3>
            <p className="muted">
              {role === "Admin"
                ? "Perubahan data alamat, kontak darurat, koordinat GPS, dan jam operasional langsung tersinkronisasi ke halaman publik."
                : "Peran akun pasien dikelola oleh sistem."}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const get = (key: string) => String(data.get(key) || "");
                if (role === "Admin") {
                  setClinic({
                    name: get("name"),
                    description: get("description"),
                    address: get("address"),
                    phone: get("phone"),
                    latitude: get("latitude"),
                    longitude: get("longitude"),
                    hours: get("hours"),
                  });
                  setEditingProfile(false);
                  notify("Profil klinik berhasil diperbarui.");
                } else {
                  const updatedAddress = get("address");
                  const updatedPhone = get("phone");
                  const updatedEmergency = get("emergency");
                  setProfilFieldErrors({});

                  setBusy(true);
                  try {
                    const res = await apiUpdateProfil({
                      alamat: updatedAddress,
                      telepon: updatedPhone,
                      kontakDarurat: updatedEmergency,
                    });
                    if (res.error) {
                      setProfilFieldErrors(res.error.fields || {});
                      throw new Error(
                        res.error.message ||
                          "Gagal memperbarui profil di database."
                      );
                    }
                    const saved = res.data as
                      | {
                          nama?: string;
                          telepon?: string;
                          alamat?: string;
                          kontakDarurat?: string;
                        }
                      | undefined;
                    const updatedUser: ClinicUser = {
                      ...(currentUser || {
                        email: "",
                        role: "Pasien",
                        active: true,
                      }),
                      name: saved?.nama || currentUser?.name || patient.name,
                      alamat:
                        saved?.alamat && saved.alamat !== "-"
                          ? saved.alamat
                          : updatedAddress,
                      telepon:
                        saved?.telepon && saved.telepon !== "-"
                          ? saved.telepon
                          : updatedPhone,
                      kontakDarurat:
                        saved?.kontakDarurat && saved.kontakDarurat !== "-"
                          ? saved.kontakDarurat
                          : updatedEmergency,
                    };
                    setCurrentUser(updatedUser);
                  } catch (err: any) {
                    notify(
                      err?.message || "Gagal memperbarui profil di database."
                    );
                    setBusy(false);
                    return;
                  } finally {
                    setBusy(false);
                  }

                  setPatients((p) => {
                    const exists = p.some(
                      (item) =>
                        item.id === patient.id ||
                        (currentUser?.id && item.id === currentUser.id) ||
                        (currentUser?.pasienId &&
                          item.id === currentUser.pasienId)
                    );
                    if (exists) {
                      return p.map((item) =>
                        item.id === patient.id ||
                        (currentUser?.id && item.id === currentUser.id) ||
                        (currentUser?.pasienId &&
                          item.id === currentUser.pasienId)
                          ? {
                              ...item,
                              phone: updatedPhone,
                              address: updatedAddress,
                              emergency: updatedEmergency,
                            }
                          : item
                      );
                    }
                    return [
                      {
                        id: patient.id,
                        name: patient.name,
                        nik: patient.nik,
                        phone: updatedPhone,
                        birth: patient.birth,
                        gender: patient.gender,
                        address: updatedAddress,
                        emergency: updatedEmergency,
                        account: true,
                      },
                      ...p,
                    ];
                  });

                  setEditingProfile(false);
                  notify("Profil Anda berhasil diperbarui.");
                }
              }}
            >
              <Field label="Nama">
                <input
                  name="name"
                  required
                  disabled={role !== "Admin"}
                  defaultValue={
                    role === "Admin"
                      ? clinic.name
                      : currentUser?.name || patient.name
                  }
                />
              </Field>
              {role === "Admin" ? (
                <Field label="Deskripsi">
                  <textarea
                    name="description"
                    required
                    defaultValue={clinic.description}
                  />
                </Field>
              ) : (
                <div className="ws-form-grid">
                  <Field label="Tanggal lahir">
                    <input
                      name="birth"
                      disabled
                      type="date"
                      defaultValue={
                        currentUser?.tanggalLahir || patient.birth
                      }
                    />
                  </Field>
                  <Field label="Jenis kelamin">
                    <select
                      name="gender"
                      disabled
                      defaultValue={
                        currentUser?.jenisKelamin || patient.gender
                      }
                    >
                      <option>Laki-laki</option>
                      <option>Perempuan</option>
                    </select>
                  </Field>
                </div>
              )}
              {role === "Pasien" && (
                <Field label="NIK">
                  <input
                    name="nik"
                    disabled
                    maxLength={16}
                    defaultValue={currentUser?.nik || patient.nik || ""}
                  />
                </Field>
              )}
              <Field
                label="Alamat"
                icon={
                  role === "Pasien" ? <Icon name="edit" size={13} /> : undefined
                }
              >
                <textarea
                  name="address"
                  required
                  defaultValue={
                    role === "Admin"
                      ? clinic.address
                      : currentUser?.alamat && currentUser.alamat !== "-"
                        ? currentUser.alamat
                        : patient.address
                  }
                />
              </Field>
              <Field
                label="Nomor telepon"
                icon={
                  role === "Pasien" ? <Icon name="edit" size={13} /> : undefined
                }
              >
                <input
                  name="phone"
                  required
                  type="tel"
                  defaultValue={
                    role === "Admin"
                      ? clinic.phone
                      : currentUser?.telepon && currentUser.telepon !== "-"
                        ? currentUser.telepon
                        : patient.phone
                  }
                />
              </Field>
              {role === "Admin" ? (
                <>
                  <div className="ws-form-grid">
                    <Field label="Latitude">
                      <input
                        required
                        name="latitude"
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        defaultValue={clinic.latitude}
                      />
                    </Field>
                    <Field label="Longitude">
                      <input
                        required
                        name="longitude"
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        defaultValue={clinic.longitude}
                      />
                    </Field>
                  </div>
                  <Field label="Jam operasional">
                    <input required name="hours" defaultValue={clinic.hours} />
                  </Field>
                </>
              ) : (
                <Field
                  label="Kontak darurat"
                  icon={<Icon name="edit" size={13} />}
                >
                  <input
                    name="emergency"
                    type="tel"
                    defaultValue={
                      currentUser?.kontakDarurat &&
                      currentUser.kontakDarurat !== "-"
                        ? currentUser.kontakDarurat
                        : patient.emergency
                    }
                  />
                </Field>
              )}
              <div className="form-actions">
                {role === "Pasien" && (
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => setEditingProfile(false)}
                  >
                    Batal
                  </button>
                )}
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "Menyimpan..." : "Simpan Perubahan"}
                  <Icon name="check" size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      );
    return (
      <>
        {stats}
        {role === "Admin" ? (
          <>
            <div className="ws-overview">
              <section className="panel ws-distribution">
                <div className="panel-heading">
                  <div>
                    <h3>Ringkasan per layanan</h3>
                    <p>Seluruh periode · {visits.length} kunjungan simulasi</p>
                  </div>
                  <Icon name="chart" size={18} />
                </div>
                {services.map((s) => {
                  const count = visits.filter((v) => v.service === s.id).length;
                  return (
                    <div className="ws-distribution-row" key={s.id}>
                      <div>
                        <span>{s.name}</span>
                        <b>
                          {count} <small>kunjungan</small>
                        </b>
                      </div>
                      <div className="ws-quota-track">
                        <span
                          style={{
                            width: `${(count / Math.max(visits.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <button
                  className="schedule-link"
                  onClick={() => navigate("Rekap Kunjungan")}
                >
                  Buka rekap dengan filter periode
                  <Icon name="arrow" size={15} />
                </button>
              </section>
              {schedulePanel}
            </div>
            {workflow}
            {visitTable(scoped, "Kunjungan terbaru")}
          </>
        ) : (
          <>
            {role === "Petugas" && webPushBanner("Petugas")}
            {workflow}
            <div className="ws-overview ws-operational">
              {visitTable(
                today,
                role === "Dokter"
                  ? "Pasien Anda hari ini"
                  : "Antrean pelayanan hari ini",
              )}
              {schedulePanel}
            </div>
          </>
        )}
      </>
    );
  };
  if (role === "Publik")
    return (
      <PublicSite
        Icon={Icon}
        page={page}
        initialDetailId={initialDetailId}
        navigate={navigate}
        onBook={() => navigate("Login")}
        onLogin={() => switchRole("Pasien")}
        onRole={switchRole}
        doctors={doctors}
        services={services}
        schedules={schedules}
        visits={visits}
        clinic={clinic}
      />
    );
  const staffRoleName =
    initialRole === "Admin"
      ? "Administrator"
      : initialRole === "Dokter"
        ? "Ruang Dokter"
        : "Loket Petugas";

  const handleModalLogin = async (
    emailInput?: string,
    passwordInput?: string,
  ) => {
    if (modalBusy) return;
    const e = emailInput !== undefined ? emailInput : modalEmail;
    const p = passwordInput !== undefined ? passwordInput : modalPassword;

    if (!e) {
      setModalError("Silakan masukkan email Anda.");
      return;
    }

    setModalBusy(true);
    try {
      const res = await clinicContext.login(e, p);
      if (!res.success) {
        setModalError(res.message || "Email atau password salah.");
        return;
      }

      if (res.user) {
        if (res.user.role === initialRole) {
          setModalError("");
          notify(
            `Selamat datang, ${res.user.name}! Anda berhasil masuk sebagai ${res.user.role}.`,
          );
        } else {
          const rolePaths: Record<string, string> = {
            Admin: "/admin",
            Petugas: "/petugas",
            Dokter: "/dokter-dashboard",
            Pasien: "/pasien",
          };
          const targetPath = rolePaths[res.user.role] || "/dashboard";
          notify(
            `Akun Anda (${res.user.name}) terdaftar sebagai ${res.user.role}. Mengalihkan ke ${targetPath}...`,
          );
          setTimeout(() => {
            window.location.href = targetPath;
          }, 600);
        }
      }
    } finally {
      setModalBusy(false);
    }
  };

  return (
    <>
      <div
        className={`app ws-app ${mobile ? "nav-open" : ""}`}
        style={
          showAuthModal
            ? {
                filter: "blur(4px)",
                pointerEvents: "none",
                userSelect: "none",
                transition: "filter 0.3s ease",
              }
            : undefined
        }
      >
        {mobile && (
          <button
            className="ws-mobile-shade"
            aria-label="Tutup navigasi"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className="sidebar">
          <button
            className="brand ws-brand"
            aria-label="SehatKlinik dashboard"
            onClick={() => navigate("Dashboard")}
          >
            <BrandArtwork />
          </button>
          <div className="workspace">
            <span className="workspace-icon">
              <Icon name="clinic" size={19} />
            </span>
            <div>
              <b>{clinic.name}</b>
              <small>Jakarta Selatan</small>
            </div>
          </div>
          <span className="nav-label">RUANG {role.toUpperCase()}</span>
          <nav aria-label="Navigasi dashboard">
            {menus[role].map(([m, icon]) => (
              <button
                key={m}
                className={m === page ? "active" : ""}
                onClick={() => navigate(m)}
              >
                <Icon name={icon} size={19} />
                <span>{m}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="sidebar-link" onClick={logout}>
              <Icon name="logout" size={18} />
              Keluar / Kembali ke Website
            </button>
            <div className="sidebar-foot">
              Sistem Aktif
              <small>Sistem Informasi Klinik Kesehatan</small>
            </div>
          </div>
        </aside>
        <div className="main-wrapper">
          <header className="topbar">
            <button
              className="mobile-menu square"
              aria-label="Buka navigasi"
              onClick={() => setMobile(!mobile)}
            >
              <Icon name="menu" />
            </button>
            <div className="breadcrumb">
              Klinik <span>/</span>
              <b>
                {role === "Admin"
                  ? "Administrasi"
                  : role === "Dokter"
                    ? "Ruang Dokter"
                    : role === "Petugas"
                      ? "Pelayanan Pasien"
                      : "Ruang Pasien"}
              </b>
            </div>
            <div className="topbar-right">
              <button
                id="topbar-notif-bell"
                className="notif-bell-btn"
                onClick={() =>
                  setNotificationDrawerOpen(!notificationDrawerOpen)
                }
                aria-label="Pusat Notifikasi & Web Push"
                title="Pusat Notifikasi & Web Push (SRS 11)"
              >
                <Icon name="bell" size={18} />
                {unreadCount > 0 && (
                  <span className="notif-counter-badge">{unreadCount}</span>
                )}
              </button>
              <span className="top-divider" />
              <div className="profile">
                <GenderAvatar
                  gender={role === "Pasien" ? patient.gender : undefined}
                  name={
                    currentUser?.name ||
                    (role === "Pasien"
                      ? patient.name
                      : role === "Dokter"
                        ? activeDoctor?.name || "dr. Reyhan Adhitama"
                        : role === "Petugas"
                          ? "Dina Wulandari"
                          : "Rina Kusuma")
                  }
                />
                <div>
                  <b>
                    {currentUser?.name ||
                      (role === "Pasien"
                        ? patient.name
                        : role === "Dokter"
                          ? activeDoctor?.name || "dr. Reyhan Adhitama"
                          : role === "Petugas"
                            ? "Dina Wulandari"
                            : "Rina Kusuma")}
                  </b>
                  <small>
                    {currentUser?.role ||
                      (role === "Admin" ? "Administrator" : role)}
                  </small>
                </div>
              </div>
              <button
                className="text-button"
                style={{
                  color: "#94a3b8",
                  fontSize: "11px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 8px",
                }}
                onClick={logout}
                title="Keluar dari sistem"
              >
                <Icon name="logout" size={14} />
                <span>Keluar</span>
              </button>
            </div>
          </header>
          <main className="content">
            <div className="page-heading">
              <div className="cinema-workspace-art" aria-hidden="true">
                <span className="cinema-workspace-orbit" />
                <img src="/images/sehatklinik-symbol.png" alt="" />
              </div>
              <div>
                <div className="page-overline">
                  SEHATKLINIK / {role.toUpperCase()}
                </div>
                <h1>
                  {page === "Dashboard"
                    ? `Selamat pagi, ${
                        role === "Dokter"
                          ? currentUser?.name ||
                            activeDoctor?.name ||
                            "dr. Reyhan Adhitama"
                          : role === "Pasien"
                            ? (currentUser?.name || patient.name).split(" ")[0]
                            : role === "Petugas"
                              ? currentUser?.name || "Dina"
                              : currentUser?.name || "Rina"
                      }.`
                    : page}
                </h1>
                <p>
                  {page === "Dashboard"
                    ? role === "Admin"
                      ? "Gambaran menyeluruh alur pelayanan dan operasional klinik."
                      : role === "Dokter"
                        ? "Fokus pada pasien Anda. Kami bantu merapikan alurnya."
                        : role === "Petugas"
                          ? "Sambut pasien dan kelola alur pelayanan hari ini."
                          : "Kunjungan dan informasi kesehatan Anda, dalam satu ruang."
                    : "Informasi terstruktur untuk pelayanan yang lebih baik."}
                </p>
              </div>
              <div className="heading-actions">
                <span
                  className="secondary date-button"
                  suppressHydrationWarning
                >
                  <Icon name="calendar" size={16} />
                  {todayFormatted || getTodayFormatted()}
                </span>
                {page === "Dashboard" &&
                  (role === "Petugas" || role === "Pasien") && (
                    <button
                      className="primary"
                      onClick={() =>
                        navigate(
                          role === "Petugas"
                            ? "Pendaftaran Walk-in"
                            : "Pendaftaran Kunjungan",
                        )
                      }
                    >
                      <Icon name="plus" size={16} />
                      {role === "Petugas"
                        ? "Daftar Walk-in"
                        : "Daftar Kunjungan"}
                    </button>
                  )}
              </div>
            </div>
            {page === "Dashboard" && role === "Pasien"
              ? patientDashboard
              : management()}
            <footer className="content-footer">
              <span>
                © 2026 SehatKlinik · Sistem Informasi Klinik Kesehatan
              </span>
              <span>
                <Icon name="shield" size={13} />
                Prototipe berdasarkan PRD & ERD · Data simulasi
              </span>
            </footer>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            <Icon name="check" size={18} />
            {toast}
            <button aria-label="Tutup notifikasi" onClick={() => setToast("")}>
              ×
            </button>
          </div>
        )}
        {detail && (
          <div className="modal-backdrop" onClick={closeVisit}>
            <section
              className="modal ws-detail"
              role="dialog"
              aria-modal="true"
              aria-labelledby="visit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">DETAIL KUNJUNGAN</span>
                  <h2 id="visit-title">{patientName(detail.patient)}</h2>
                  <p>
                    {detail.ref
                      ? `Ref. ${detail.ref}`
                      : `${dateLabel(detail.date)} · ${session(detail.schedule)?.start ?? ""}`}
                  </p>
                </div>
                <button
                  className="square"
                  aria-label="Tutup detail"
                  onClick={closeVisit}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className="ws-detail-status">
                {page !== "Rekap Kunjungan" && (
                  <span className="queue-number">{formatQueue(detail)}</span>
                )}
                <span>
                  Kunjungan <Badge text={detail.status} />
                </span>
                <span>
                  {page === "Rekap Kunjungan" ? "Status" : "Antrean"}{" "}
                  <Badge text={detail.queue} />
                </span>
              </div>
              <div className="ws-summary">
                <div>
                  <span>Dokter & layanan</span>
                  <b>
                    {role === "Dokter"
                      ? activeDoctor?.name || doctorName(detail.doctor)
                      : doctorName(detail.doctor)}
                    <small>{serviceName(detail.service)}</small>
                  </b>
                </div>
                <div>
                  <span>Jadwal & sumber</span>
                  <b>
                    {dateLabel(detail.date)} · {session(detail.schedule)?.start}{" "}
                    – {session(detail.schedule)?.end}
                    <small>{detail.source}</small>
                  </b>
                </div>
                {canMedical && (
                  <div>
                    <span>Keluhan</span>
                    <b>{detail.complaint}</b>
                  </div>
                )}
                {detail.reason && (
                  <div>
                    <span>Alasan</span>
                    <b>{detail.reason}</b>
                  </div>
                )}
              </div>
              {!canMedical && (
                <div className="notice">
                  <Icon name="shield" size={19} />
                  Anda hanya melihat informasi administratif. Pemeriksaan dan
                  tindakan medis tidak ditampilkan.
                </div>
              )}
              {role === "Dokter" &&
                detail.queue === "Sedang Diperiksa" &&
                exam && (
                  <form onSubmit={saveExamination}>
                    <div className="ws-subheading">
                      <h3>Pemeriksaan medis</h3>
                      <Badge text={savedExam ? "Tersimpan" : "Draf"} />
                    </div>
                    <Field label="Anamnesis">
                      <textarea
                        required
                        value={exam.anamnesis}
                        onChange={(e) => {
                          setExam({ ...exam, anamnesis: e.target.value });
                          setSavedExam(false);
                        }}
                      />
                    </Field>
                    <div className="ws-form-grid">
                      <Field label="Tekanan darah (mmHg)">
                        <input
                          required
                          pattern="[0-9]{2,3}/[0-9]{2,3}"
                          placeholder="120/80"
                          value={exam.pressure}
                          onChange={(e) => {
                            setExam({ ...exam, pressure: e.target.value });
                            setSavedExam(false);
                          }}
                        />
                      </Field>
                      <Field label="Suhu (°C)">
                        <input
                          required
                          type="number"
                          min="30"
                          max="45"
                          step="0.1"
                          placeholder="36.6"
                          value={exam.temperature}
                          onChange={(e) => {
                            setExam({ ...exam, temperature: e.target.value });
                            setSavedExam(false);
                          }}
                        />
                      </Field>
                      <Field label="Berat badan (kg)">
                        <input
                          required
                          type="number"
                          min="1"
                          max="500"
                          step="0.1"
                          placeholder="60"
                          value={exam.weight}
                          onChange={(e) => {
                            setExam({ ...exam, weight: e.target.value });
                            setSavedExam(false);
                          }}
                        />
                      </Field>
                      <Field label="Tinggi badan (cm)">
                        <input
                          required
                          type="number"
                          min="20"
                          max="250"
                          step="0.1"
                          placeholder="165"
                          value={exam.height}
                          onChange={(e) => {
                            setExam({ ...exam, height: e.target.value });
                            setSavedExam(false);
                          }}
                        />
                      </Field>
                    </div>
                    <Field label="Diagnosis">
                      <textarea
                        required
                        value={exam.diagnosis}
                        onChange={(e) => {
                          setExam({ ...exam, diagnosis: e.target.value });
                          setSavedExam(false);
                        }}
                      />
                    </Field>
                    <Field label="Catatan pemeriksaan">
                      <textarea
                        value={exam.notes}
                        onChange={(e) => {
                          setExam({ ...exam, notes: e.target.value });
                          setSavedExam(false);
                        }}
                      />
                    </Field>
                    <div className="ws-subheading">
                      <h3>
                        Tindakan{" "}
                        <span className="count">
                          Opsional · {exam.actions.length}
                        </span>
                      </h3>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setExam({
                            ...exam,
                            actions: [
                              ...exam.actions,
                              { name: "", description: "", advice: "" },
                            ],
                          });
                          setSavedExam(false);
                        }}
                      >
                        + Tambah Tindakan
                      </button>
                    </div>
                    {exam.actions.map((action, i) => (
                      <div className="ws-action-card" key={i}>
                        <div className="ws-subheading">
                          <b>Tindakan {i + 1}</b>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              setExam({
                                ...exam,
                                actions: exam.actions.filter(
                                  (_, index) => index !== i,
                                ),
                              });
                              setSavedExam(false);
                            }}
                          >
                            Hapus
                          </button>
                        </div>
                        {[
                          ["name", "Nama tindakan"],
                          ["description", "Keterangan"],
                          ["advice", "Saran lanjutan"],
                        ].map(([key, label]) => (
                          <Field key={key} label={label}>
                            <input
                              required={key === "name"}
                              value={action[key as keyof typeof action]}
                              onChange={(e) => {
                                setExam({
                                  ...exam,
                                  actions: exam.actions.map((item, index) =>
                                    index === i
                                      ? { ...item, [key]: e.target.value }
                                      : item,
                                  ),
                                });
                                setSavedExam(false);
                              }}
                            />
                          </Field>
                        ))}
                      </div>
                    ))}
                    {showError}
                    <div className="modal-actions">
                      <button
                        className="secondary"
                        type="submit"
                        disabled={busy}
                      >
                        <Icon name="file" size={16} />
                        {busy ? "Menyimpan..." : "Simpan Pemeriksaan"}
                      </button>
                      <button
                        className="primary"
                        type="button"
                        disabled={!savedExam || busy}
                        onClick={() => transition(detail, "finish")}
                      >
                        {busy ? "Memproses..." : "Selesaikan Kunjungan"}
                        <Icon name="check" size={16} />
                      </button>
                    </div>
                    <p className="ws-form-hint">
                      Simpan pemeriksaan terlebih dahulu sebelum menyelesaikan
                      kunjungan.
                    </p>
                  </form>
                )}
              {canMedical &&
                detail.examination &&
                (role === "Pasien" || detail.queue === "Selesai") && (
                  <section className="ws-medical-summary">
                    <div className="ws-subheading">
                      <h3>Ringkasan pemeriksaan</h3>
                      <Badge text="Hanya-baca" />
                    </div>
                    <p className="muted">
                      Dicatat oleh {doctorName(detail.doctor)} ·{" "}
                      {dateLabel(detail.date)}
                    </p>
                    <div className="ws-summary">
                      {[
                        ["Anamnesis", detail.examination.anamnesis],
                        [
                          "Tanda vital",
                          `${detail.examination.pressure} mmHg · ${detail.examination.temperature} °C · ${detail.examination.weight} kg${detail.examination.height ? ` · ${detail.examination.height} cm` : ""}`,
                        ],
                        ["Diagnosis", detail.examination.diagnosis],
                        ["Catatan", detail.examination.notes],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <b>{value || "—"}</b>
                        </div>
                      ))}
                    </div>
                    <h3>Tindakan & saran</h3>
                    {detail.examination.actions.length ? (
                      detail.examination.actions.map((a, i) => (
                        <div className="ws-action-card" key={i}>
                          <b>{a.name}</b>
                          <p>{a.description}</p>
                          <p>{a.advice}</p>
                        </div>
                      ))
                    ) : (
                      <p className="muted">Tidak ada tindakan tambahan.</p>
                    )}
                  </section>
                )}
              {((role === "Petugas" &&
                ["Menunggu", "Dipanggil"].includes(detail.queue)) ||
                (role === "Pasien" && detail.queue === "Menunggu")) && (
                <Field label="Alasan pembatalan / pelewatan (wajib untuk tindakan tersebut)">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tuliskan alasan…"
                  />
                </Field>
              )}
              {!(
                role === "Dokter" &&
                detail.queue === "Sedang Diperiksa" &&
                exam
              ) && showError}
              <div className="modal-actions">
                {canMedical &&
                  detail.queue === "Selesai" &&
                  detail.examination && (
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        const sched = session(detail.schedule);
                        printVisitSummary({
                          visit: detail,
                          patientName: patientName(detail.patient),
                          doctorName: doctorName(detail.doctor),
                          serviceName: serviceName(detail.service),
                          dateText: dateLabel(detail.date),
                          timeRange: sched
                            ? `${sched.start} – ${sched.end}`
                            : "",
                          clinicName: clinic.name,
                          clinicAddress: clinic.address,
                          clinicPhone: clinic.phone,
                          examination: detail.examination!,
                        });
                      }}
                    >
                      <Icon name="printer" size={16} />
                      Cetak Ringkasan Kunjungan
                    </button>
                  )}
                {role === "Petugas" &&
                  detail.status === "Terdaftar" &&
                  detail.queue === "Menunggu" && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => transition(detail, "checkin")}
                    >
                      {busy ? "Memproses..." : "Konfirmasi Kehadiran"}
                    </button>
                  )}
                {["Petugas", "Dokter"].includes(role) &&
                  detail.status === "Hadir" &&
                  detail.queue === "Menunggu" && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => transition(detail, "call")}
                    >
                      {busy ? "Memanggil..." : "Panggil Pasien"}
                    </button>
                  )}
                {role === "Dokter" && detail.queue === "Dipanggil" && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => transition(detail, "start")}
                  >
                    {busy ? "Memulai..." : "Mulai Pemeriksaan"}
                  </button>
                )}
                {role === "Petugas" && detail.queue === "Dipanggil" && (
                  <button
                    className="secondary"
                    disabled={busy || !reason.trim()}
                    onClick={() => transition(detail, "skip")}
                  >
                    {busy ? "Memproses..." : "Lewati Antrean"}
                  </button>
                )}
                {((role === "Pasien" && detail.queue === "Menunggu") ||
                  (role === "Petugas" &&
                    ["Menunggu", "Dipanggil"].includes(detail.queue))) && (
                  <button
                    className="destructive"
                    disabled={busy || !reason.trim()}
                    onClick={() => transition(detail, "cancel")}
                  >
                    {busy ? "Membatalkan..." : "Batalkan Kunjungan"}
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
        {editor && (
          <div className="modal-backdrop" onClick={() => setEditor(null)}>
            <section
              className="modal ws-editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="editor-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    DATA {editor.type.toUpperCase()}
                  </span>
                  <h2 id="editor-title">
                    {editor.id ? "Edit" : "Tambah"} {editor.type}
                  </h2>
                </div>
                <button
                  className="square"
                  aria-label="Tutup formulir"
                  onClick={() => setEditor(null)}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <form onSubmit={saveEditor}>
                {["Pasien", "Dokter", "Layanan", "Pengguna"].includes(
                  editor.type,
                ) && (
                  <Field label="Nama">
                    <input
                      name="name"
                      required
                      defaultValue={
                        editPatient?.name ||
                        editRecord?.name ||
                        editService?.name ||
                        ""
                      }
                    />
                  </Field>
                )}
                {editor.type === "Pasien" && (
                  <>
                    <div className="notice">
                      <Icon name="users" size={19} />
                      Pasien walk-in terdaftar langsung tanpa memerlukan akun.
                    </div>
                    <div className="ws-form-grid">
                      <Field label="Tanggal lahir">
                        <input
                          name="birth"
                          required
                          type="date"
                          max={DEMO_DATE}
                          defaultValue={editPatient?.birth}
                        />
                      </Field>
                      <Field label="Jenis kelamin">
                        <select
                          name="gender"
                          defaultValue={editPatient?.gender}
                        >
                          <option>Laki-laki</option>
                          <option>Perempuan</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Nomor telepon">
                      <input
                        name="phone"
                        required
                        type="tel"
                        pattern="[0-9+() -]{8,16}"
                        defaultValue={editPatient?.phone}
                      />
                    </Field>
                    <Field label="Alamat">
                      <textarea
                        name="address"
                        required
                        defaultValue={editPatient?.address}
                      />
                    </Field>
                    <Field label="Kontak darurat">
                      <input
                        name="emergency"
                        type="tel"
                        defaultValue={editPatient?.emergency}
                      />
                    </Field>
                  </>
                )}
                {editor.type === "Dokter" && (
                  <>
                    <Field label="Spesialisasi">
                      <input
                        name="specialty"
                        required
                        defaultValue={editRecord?.specialty}
                      />
                    </Field>
                    <Field label="Nomor SIP (unik)">
                      <input
                        name="sip"
                        required
                        defaultValue={editRecord?.sip}
                      />
                    </Field>
                    <Field label="Foto Profil Dokter (JPG, PNG, WebP · Maks 2 MB)">
                      <div className="ws-photo-upload">
                        {doctorPhoto ? (
                          <img
                            src={doctorPhoto}
                            alt="Pratinjau foto dokter"
                            className="ws-photo-preview"
                          />
                        ) : (
                          <GenderAvatar name={editRecord?.name || "Dokter"} />
                        )}
                        <div className="ws-photo-controls">
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const extOk = /\.(jpe?g|png|webp)$/i.test(
                                file.name,
                              );
                              const mimeOk = [
                                "image/jpeg",
                                "image/png",
                                "image/webp",
                              ].includes(file.type);
                              if (!extOk || !mimeOk) {
                                setDoctorPhotoError(
                                  "Format foto harus JPG, PNG, atau WebP.",
                                );
                                e.target.value = "";
                                return;
                              }
                              if (file.size > 2 * 1024 * 1024) {
                                setDoctorPhotoError(
                                  "Ukuran foto maksimal 2 MB.",
                                );
                                e.target.value = "";
                                return;
                              }
                              setDoctorPhotoError("");
                              setError("");
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === "string") {
                                  setDoctorPhoto(reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                          <span>
                            Format diizinkan: JPG, PNG, atau WebP (maks. 2 MB).
                          </span>
                          {doctorPhoto && (
                            <button
                              type="button"
                              className="text-button"
                              style={{ alignSelf: "flex-start" }}
                              onClick={() => {
                                setDoctorPhoto("");
                                setDoctorPhotoError("");
                              }}
                            >
                              Hapus foto
                            </button>
                          )}
                        </div>
                      </div>
                      {doctorPhotoError && (
                        <small style={{ color: "#b91c1c", marginTop: "4px" }}>
                          {doctorPhotoError}
                        </small>
                      )}
                    </Field>
                    <fieldset className="ws-checklist">
                      <legend>Layanan yang ditangani</legend>
                      {services.map((s) => (
                        <label key={s.id}>
                          <input
                            name="services"
                            type="checkbox"
                            value={s.id}
                            defaultChecked={editRecord?.services.includes(s.id)}
                          />
                          {s.name}
                        </label>
                      ))}
                    </fieldset>
                  </>
                )}
                {editor.type === "Layanan" && (
                  <>
                    <Field label="Deskripsi">
                      <textarea
                        name="description"
                        required
                        defaultValue={editService?.description}
                      />
                    </Field>
                    <Field label="Durasi (menit)">
                      <input
                        name="duration"
                        type="number"
                        required
                        min="1"
                        max="480"
                        defaultValue={editService?.duration || 30}
                      />
                    </Field>
                  </>
                )}
                {editor.type === "Jadwal" && (
                  <>
                    <Field label="Dokter">
                      <select name="doctor" defaultValue={editSchedule?.doctor}>
                        {doctors
                          .filter(
                            (d) => d.active || d.id === editSchedule?.doctor,
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Hari praktik">
                      <select name="day" defaultValue={editSchedule?.day ?? 1}>
                        {[
                          "Minggu",
                          "Senin",
                          "Selasa",
                          "Rabu",
                          "Kamis",
                          "Jumat",
                          "Sabtu",
                        ].map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="ws-form-grid">
                      <Field label="Jam mulai">
                        <input
                          name="start"
                          required
                          type="time"
                          defaultValue={editSchedule?.start || "08:00"}
                        />
                      </Field>
                      <Field label="Jam selesai">
                        <input
                          name="end"
                          required
                          type="time"
                          defaultValue={editSchedule?.end || "12:00"}
                        />
                      </Field>
                    </div>
                    <Field label="Kuota per sesi">
                      <input
                        name="quota"
                        required
                        type="number"
                        min="1"
                        defaultValue={editSchedule?.quota || 5}
                      />
                    </Field>
                    <div className="notice">
                      Jadwal bentrok ditolak. Kuota harus lebih dari nol.
                    </div>
                  </>
                )}
                {editor.type === "Pengguna" && (
                  <>
                    <Field label="Email staf">
                      <input
                        name="email"
                        required
                        type="email"
                        placeholder="nama@sehatklinik.id"
                      />
                    </Field>
                    <Field label="Peran">
                      <select name="role" defaultValue="Petugas">
                        <option>Petugas</option>
                        <option>Dokter</option>
                        <option>Admin</option>
                      </select>
                    </Field>
                    <Field label="Password akun">
                      <input
                        name="password"
                        type="password"
                        placeholder="Minimal 8 karakter"
                        defaultValue="password123"
                      />
                    </Field>
                    <div className="notice">
                      Akun staf yang didaftarkan langsung aktif dan dapat
                      digunakan untuk login ke dashboard peran masing-masing.
                    </div>
                  </>
                )}
                {["Dokter", "Layanan", "Jadwal"].includes(editor.type) && (
                  <Field label="Status">
                    <select
                      name="active"
                      defaultValue={
                        (editRecord || editService || editSchedule)?.active ===
                        false
                          ? "Nonaktif"
                          : "Aktif"
                      }
                    >
                      <option>Aktif</option>
                      <option>Nonaktif</option>
                    </select>
                  </Field>
                )}
                {showError}
              {Object.keys(profilFieldErrors).length > 0 && (
                <div className="ws-error" role="alert">
                  <Icon name="help" size={18} />
                  {Object.entries(profilFieldErrors)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" — ")}
                </div>
              )}
              <div className="form-actions">
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => setEditor(null)}
                  >
                    Batal
                  </button>
                  <button className="primary" type="submit" disabled={busy}>
                    {busy ? "Menyimpan..." : "Simpan Data Demo"}
                    <Icon name="check" size={16} />
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        <NotificationDrawer />
      </div>

      {showAuthModal && (
        <div
          className="web-dialog-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            padding: "20px",
            overflowY: "auto",
          }}
        >
          <div
            className="web-dialog web-auth-form"
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#ffffff",
              borderRadius: "18px",
              padding: "32px 28px",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
              position: "relative",
              margin: "auto",
            }}
          >
            <button
              className="web-dialog-close"
              aria-label="Kembali ke Beranda"
              title="Kembali ke Beranda"
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                position: "absolute",
                right: "18px",
                top: "18px",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                color: "#94a3b8",
                padding: "6px",
                borderRadius: "8px",
              }}
            >
              <Icon name="close" size={18} />
            </button>

            <span className="web-service-icon" style={{ marginBottom: "16px" }}>
              <Icon
                name={
                  initialRole === "Dokter"
                    ? "heart"
                    : initialRole === "Admin"
                      ? "shield"
                      : "clinic"
                }
                size={27}
              />
            </span>

            <h2
              style={{
                fontSize: "22px",
                margin: "0 0 8px",
                color: "#1e293b",
                fontWeight: 700,
              }}
            >
              Masuk Dashboard {staffRoleName}
            </h2>
            <p
              style={{
                fontSize: "12px",
                color: "#64748b",
                margin: "0 0 20px",
                lineHeight: 1.6,
              }}
            >
              Halaman ini memerlukan autentikasi akun staf terdaftar. Silakan
              masuk untuk mengakses panel kendali {initialRole}.
            </p>

            {modalError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#b91c1c",
                  fontSize: "12px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Icon name="help" size={16} />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleModalLogin();
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#334155",
                }}
              >
                Email Staf
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={modalEmail}
                  onChange={(e) => {
                    setModalEmail(e.target.value);
                    setModalError("");
                  }}
                  placeholder="nama@sehatklinik.id"
                  style={{
                    marginTop: "6px",
                    width: "100%",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <label
                style={{
                  display: "block",
                  marginBottom: "18px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#334155",
                }}
              >
                Password
                <div
                  className="web-password"
                  style={{ marginTop: "6px", position: "relative" }}
                >
                  <input
                    type={modalShowPassword ? "text" : "password"}
                    required
                    value={modalPassword}
                    onChange={(e) => {
                      setModalPassword(e.target.value);
                      setModalError("");
                    }}
                    autoComplete="current-password"
                    placeholder="Minimal 6 karakter"
                    style={{
                      width: "100%",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      paddingRight: "80px",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setModalShowPassword(!modalShowPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {modalShowPassword ? "Sembunyikan" : "Lihat"}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={modalBusy}
                style={{
                  width: "100%",
                  minHeight: "46px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  cursor: modalBusy ? "not-allowed" : "pointer",
                  opacity: modalBusy ? 0.7 : 1,
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                  transition: "background 0.2s, transform 0.1s",
                  marginTop: "8px",
                }}
              >
                {modalBusy ? (
                  "Memverifikasi akun..."
                ) : (
                  <>
                    Masuk ke Dashboard {initialRole}{" "}
                    <Icon name="arrow" size={18} />
                  </>
                )}
              </button>
            </form>

            <p
              className="web-auth-switch"
              style={{
                marginTop: "20px",
                marginBottom: 0,
                textAlign: "center",
              }}
            >
              Bukan staf klinik?{" "}
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Kembali ke Beranda
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
