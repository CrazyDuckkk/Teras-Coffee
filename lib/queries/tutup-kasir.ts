import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  detailTransaksi,
  hutangPembayaran,
  menu,
  pengaturan,
  stockMasuk,
  transaksi,
  tutupKasir,
  user,
} from "@/db/schema";
import { getTodayDateStringWIB, getTodayRangeWIB } from "@/lib/date";
import {
  buatJadwalTutupBerikutnya,
  getJamTutupUntukTanggal,
  hitungRekonsiliasiKas,
  isWaktuTutupTiba,
  KUNCI_JADWAL_TUTUP_KASIR,
  lockTanggalTutupKasir,
  parseJadwalTutupKasir,
} from "@/lib/tutup-kasir-core";
import type { TutupKasirInput } from "@/lib/validations/tutup-kasir";
import { requireRole } from "@/lib/auth-guard";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class SudahTutupKasirError extends Error {
  constructor() {
    super("Kasir hari ini sudah ditutup sebelumnya.");
    this.name = "SudahTutupKasirError";
  }
}

export interface RingkasanHarian {
  totalPenjualan: number;
  totalPengeluaran: number;
  labaKotor: number;
  menuTerlaris: { menuId: string; nama: string; qty: number } | null;
}

async function calculateRingkasanHarian(tx: DbOrTx, now: Date): Promise<RingkasanHarian> {
  const { start, end } = getTodayRangeWIB(now);

  const [transaksiHariIni, transaksiTunaiHariIni, pembayaranHutangHariIni, stockMasukHariIni] =
    await Promise.all([
      tx
        .select()
        .from(transaksi)
        .where(
          and(
            inArray(transaksi.status, ["aktif", "menunggu_void"]),
            gte(transaksi.tanggal, start),
            lt(transaksi.tanggal, end),
          ),
        ),
      tx
        .select({ totalPemasukan: transaksi.totalPemasukan })
        .from(transaksi)
        .where(
          and(
            inArray(transaksi.status, ["aktif", "menunggu_void"]),
            inArray(transaksi.metodeBayar, ["tunai", "qris"]),
            gte(transaksi.tanggal, start),
            lt(transaksi.tanggal, end),
          ),
        ),
      tx
        .select({ jumlah: hutangPembayaran.jumlah })
        .from(hutangPembayaran)
        .where(
          and(
            isNull(hutangPembayaran.dibatalkanAt),
            gte(hutangPembayaran.dibayarAt, start),
            lt(hutangPembayaran.dibayarAt, end),
          ),
        ),
      tx
        .select({ totalPengeluaran: stockMasuk.totalPengeluaran })
        .from(stockMasuk)
        .where(
          and(
            isNull(stockMasuk.dibatalkanAt),
            gte(stockMasuk.tanggal, start),
            lt(stockMasuk.tanggal, end),
          ),
        ),
    ]);

  const totalPenjualan =
    transaksiTunaiHariIni.reduce((sum, row) => sum + Number(row.totalPemasukan), 0) +
    pembayaranHutangHariIni.reduce((sum, row) => sum + Number(row.jumlah), 0);
  const totalPengeluaran = stockMasukHariIni.reduce(
    (sum, row) => sum + Number(row.totalPengeluaran),
    0,
  );

  let menuTerlaris: RingkasanHarian["menuTerlaris"] = null;
  if (transaksiHariIni.length > 0) {
    const details = await tx
      .select({ menuId: detailTransaksi.menuId, qty: detailTransaksi.qty, menuNama: menu.nama })
      .from(detailTransaksi)
      .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
      .where(inArray(detailTransaksi.transaksiId, transaksiHariIni.map((row) => row.id)));

    const qtyByMenu = new Map<string, { nama: string; qty: number }>();
    for (const detail of details) {
      const current = qtyByMenu.get(detail.menuId) ?? { nama: detail.menuNama, qty: 0 };
      current.qty += detail.qty;
      qtyByMenu.set(detail.menuId, current);
    }
    const sorted = [...qtyByMenu.entries()].sort((a, b) => b[1].qty - a[1].qty);
    if (sorted.length > 0) {
      menuTerlaris = { menuId: sorted[0][0], nama: sorted[0][1].nama, qty: sorted[0][1].qty };
    }
  }

  return {
    totalPenjualan,
    totalPengeluaran,
    labaKotor: totalPenjualan - totalPengeluaran,
    menuTerlaris,
  };
}

