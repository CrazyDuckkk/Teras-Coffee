import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { detailTransaksi, hutang, menu, stockMasuk, transaksi } from "@/db/schema";
import { getMonthRangeWIB, getTodayRangeWIB, getWeekRangeWIB } from "@/lib/date";
import { requireRole } from "@/lib/auth-guard";

export type PeriodeLaporan = "harian" | "mingguan" | "bulanan";

export interface MenuRanking {
  menuId: string;
  nama: string;
  kategori: string;
  qtyTerjual: number;
  totalOmzet: number;
  totalHpp: number;
  totalUntung: number;
  marginPerUnit: number;
  marginPercent: number;
}

function getPeriodeRange(periode: PeriodeLaporan): { start: Date; end: Date } {
  switch (periode) {
    case "harian":
      return getTodayRangeWIB();
    case "mingguan":
      return getWeekRangeWIB();
    case "bulanan":
      return getMonthRangeWIB();
  }
}

/**
 * Laporan dihitung live dari transaksi + stock_masuk (bukan tabel tersendiri, selaras
 * dengan pendekatan Keuangan). Pengajuan void tetap dihitung sampai disetujui.
 * - labaRugi = totalPemasukan - totalPengeluaran (periode) — angka CASH-FLOW: transaksi
 *   tunai/QRIS + hutang yang dilunasi dalam periode ini (berdasar tanggal_lunas), hutang yang
 *   belum lunas belum dihitung. Selaras dengan modul Keuangan & Tutup Kasir.
 * - menuTerlaris/menuMargin = ranking berdasarkan SEMUA penjualan yang belum di-void periode ini
 *   (termasuk hutang yang belum lunas — barang sudah keluar, terlepas dari status bayar).
 *   menuMargin dipakai untuk "Menu Paling Untung/Boncos" — margin per unit dipilih (bukan
 *   total profit) supaya item boncos tetap terlihat walau volume penjualannya kecil.
 */
export async function getLaporan(periode: PeriodeLaporan = "harian") {
  await requireRole("owner");
  const { start, end } = getPeriodeRange(periode);

  const [transaksiRange, transaksiTunaiRange, hutangLunasRange, pengeluaranRange] = await Promise.all([
    db
      .select({ id: transaksi.id, totalPemasukan: transaksi.totalPemasukan })
      .from(transaksi)
      .where(
        and(
          inArray(transaksi.status, ["aktif", "menunggu_void"]),
          gte(transaksi.tanggal, start),
          lt(transaksi.tanggal, end)
        )
      ),
    db
      .select({ totalPemasukan: transaksi.totalPemasukan })
      .from(transaksi)
      .where(
        and(
          inArray(transaksi.status, ["aktif", "menunggu_void"]),
          inArray(transaksi.metodeBayar, ["tunai", "qris"]),
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

  const totalPemasukan =
    transaksiTunaiRange.reduce((sum, t) => sum + Number(t.totalPemasukan), 0) +
    hutangLunasRange.reduce((sum, h) => sum + Number(h.jumlah), 0);
  const totalPengeluaran = pengeluaranRange.reduce((sum, r) => sum + Number(r.totalPengeluaran), 0);

  let ranking: MenuRanking[] = [];
  if (transaksiRange.length > 0) {
    const details = await db
      .select({
        menuId: detailTransaksi.menuId,
        qty: detailTransaksi.qty,
        hargaJualSaatItu: detailTransaksi.hargaJualSaatItu,
        hppSaatItu: detailTransaksi.hppSaatItu,
        menuNama: menu.nama,
        menuKategori: menu.kategori,
      })
      .from(detailTransaksi)
      .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
      .where(
        inArray(
          detailTransaksi.transaksiId,
          transaksiRange.map((t) => t.id)
        )
      );

    const map = new Map<string, { nama: string; kategori: string; qty: number; omzet: number; hpp: number }>();
    for (const d of details) {
      const cur = map.get(d.menuId) ?? { nama: d.menuNama, kategori: d.menuKategori, qty: 0, omzet: 0, hpp: 0 };
      cur.qty += d.qty;
      cur.omzet += Number(d.hargaJualSaatItu) * d.qty;
      cur.hpp += Number(d.hppSaatItu) * d.qty;
      map.set(d.menuId, cur);
    }

    ranking = [...map.entries()].map(([menuId, v]) => {
      const untung = v.omzet - v.hpp;
      return {
        menuId,
        nama: v.nama,
        kategori: v.kategori,
        qtyTerjual: v.qty,
        totalOmzet: v.omzet,
        totalHpp: v.hpp,
        totalUntung: untung,
        marginPerUnit: v.qty > 0 ? untung / v.qty : 0,
        marginPercent: v.omzet > 0 ? (untung / v.omzet) * 100 : 0,
      };
    });
  }

  const menuTerlaris = [...ranking].sort((a, b) => b.qtyTerjual - a.qtyTerjual);
  const menuMargin = [...ranking].sort((a, b) => b.marginPerUnit - a.marginPerUnit);
  const kategoriList = [...new Set(ranking.map((r) => r.kategori))].sort();

  return {
    periode,
    totalPemasukan,
    totalPengeluaran,
    labaRugi: totalPemasukan - totalPengeluaran,
    menuTerlaris,
    menuMargin,
    kategoriList,
  };
}
