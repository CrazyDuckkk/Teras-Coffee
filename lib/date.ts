/**
 * Timezone kedai di-hardcode Asia/Jakarta (WIB, UTC+7) — versi single-kedai.
 * Semua batas "hari ini"/periode di Dashboard, Keuangan, dan nanti Tutup Kasir
 * WAJIB lewat helper di file ini, bukan hitung manual dari Date server (UTC).
 */
export const TIMEZONE_KEDAI = "Asia/Jakarta";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Mengembalikan [awal, akhir) hari ini dalam WIB, sebagai Date UTC — dipakai untuk filter query `>= awal AND < akhir`. */
export function getTodayRangeWIB(now: Date = new Date()): { start: Date; end: Date } {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear();
  const m = wibNow.getUTCMonth();
  const d = wibNow.getUTCDate();
  const startWIBAsUTC = Date.UTC(y, m, d, 0, 0, 0, 0);
  const start = new Date(startWIBAsUTC - WIB_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Mengembalikan [awal, akhir) N hari terakhir (termasuk hari ini) dalam WIB. */
export function getRangeLastNDaysWIB(n: number, now: Date = new Date()): { start: Date; end: Date } {
  const { end } = getTodayRangeWIB(now);
  const start = new Date(end.getTime() - n * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Mengembalikan rentang minggu berjalan (Senin sampai Senin berikutnya) dalam WIB. */
export function getWeekRangeWIB(now: Date = new Date()): { start: Date; end: Date } {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const year = wibNow.getUTCFullYear();
  const month = wibNow.getUTCMonth();
  const day = wibNow.getUTCDate();
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const start = new Date(Date.UTC(year, month, day - daysSinceMonday) - WIB_OFFSET_MS);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Mengembalikan rentang bulan berjalan dalam WIB. */
export function getMonthRangeWIB(now: Date = new Date()): { start: Date; end: Date } {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const year = wibNow.getUTCFullYear();
  const month = wibNow.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - WIB_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - WIB_OFFSET_MS),
  };
}

/** Tanggal hari ini dalam WIB sebagai string "YYYY-MM-DD" — dipakai untuk kolom `date` (mis. tutup_kasir.tanggal). */
export function getTodayDateStringWIB(now: Date = new Date()): string {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear();
  const m = String(wibNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wibNow.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format Date ke string tanggal Indonesia sesuai WIB, mis. "10 Juli 2026". */
export function formatTanggalWIB(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE_KEDAI,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Format Date ke string tanggal+jam Indonesia sesuai WIB, mis. "10 Juli 2026, 14.05". */
export function formatTanggalWaktuWIB(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE_KEDAI,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatUmurMenit(menit: number | null): string {
  if (menit === null) return "—";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam`;
  return `${Math.floor(jam / 24)} hari`;
}