async function calculateArusKasTutup(tx: DbOrTx, now: Date) {
  const { start, end } = getTodayRangeWIB(now);
  const [penjualanTunai, penjualanQris, pembayaranTunai, pembayaranQris, pembelianKasLaci] =
    await Promise.all([
      tx
        .select({ total: sql<string>`coalesce(sum(${transaksi.totalPemasukan}), 0)` })
        .from(transaksi)
        .where(
          and(
            inArray(transaksi.status, ["aktif", "menunggu_void"]),
            eq(transaksi.metodeBayar, "tunai"),
            gte(transaksi.tanggal, start),
            lt(transaksi.tanggal, end),
          ),
        ),
      tx
        .select({ total: sql<string>`coalesce(sum(${transaksi.totalPemasukan}), 0)` })
        .from(transaksi)
        .where(
          and(
            inArray(transaksi.status, ["aktif", "menunggu_void"]),
            eq(transaksi.metodeBayar, "qris"),
            gte(transaksi.tanggal, start),
            lt(transaksi.tanggal, end),
          ),
        ),
      tx
        .select({ total: sql<string>`coalesce(sum(${hutangPembayaran.jumlah}), 0)` })
        .from(hutangPembayaran)
        .where(
          and(
            isNull(hutangPembayaran.dibatalkanAt),
            eq(hutangPembayaran.metode, "tunai"),
            gte(hutangPembayaran.dibayarAt, start),
            lt(hutangPembayaran.dibayarAt, end),
          ),
        ),
      tx
        .select({ total: sql<string>`coalesce(sum(${hutangPembayaran.jumlah}), 0)` })
        .from(hutangPembayaran)
        .where(
          and(
            isNull(hutangPembayaran.dibatalkanAt),
            eq(hutangPembayaran.metode, "qris"),
            gte(hutangPembayaran.dibayarAt, start),
            lt(hutangPembayaran.dibayarAt, end),
          ),
        ),
      tx
        .select({ total: sql<string>`coalesce(sum(${stockMasuk.totalPengeluaran}), 0)` })
        .from(stockMasuk)
        .where(
          and(
            isNull(stockMasuk.dibatalkanAt),
            eq(stockMasuk.dibayarDari, "kas_laci"),
            gte(stockMasuk.tanggal, start),
            lt(stockMasuk.tanggal, end),
          ),
        ),
    ]);

  return {
    penjualanTunai: penjualanTunai[0].total,
    penjualanQris: penjualanQris[0].total,
    pembayaranHutangTunai: pembayaranTunai[0].total,
    pembayaranHutangQris: pembayaranQris[0].total,
    pembelianKasLaci: pembelianKasLaci[0].total,
  };
}

