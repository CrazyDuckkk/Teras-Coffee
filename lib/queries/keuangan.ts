import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, stockMasuk, transaksi } from "@/db/schema";
import { getRangeLastNDaysWIB, getTodayRangeWIB } from "@/lib/date";

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
 * Keuangan = gabungan (bukan tabel terpisah): transaksi aktif sebagai pemasukan,
 * stock_masuk sebagai pengeluaran. Transaksi void TIDAK dihitung.
 */
export async function getKeuangan(periode: PeriodeKeuangan = "30-hari") {
  const { start, end } = getPeriodeRange(periode);

  const pemasukanFilters = [eq(transaksi.status, "aktif")];
  if (start) pemasukanFilters.push(gte(transaksi.tanggal, start));
  if (end) pemasukanFilters.push(lt(transaksi.tanggal, end));

  const pengeluaranFilters = [];
  if (start) pengeluaranFilters.push(gte(stockMasuk.tanggal, start));
  if (end) pengeluaranFilters.push(lt(stockMasuk.tanggal, end));

  const [pemasukanRows, pengeluaranRows] = await Promise.all([
    db
      .select({ id: transaksi.id, tanggal: transaksi.tanggal, jumlah: transaksi.totalPemasukan })
      .from(transaksi)
      .where(and(...pemasukanFilters)),
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
    ...pemasukanRows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      tipe: "pemasukan" as const,
      deskripsi: "Penjualan",
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

  const totalPemasukan = pemasukanRows.reduce((sum, r) => sum + Number(r.jumlah), 0);
  const totalPengeluaran = pengeluaranRows.reduce((sum, r) => sum + Number(r.jumlah), 0);

  return {
    entries,
    totalPemasukan,
    totalPengeluaran,
    saldo: totalPemasukan - totalPengeluaran,
  };
}
