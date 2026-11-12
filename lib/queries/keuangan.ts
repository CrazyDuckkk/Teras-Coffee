import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, hutang, hutangPembayaran, stockMasuk, transaksi } from "@/db/schema";
import { getRangeLastNDaysWIB, getTodayRangeWIB } from "@/lib/date";
import { requireRole } from "@/lib/auth-guard";

export type PeriodeKeuangan = "hari-ini" | "7-hari" | "30-hari" | "semua";

export interface KeuanganEntry {
  id: string;
  tanggal: Date;
  tipe: "pemasukan" | "pengeluaran";
  deskripsi: string;
  jumlah: number;
}

export function getPeriodeRange(periode: PeriodeKeuangan): { start?: Date; end?: Date } {
  switch (periode) {
    case "hari-ini":
      return getTodayRangeWIB();
    case "7-hari":
      return getRangeLastNDaysWIB(7);
    case "30-hari":
      return getRangeLastNDaysWIB(30);
    case "semua":
    default:
      return {};
  }
}

/**
 * Keuangan = gabungan (bukan tabel terpisah): transaksi tunai/QRIS yang belum di-void + setiap
 * PEMBAYARAN hutang yang belum dibatalkan sebagai pemasukan (pada tanggal pembayarannya, bukan
 * tanggal transaksi awal), stock_masuk sebagai pengeluaran. Transaksi void TIDAK dihitung.
 * Sisa hutang yang belum dibayar belum masuk cash-flow (lihat lib/hutang-core.ts).
 */
export async function getKeuangan(periode: PeriodeKeuangan = "30-hari") {
  await requireRole("owner");
  const { start, end } = getPeriodeRange(periode);

  const pemasukanLangsungFilters = [
    inArray(transaksi.status, ["aktif", "menunggu_void"]),
    inArray(transaksi.metodeBayar, ["tunai", "qris"]),
  ];
  if (start) pemasukanLangsungFilters.push(gte(transaksi.tanggal, start));
  if (end) pemasukanLangsungFilters.push(lt(transaksi.tanggal, end));

  const pembayaranHutangFilters = [isNull(hutangPembayaran.dibatalkanAt)];
  if (start) pembayaranHutangFilters.push(gte(hutangPembayaran.dibayarAt, start));
  if (end) pembayaranHutangFilters.push(lt(hutangPembayaran.dibayarAt, end));

  const pengeluaranFilters = [];
  if (start) pengeluaranFilters.push(gte(stockMasuk.tanggal, start));
  if (end) pengeluaranFilters.push(lt(stockMasuk.tanggal, end));

  const [pemasukanLangsungRows, pembayaranHutangRows, pengeluaranRows] = await Promise.all([
    db
      .select({ id: transaksi.id, tanggal: transaksi.tanggal, jumlah: transaksi.totalPemasukan })
      .from(transaksi)
      .where(and(...pemasukanLangsungFilters)),
    db
      .select({
        id: hutangPembayaran.id,
        tanggal: hutangPembayaran.dibayarAt,
        jumlah: hutangPembayaran.jumlah,
        namaPelanggan: hutang.namaPelanggan,
      })
      .from(hutangPembayaran)
      .innerJoin(hutang, eq(hutang.id, hutangPembayaran.hutangId))
      .where(and(...pembayaranHutangFilters)),
    db
      .select({
        id: stockMasuk.id,
        tanggal: stockMasuk.tanggal,
        jumlah: stockMasuk.totalPengeluaran,
        qty: stockMasuk.qty,
        bahanNama: bahanBaku.nama,
        satuan: bahanBaku.satuan,
      })
      .from(stockMasuk)
      .innerJoin(bahanBaku, eq(bahanBaku.id, stockMasuk.bahanBakuId))
      .where(pengeluaranFilters.length ? and(...pengeluaranFilters) : undefined),
  ]);

  const entries: KeuanganEntry[] = [
    ...pemasukanLangsungRows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      tipe: "pemasukan" as const,
      deskripsi: "Penjualan",
      jumlah: Number(r.jumlah),
    })),
    ...pembayaranHutangRows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      tipe: "pemasukan" as const,
      deskripsi: `Pembayaran Hutang${r.namaPelanggan ? ` — ${r.namaPelanggan}` : ""}`,
      jumlah: Number(r.jumlah),
    })),
    ...pengeluaranRows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      tipe: "pengeluaran" as const,
      deskripsi: `Stock Masuk — ${r.bahanNama} (${Number(r.qty)}${r.satuan})`,
      jumlah: Number(r.jumlah),
    })),
  ].sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime());

  const totalPemasukan =
    pemasukanLangsungRows.reduce((sum, r) => sum + Number(r.jumlah), 0) +
    pembayaranHutangRows.reduce((sum, r) => sum + Number(r.jumlah), 0);
  const totalPengeluaran = pengeluaranRows.reduce((sum, r) => sum + Number(r.jumlah), 0);

  return {
    entries,
    totalPemasukan,
    totalPengeluaran,
    saldo: totalPemasukan - totalPengeluaran,
  };
}