async function getKasAwalPenutupanSebelumnya(tx: DbOrTx, tanggal: string): Promise<string | null> {
  const [previous] = await tx
    .select({
      kasFisik: tutupKasir.kasFisik,
      kasDiharapkan: tutupKasir.kasDiharapkan,
      createdAt: tutupKasir.createdAt,
    })
    .from(tutupKasir)
    .where(
      and(
        lt(tutupKasir.tanggal, tanggal),
        or(isNotNull(tutupKasir.kasFisik), isNotNull(tutupKasir.kasDiharapkan)),
      ),
    )
    .orderBy(desc(tutupKasir.tanggal))
    .limit(1);
  const kasTerakhir = previous?.kasFisik ?? previous?.kasDiharapkan;
  if (!previous || kasTerakhir === null) return null;

  const awalHariIni = getTodayRangeWIB(new Date(`${tanggal}T00:00:00Z`)).start;
  const [penjualanTunai, pembayaranHutangTunai, pembelianKasLaci] = await Promise.all([
    tx
      .select({ total: sql<string>`coalesce(sum(${transaksi.totalPemasukan}), 0)` })
      .from(transaksi)
      .where(
        and(
          inArray(transaksi.status, ["aktif", "menunggu_void"]),
          eq(transaksi.metodeBayar, "tunai"),
          eq(transaksi.setelahTutup, true),
          gte(transaksi.tanggal, previous.createdAt),
          lt(transaksi.tanggal, awalHariIni),
        ),
      ),
    tx
      .select({ total: sql<string>`coalesce(sum(${hutangPembayaran.jumlah}), 0)` })
      .from(hutangPembayaran)
      .where(
        and(
          isNull(hutangPembayaran.dibatalkanAt),
          eq(hutangPembayaran.metode, "tunai"),
          eq(hutangPembayaran.setelahTutup, true),
          gte(hutangPembayaran.dibayarAt, previous.createdAt),
          lt(hutangPembayaran.dibayarAt, awalHariIni),
        ),
      ),
    tx
      .select({ total: sql<string>`coalesce(sum(${stockMasuk.totalPengeluaran}), 0)` })
      .from(stockMasuk)
      .where(
        and(
          isNull(stockMasuk.dibatalkanAt),
          eq(stockMasuk.dibayarDari, "kas_laci"),
          eq(stockMasuk.setelahTutup, true),
          gte(stockMasuk.tanggal, previous.createdAt),
          lt(stockMasuk.tanggal, awalHariIni),
        ),
      ),
  ]);
  return hitungRekonsiliasiKas({
    kasAwal: kasTerakhir,
    penjualanTunai: penjualanTunai[0].total,
    pembayaranHutangTunai: pembayaranHutangTunai[0].total,
    pembelianKasLaci: pembelianKasLaci[0].total,
    penjualanQris: "0",
    pembayaranHutangQris: "0",
  }).kasDiharapkan;
}

function isDuplicateCloseDate(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "tutup_kasir_tanggal_unique"
  ) {
    return true;
  }
  return "cause" in error && error.cause !== error && isDuplicateCloseDate(error.cause);
}

async function simpanRingkasanLama(tx: DbOrTx, now: Date) {
  const ringkasan = await calculateRingkasanHarian(tx, now);
  return {
    totalPenjualan: ringkasan.totalPenjualan.toFixed(2),
    totalPengeluaran: ringkasan.totalPengeluaran.toFixed(2),
    labaKotor: ringkasan.labaKotor.toFixed(2),
    menuTerlarisId: ringkasan.menuTerlaris?.menuId ?? null,
  };
}

export async function getRingkasanHarian(now: Date = new Date()): Promise<RingkasanHarian> {
  await requireRole("owner");
  return calculateRingkasanHarian(db, now);
}

export async function getTutupKasirHariIni(now: Date = new Date()) {
  await requireRole("owner");
  const tanggal = getTodayDateStringWIB(now);
  const [row] = await db
    .select({ tutupKasir, menuTerlarisNama: menu.nama })
    .from(tutupKasir)
    .leftJoin(menu, eq(menu.id, tutupKasir.menuTerlarisId))
    .where(eq(tutupKasir.tanggal, tanggal))
    .limit(1);
  if (!row) return null;
  return { ...row.tutupKasir, menuTerlarisNama: row.menuTerlarisNama };
}

