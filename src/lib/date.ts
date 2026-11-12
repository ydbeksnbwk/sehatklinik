/**
 * Utilitas format tanggal bahasa Indonesia untuk aplikasi Klinik Sehat Sentosa.
 */

export const getTodayFormatted = (options?: Intl.DateTimeFormatOptions): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  };
  return new Date().toLocaleDateString("id-ID", options || defaultOptions);
};

export const getTodayDateOnly = (): string => {
  return new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
};

export const getTodayISODate = (): string => {
  // Format YYYY-MM-DD standar Asia/Jakarta (WIB)
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
};

export const formatDateIndonesian = (
  dateInput?: string | Date | number | null,
  includeWeekday = false
): string => {
  if (!dateInput) return "";
  try {
    const d =
      typeof dateInput === "string" && !dateInput.includes("T")
        ? new Date(`${dateInput}T12:00:00+07:00`)
        : new Date(dateInput);

    if (Number.isNaN(d.getTime())) return String(dateInput);

    return d.toLocaleDateString("id-ID", {
      ...(includeWeekday ? { weekday: "long" } : {}),
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  } catch {
    return String(dateInput);
  }
};
