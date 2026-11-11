import { and, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { detailTransaksi, hutang, menu, stockMasuk, transaksi, tutupKasir } from "@/db/schema";
import { getTodayDateStringWIB, getTodayRangeWIB } from "@/lib/date";
import { requireRole } from "@/lib/auth-guard";

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

/**
 * Ringkasan transaksi aktif + stock masuk hari ini (WIB), dihitung live (belum tersimpan).
 * totalPenjualan/labaKotor di sini adalah angka CASH-FLOW (selaras dengan "saldo" di modul
 * Keuangan): transaksi TUNAI hari ini + hutang yang dilunasi hari ini (walau transaksi
 * hutangnya sendiri terjadi di hari lain) — hutang yang belum lunas TIDAK ikut dihitung.
 * BEDA dari "Laba Kotor" di Dashboard yang berbasis margin per item (hargaJual - hpp) atas
 * SEMUA penjualan aktif hari ini (termasuk hutang yang belum lunas — barang sudah keluar).
 * menuTerlaris juga dihitung dari semua penjualan aktif hari ini, bukan cuma yang tunai.
 * Field totalPenjualan/labaKotor inilah yang disimpan ke tabel tutup_kasir.
 */
export async function getRingkasanHarian(now: Date = new Date()): Promise<RingkasanHarian> {
  await requireRole("owner");
  return calculateRingkasanHarian(now);
}

async function calculateRingkasanHarian(now: Date): Promise<RingkasanHarian> {
  const { start, end } = getTodayRangeWIB(now);

  const [transaksiHariIni, transaksiTunaiHariIni, hutangLunasHariIni, stockMasukHariIni] = await Promise.all([
    db
      .select()
      .from(transaksi)
      .where(and(eq(transaksi.status, "aktif"), gte(transaksi.tanggal, start), lt(transaksi.tanggal, end))),
    db
      .select({ totalPemasukan: transaksi.totalPemasukan })
      .from(transaksi)
      .where(
        and(
          eq(transaksi.status, "aktif"),
          eq(transaksi.metodeBayar, "tunai"),
          gte(transaksi.tanggal, start),
          lt(transaksi.tanggal, end)
        )
      ),
    db
      .select({ jumlah: hutang.jumlah })
      .from(hutang)
      .where(and(eq(hutang.status, "lunas"), isNotNull(hutang.tanggalLunas), gte(hutang.tanggalLunas, start), lt(hutang.tanggalLunas, end))),
    db
      .select({ totalPengeluaran: stockMasuk.totalPengeluaran })
      .from(stockMasuk)
      .where(and(gte(stockMasuk.tanggal, start), lt(stockMasuk.tanggal, end))),
  ]);

  const totalPenjualan =
    transaksiTunaiHariIni.reduce((sum, t) => sum + Number(t.totalPemasukan), 0) +
    hutangLunasHariIni.reduce((sum, h) => sum + Number(h.jumlah), 0);
  const totalPengeluaran = stockMasukHariIni.reduce((sum, s) => sum + Number(s.totalPengeluaran), 0);

  let menuTerlaris: RingkasanHarian["menuTerlaris"] = null;
  if (transaksiHariIni.length > 0) {
    const details = await db
      .select({ menuId: detailTransaksi.menuId, qty: detailTransaksi.qty, menuNama: menu.nama })
      .from(detailTransaksi)
      .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
      .where(
        inArray(
          detailTransaksi.transaksiId,
          transaksiHariIni.map((t) => t.id)
        )
      );

    const qtyByMenu = new Map<string, { nama: string; qty: number }>();
    for (const d of details) {
      const cur = qtyByMenu.get(d.menuId) ?? { nama: d.menuNama, qty: 0 };
      cur.qty += d.qty;
      qtyByMenu.set(d.menuId, cur);
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

export async function getRingkasanKasir(now: Date = new Date()) {
  await requireRole("owner", "cashier");
  const { start, end } = getTodayRangeWIB(now);

  const [tunai, hutangLunas] = await Promise.all([
    db
      .select({ total: transaksi.totalPemasukan })
      .from(transaksi)
      .where(
        and(
          eq(transaksi.status, "aktif"),
          eq(transaksi.metodeBayar, "tunai"),
          gte(transaksi.tanggal, start),
          lt(transaksi.tanggal, end),
        ),
      ),
    db
      .select({ total: hutang.jumlah })
      .from(hutang)
      .where(
        and(
          eq(hutang.status, "lunas"),
          isNotNull(hutang.tanggalLunas),
          gte(hutang.tanggalLunas, start),
          lt(hutang.tanggalLunas, end),
        ),
      ),
  ]);

  return {
    totalPenjualan:
      tunai.reduce((sum, row) => sum + Number(row.total), 0) +
      hutangLunas.reduce((sum, row) => sum + Number(row.total), 0),
  };
}

export async function getStatusTutupKasir(now: Date = new Date()) {
  await requireRole("owner", "cashier");
  const tanggal = getTodayDateStringWIB(now);
  const [row] = await db
    .select({ tanggal: tutupKasir.tanggal })
    .from(tutupKasir)
    .where(eq(tutupKasir.tanggal, tanggal))
    .limit(1);
  return row ?? null;
}

/** Baris tutup_kasir untuk tanggal hari ini (WIB), null kalau belum ditutup. */
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

/** Tutup kasir hari ini — snapshot ringkasan harian ke tabel tutup_kasir. Tolak kalau sudah pernah ditutup. */
export async function createTutupKasir(now: Date = new Date()) {
  await requireRole("owner", "cashier");
  const tanggal = getTodayDateStringWIB(now);

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(tutupKasir).where(eq(tutupKasir.tanggal, tanggal)).limit(1);
      if (existing) throw new SudahTutupKasirError();

      const ringkasan = await calculateRingkasanHarian(now);

      const [row] = await tx
        .insert(tutupKasir)
        .values({
          tanggal,
          totalPenjualan: ringkasan.totalPenjualan.toFixed(2),
          totalPengeluaran: ringkasan.totalPengeluaran.toFixed(2),
          labaKotor: ringkasan.labaKotor.toFixed(2),
          menuTerlarisId: ringkasan.menuTerlaris?.menuId ?? null,
        })
        .returning();

      return row;
    });
  } catch (error) {
    if (isDuplicateCloseDate(error)) throw new SudahTutupKasirError();
    throw error;
  }
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

/** Riwayat tutup kasir, terbaru dulu. */
export async function listRiwayatTutupKasir(limit = 30) {
  await requireRole("owner");
  const rows = await db
    .select({ tutupKasir, menuTerlarisNama: menu.nama })
    .from(tutupKasir)
    .leftJoin(menu, eq(menu.id, tutupKasir.menuTerlarisId))
    .orderBy(desc(tutupKasir.tanggal))
    .limit(limit);

  return rows.map((r) => ({ ...r.tutupKasir, menuTerlarisNama: r.menuTerlarisNama }));
}