export async function getTutupKasirHariIniKasir(now: Date = new Date()) {
  await requireRole("owner", "cashier");
  const tanggal = getTodayDateStringWIB(now);
  const [row] = await db
    .select({
      tanggal: tutupKasir.tanggal,
      kasAwal: tutupKasir.kasAwal,
      kasFisik: tutupKasir.kasFisik,
      qrisTerhitung: tutupKasir.qrisTerhitung,
      kasDiharapkan: tutupKasir.kasDiharapkan,
      qrisSistem: tutupKasir.qrisSistem,
      selisihKas: tutupKasir.selisihKas,
      selisihQris: tutupKasir.selisihQris,
      catatan: tutupKasir.catatan,
      statusPenutupan: tutupKasir.statusPenutupan,
      createdAt: tutupKasir.createdAt,
    })
    .from(tutupKasir)
    .where(eq(tutupKasir.tanggal, tanggal))
    .limit(1);
  return row ?? null;
}

export async function getKasAwalTutupKasir(now: Date = new Date()) {
  await requireRole("owner", "cashier");
  return getKasAwalPenutupanSebelumnya(db, getTodayDateStringWIB(now));
}

export async function createTutupKasir(
  pelakuId: string,
  input: TutupKasirInput,
  now: Date = new Date(),
) {
  await requireRole("owner", "cashier");
  const tanggal = getTodayDateStringWIB(now);

  try {
    return await db.transaction(async (tx) => {
      await lockTanggalTutupKasir(tx, tanggal);
      const [existing] = await tx
        .select({ id: tutupKasir.id })
        .from(tutupKasir)
        .where(eq(tutupKasir.tanggal, tanggal))
        .limit(1);
      if (existing) throw new SudahTutupKasirError();

      const [ringkasan, arusKas] = await Promise.all([
        simpanRingkasanLama(tx, now),
        calculateArusKasTutup(tx, now),
      ]);
      const rekonsiliasi = hitungRekonsiliasiKas({
        ...arusKas,
        kasAwal: input.kasAwal,
        kasFisik: input.kasFisik,
        qrisTerhitung: input.qrisTerhitung,
      });

      const [row] = await tx
        .insert(tutupKasir)
        .values({
          tanggal,
          ...ringkasan,
          pelakuId,
          createdAt: now,
          kasAwal: Number(input.kasAwal).toFixed(2),
          kasFisik: Number(input.kasFisik).toFixed(2),
          qrisTerhitung: Number(input.qrisTerhitung).toFixed(2),
          kasDiharapkan: rekonsiliasi.kasDiharapkan,
          qrisSistem: rekonsiliasi.qrisSistem,
          selisihKas: rekonsiliasi.selisihKas,
          selisihQris: rekonsiliasi.selisihQris,
          catatan: input.catatan?.trim() || null,
          statusPenutupan: "manual",
        })
        .returning();
      return row;
    });
  } catch (error) {
    if (isDuplicateCloseDate(error)) throw new SudahTutupKasirError();
    throw error;
  }
}

export async function tutupKasirOtomatisJikaTiba(waktuUji?: Date) {
  let timestamp = waktuUji ?? new Date();
  const tanggal = getTodayDateStringWIB(timestamp);
  try {
    return await db.transaction(async (tx) => {
      await lockTanggalTutupKasir(tx, tanggal);
      if (!waktuUji) {
        timestamp = new Date();
        if (getTodayDateStringWIB(timestamp) !== tanggal) {
          return { status: "hari_berubah" as const };
        }
      }

      const [existing] = await tx
        .select({ id: tutupKasir.id })
        .from(tutupKasir)
        .where(eq(tutupKasir.tanggal, tanggal))
        .limit(1);
      if (existing) return { status: "sudah_tutup" as const };

      const [setting] = await tx
        .select({ nilai: pengaturan.nilai })
        .from(pengaturan)
        .where(eq(pengaturan.kunci, KUNCI_JADWAL_TUTUP_KASIR))
        .limit(1);
      const jadwal = parseJadwalTutupKasir(setting?.nilai ?? null);
      const jamTutup = getJamTutupUntukTanggal(jadwal, tanggal);
      if (!isWaktuTutupTiba(timestamp, jamTutup)) {
        return { status: "belum_waktunya" as const };
      }

      const [kasAwalSebelumnya, ringkasan, arusKas] = await Promise.all([
        getKasAwalPenutupanSebelumnya(tx, tanggal),
        simpanRingkasanLama(tx, timestamp),
        calculateArusKasTutup(tx, timestamp),
      ]);
      const kasAwal = kasAwalSebelumnya ?? "0.00";
      const rekonsiliasi = hitungRekonsiliasiKas({ ...arusKas, kasAwal });
      await tx.insert(tutupKasir).values({
        tanggal,
        ...ringkasan,
        pelakuId: null,
        createdAt: timestamp,
        kasAwal,
        kasDiharapkan: rekonsiliasi.kasDiharapkan,
        qrisSistem: rekonsiliasi.qrisSistem,
        statusPenutupan: "otomatis_belum_diverifikasi",
      });
      return { status: "ditutup" as const };
    });
  } catch (error) {
    if (isDuplicateCloseDate(error)) return { status: "sudah_tutup" as const };
    throw error;
  }
}

