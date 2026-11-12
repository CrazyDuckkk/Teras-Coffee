import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, detailTransaksi, menu, transaksi } from "@/db/schema";
import { getTodayRangeWIB } from "@/lib/date";
import { requireRole } from "@/lib/auth-guard";

/**
 * "Laba kotor" di sini = margin penjualan hari ini: SUM((harga_jual_saat_itu - hpp_saat_itu) x qty)
 * dari transaksi yang belum di-void hari ini. Ini BEDA dari "Saldo" di Keuangan (pemasukan - pengeluaran, cash flow
 * yang ikut memotong pembelian stok) — jangan disamakan.
 */
export async function getDashboardSummary() {
  await requireRole("owner");
  const { start, end } = getTodayRangeWIB();

  const transaksiHariIni = await db
    .select()
    .from(transaksi)
    .where(
      and(
        inArray(transaksi.status, ["aktif", "menunggu_void"]),
        gte(transaksi.tanggal, start),
        lt(transaksi.tanggal, end)
      )
    );

  const omzetHariIni = transaksiHariIni.reduce((sum, t) => sum + Number(t.totalPemasukan), 0);

  let labaKotorHariIni = 0;
  let menuTerlaris: { menuId: string; nama: string; qty: number }[] = [];

  if (transaksiHariIni.length > 0) {
    const details = await db
      .select({
        menuId: detailTransaksi.menuId,
        qty: detailTransaksi.qty,
        hargaJualSaatItu: detailTransaksi.hargaJualSaatItu,
        hppSaatItu: detailTransaksi.hppSaatItu,
        menuNama: menu.nama,
      })
      .from(detailTransaksi)
      .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
      .where(
        inArray(
          detailTransaksi.transaksiId,
          transaksiHariIni.map((t) => t.id)
        )
      );

    labaKotorHariIni = details.reduce(
      (sum, d) => sum + (Number(d.hargaJualSaatItu) - Number(d.hppSaatItu)) * d.qty,
      0
    );

    const qtyByMenu = new Map<string, { nama: string; qty: number }>();
    for (const d of details) {
      const cur = qtyByMenu.get(d.menuId) ?? { nama: d.menuNama, qty: 0 };
      cur.qty += d.qty;
      qtyByMenu.set(d.menuId, cur);
    }
    const sorted = [...qtyByMenu.entries()].sort((a, b) => b[1].qty - a[1].qty);
    menuTerlaris = sorted.slice(0, 3).map(([menuId, v]) => ({ menuId, nama: v.nama, qty: v.qty }));
  }

  const bahanAktif = await db.select().from(bahanBaku).where(eq(bahanBaku.isActive, true));
  const stokMenipis = bahanAktif
    .filter((b) => Number(b.stokSaatIni) <= Number(b.batasMinimumStok))
    .sort((a, b) => Number(a.stokSaatIni) - Number(b.stokSaatIni));

  return { omzetHariIni, labaKotorHariIni, stokMenipis, menuTerlaris };
}
