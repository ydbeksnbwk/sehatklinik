const TZ = "Asia/Jakarta";

export const hariIni = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

export const jamSekarang = () =>
  new Date()
    .toLocaleTimeString("en-GB", { timeZone: TZ, hour12: false })
    .slice(0, 5);

export function tanggalValid(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// 0 = Minggu ... 6 = Sabtu
export const hariDariTanggal = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
export function selisihJamKe(tanggal, jam) {
  const target = Date.parse(`${tanggal}T${String(jam).slice(0, 5)}:00+07:00`);
  return (target - Date.now()) / 3600000;
}