export async function getPengaturanJamTutupKasir(now: Date = new Date()) {
  await requireRole("owner");
  const [row] = await db
    .select({
      nilai: pengaturan.nilai,
      diperbaruiPada: pengaturan.diperbaruiPada,
      diperbaruiOlehNama: user.name,
    })
    .from(pengaturan)
    .leftJoin(user, eq(user.id, pengaturan.diperbaruiOlehId))
    .where(eq(pengaturan.kunci, KUNCI_JADWAL_TUTUP_KASIR))
    .limit(1);

  const jadwal = parseJadwalTutupKasir(row?.nilai ?? null);
  const tanggal = getTodayDateStringWIB(now);
  return {
    jamAktif: getJamTutupUntukTanggal(jadwal, tanggal),
    berikutnya:
      jadwal.berikutnya && jadwal.berikutnya.berlakuMulai > tanggal
        ? jadwal.berikutnya
        : null,
    diperbaruiPada: row?.diperbaruiPada ?? null,
    diperbaruiOlehNama: row?.diperbaruiOlehNama ?? null,
  };
}

export async function ubahJamTutupKasir(jam: string, pelakuId: string, now: Date = new Date()) {
  await requireRole("owner");
  const hariIni = getTodayDateStringWIB(now);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ nilai: pengaturan.nilai })
      .from(pengaturan)
      .where(eq(pengaturan.kunci, KUNCI_JADWAL_TUTUP_KASIR))
      .for("update");
    const jadwal = buatJadwalTutupBerikutnya(
      parseJadwalTutupKasir(existing?.nilai ?? null),
      jam,
      hariIni,
    );
    const [row] = await tx
      .insert(pengaturan)
      .values({
        kunci: KUNCI_JADWAL_TUTUP_KASIR,
        nilai: JSON.stringify(jadwal),
        diperbaruiPada: now,
        diperbaruiOlehId: pelakuId,
      })
      .onConflictDoUpdate({
        target: pengaturan.kunci,
        set: {
          nilai: JSON.stringify(jadwal),
          diperbaruiPada: now,
          diperbaruiOlehId: pelakuId,
        },
      })
      .returning({ nilai: pengaturan.nilai });
    return { ...jadwal, nilai: row.nilai, diperbaruiPada: now };
  });
}

export async function listRiwayatTutupKasir(limit = 30) {
  await requireRole("owner");
  const rows = await db
    .select({ tutupKasir, menuTerlarisNama: menu.nama, pelakuNama: user.name })
    .from(tutupKasir)
    .leftJoin(menu, eq(menu.id, tutupKasir.menuTerlarisId))
    .leftJoin(user, eq(user.id, tutupKasir.pelakuId))
    .orderBy(desc(tutupKasir.tanggal))
    .limit(limit);

  return rows.map((row) => ({
    ...row.tutupKasir,
    menuTerlarisNama: row.menuTerlarisNama,
    pelakuNama: row.pelakuNama,
  }));
}
