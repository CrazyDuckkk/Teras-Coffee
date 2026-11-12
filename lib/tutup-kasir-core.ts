import { eq, sql } from "drizzle-orm";
import type { db } from "@/db";
import { tutupKasir } from "@/db/schema";
import { getTodayDateStringWIB, TIMEZONE_KEDAI } from "@/lib/date";

export type TutupKasirDbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const DEFAULT_JAM_TUTUP_KASIR = "23:59";
export const KUNCI_JADWAL_TUTUP_KASIR = "jam_tutup_otomatis";
const LOCK_NAMESPACE_TUTUP_KASIR = 1415072595;

export interface JadwalTutupKasir {
  jamAktif: string;
  berikutnya: { jam: string; berlakuMulai: string } | null;
}

export interface HitungRekonsiliasiInput {
  kasAwal: number | string;
  penjualanTunai: number | string;
  pembayaranHutangTunai: number | string;
  pembelianKasLaci: number | string;
  kasFisik?: number | string;
  qrisTerhitung?: number | string;
  penjualanQris: number | string;
  pembayaranHutangQris: number | string;
}

export function isJamValid(jam: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(jam);
}

function isTanggalValid(tanggal: unknown): tanggal is string {
  if (typeof tanggal !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
  const parsed = new Date(`${tanggal}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === tanggal;
}

export function parseJadwalTutupKasir(nilai: string | null): JadwalTutupKasir {
  if (!nilai) return { jamAktif: DEFAULT_JAM_TUTUP_KASIR, berikutnya: null };
  if (isJamValid(nilai)) return { jamAktif: nilai, berikutnya: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(nilai);
  } catch {
    throw new Error("Pengaturan jam tutup otomatis tidak valid.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Pengaturan jam tutup otomatis tidak valid.");
  }

  const value = parsed as Record<string, unknown>;
  const jamAktif = value.jamAktif;
  const berikutnya = value.berikutnya;
  if (typeof jamAktif !== "string" || !isJamValid(jamAktif)) {
    throw new Error("Pengaturan jam tutup otomatis tidak valid.");
  }
  if (berikutnya === null || berikutnya === undefined) {
    return { jamAktif, berikutnya: null };
  }
  if (!berikutnya || typeof berikutnya !== "object") {
    throw new Error("Pengaturan jam tutup otomatis tidak valid.");
  }

  const next = berikutnya as Record<string, unknown>;
  if (
    typeof next.jam !== "string" ||
    !isJamValid(next.jam) ||
    !isTanggalValid(next.berlakuMulai)
  ) {
    throw new Error("Pengaturan jam tutup otomatis tidak valid.");
  }

  return { jamAktif, berikutnya: { jam: next.jam, berlakuMulai: next.berlakuMulai } };
}

export function getJamTutupUntukTanggal(jadwal: JadwalTutupKasir, tanggal: string): string {
  if (jadwal.berikutnya && tanggal >= jadwal.berikutnya.berlakuMulai) {
    return jadwal.berikutnya.jam;
  }
  return jadwal.jamAktif;
}

export function getTanggalBesokWIB(tanggal: string): string {
  const [year, month, day] = tanggal.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function buatJadwalTutupBerikutnya(
  jadwal: JadwalTutupKasir,
  jamBaru: string,
  hariIni: string,
): JadwalTutupKasir {
  if (!isJamValid(jamBaru)) throw new Error("Jam tutup otomatis tidak valid.");
  return {
    jamAktif: getJamTutupUntukTanggal(jadwal, hariIni),
    berikutnya: { jam: jamBaru, berlakuMulai: getTanggalBesokWIB(hariIni) },
  };
}

export function isWaktuTutupTiba(now: Date, jamTutup: string): boolean {
  if (!isJamValid(jamTutup)) throw new Error("Jam tutup otomatis tidak valid.");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE_KEDAI,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const [closeHour, closeMinute] = jamTutup.split(":").map(Number);
  return hour * 60 + minute >= closeHour * 60 + closeMinute;
}

function toSen(value: number | string): number {
  const amount = Number(value);
  const sen = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(sen)) {
    throw new Error("Nilai rekonsiliasi kas terlalu besar atau tidak valid.");
  }
  return sen;
}

function fromSen(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Nilai rekonsiliasi kas terlalu besar atau tidak valid.");
  }
  return (value / 100).toFixed(2);
}

export function hitungRekonsiliasiKas(input: HitungRekonsiliasiInput) {
  const kasDiharapkanSen =
    toSen(input.kasAwal) +
    toSen(input.penjualanTunai) +
    toSen(input.pembayaranHutangTunai) -
    toSen(input.pembelianKasLaci);
  const qrisSistemSen = toSen(input.penjualanQris) + toSen(input.pembayaranHutangQris);

  return {
    kasDiharapkan: fromSen(kasDiharapkanSen),
    qrisSistem: fromSen(qrisSistemSen),
    selisihKas:
      input.kasFisik === undefined
        ? null
        : fromSen(toSen(input.kasFisik) - kasDiharapkanSen),
    selisihQris:
      input.qrisTerhitung === undefined
        ? null
        : fromSen(toSen(input.qrisTerhitung) - qrisSistemSen),
  };
}

export async function lockTanggalTutupKasir(tx: TutupKasirDbOrTx, tanggal: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${LOCK_NAMESPACE_TUTUP_KASIR}, hashtext(${tanggal}))`,
  );
}

export async function apakahSetelahTutupKasir(tx: TutupKasirDbOrTx, now: Date): Promise<boolean> {
  const tanggal = getTodayDateStringWIB(now);
  await lockTanggalTutupKasir(tx, tanggal);
  const [row] = await tx
    .select({ id: tutupKasir.id })
    .from(tutupKasir)
    .where(eq(tutupKasir.tanggal, tanggal))
    .limit(1);
  return row !== undefined;
}

export async function siapkanPencatatanKasTx(tx: TutupKasirDbOrTx, waktuUji?: Date) {
  let timestamp = waktuUji ?? new Date();
  for (;;) {
    const tanggal = getTodayDateStringWIB(timestamp);
    await lockTanggalTutupKasir(tx, tanggal);
    if (!waktuUji) timestamp = new Date();
    if (getTodayDateStringWIB(timestamp) !== tanggal) continue;

    const [row] = await tx
      .select({ id: tutupKasir.id })
      .from(tutupKasir)
      .where(eq(tutupKasir.tanggal, tanggal))
      .limit(1);
    return { tanggal, timestamp, setelahTutup: row !== undefined };
  }
}
