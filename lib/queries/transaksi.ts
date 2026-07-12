import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, detailTransaksi, hutang, menu, resepMenu, riwayatHargaBahan, transaksi } from "@/db/schema";
import { getTodayRangeWIB } from "@/lib/date";
import { HutangSudahLunasError } from "@/lib/queries/hutang";
import type { TransaksiCreateInput } from "@/lib/validations/transaksi";

export class StokTidakCukupError extends Error {
  constructor(public shortages: { nama: string; butuh: number; tersedia: number; satuan: string }[]) {
    super(
      `Stok tidak cukup untuk: ${shortages
        .map((s) => `${s.nama} (butuh ${s.butuh}${s.satuan}, tersedia ${s.tersedia}${s.satuan})`)
        .join(", ")}`
    );
    this.name = "StokTidakCukupError";
  }
}

export class MenuTidakAktifError extends Error {
  constructor() {
    super("Salah satu menu di keranjang sudah tidak tersedia. Muat ulang halaman dan coba lagi.");
    this.name = "MenuTidakAktifError";
  }
}

export class TransaksiSudahVoidError extends Error {
  constructor() {
    super("Transaksi ini sudah di-void sebelumnya.");
    this.name = "TransaksiSudahVoidError";
  }
}

/** Data untuk halaman kasir: menu aktif + resep per menu (dipakai validasi stok di client) + stok bahan saat ini. */
export async function getKasirData() {
  const [menus, resep, bahan] = await Promise.all([
    db.select().from(menu).where(eq(menu.isActive, true)).orderBy(menu.kategori, menu.nama),
    db
      .select({ menuId: resepMenu.menuId, bahanBakuId: resepMenu.bahanBakuId, takaran: resepMenu.takaran })
      .from(resepMenu)
      .innerJoin(menu, eq(menu.id, resepMenu.menuId))
      .where(eq(menu.isActive, true)),
    db.select().from(bahanBaku).where(eq(bahanBaku.isActive, true)),
  ]);

  return { menus, resep, bahan };
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function hargaAktifSubquery(tx: DbOrTx) {
  return tx
    .selectDistinctOn([riwayatHargaBahan.bahanBakuId], {
      bahanBakuId: riwayatHargaBahan.bahanBakuId,
      hargaPerSatuan: riwayatHargaBahan.hargaPerSatuan,
    })
    .from(riwayatHargaBahan)
    .orderBy(riwayatHargaBahan.bahanBakuId, desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .as("harga_aktif");
}

/**
 * Simpan transaksi penjualan — transactional:
 * cek ketersediaan stok agregat per bahan (lintas item cart) -> decrement stok
 * -> snapshot harga_jual & hpp saat itu -> insert transaksi + detail_transaksi.
 * Gagal total (rollback) kalau ada bahan kurang.
 */
export async function createTransaksi(input: TransaksiCreateInput) {
  return db.transaction(async (tx) => {
    const menuIds = [...new Set(input.items.map((i) => i.menuId))];

    const menuRows = await tx.select().from(menu).where(inArray(menu.id, menuIds));
    const menuMap = new Map(menuRows.map((m) => [m.id, m]));
    for (const id of menuIds) {
      const m = menuMap.get(id);
      if (!m || !m.isActive) throw new MenuTidakAktifError();
    }

    const resepRows = await tx
      .select()
      .from(resepMenu)
      .where(inArray(resepMenu.menuId, menuIds));

    const requiredByBahan = new Map<string, number>();
    for (const item of input.items) {
      for (const r of resepRows.filter((row) => row.menuId === item.menuId)) {
        const need = Number(r.takaran) * item.qty;
        requiredByBahan.set(r.bahanBakuId, (requiredByBahan.get(r.bahanBakuId) ?? 0) + need);
      }
    }

    const bahanIds = [...requiredByBahan.keys()];
    const bahanRows = bahanIds.length
      ? await tx.select().from(bahanBaku).where(inArray(bahanBaku.id, bahanIds)).for("update")
      : [];
    const bahanMap = new Map(bahanRows.map((b) => [b.id, b]));

    const shortages: { nama: string; butuh: number; tersedia: number; satuan: string }[] = [];
    for (const [bahanBakuId, need] of requiredByBahan) {
      const b = bahanMap.get(bahanBakuId);
      const tersedia = b ? Number(b.stokSaatIni) : 0;
      if (tersedia < need) {
        shortages.push({ nama: b?.nama ?? "?", butuh: need, tersedia, satuan: b?.satuan ?? "" });
      }
    }
    if (shortages.length > 0) {
      throw new StokTidakCukupError(shortages);
    }

    for (const [bahanBakuId, need] of requiredByBahan) {
      await tx
        .update(bahanBaku)
        .set({ stokSaatIni: sql`${bahanBaku.stokSaatIni} - ${need}`, updatedAt: new Date() })
        .where(eq(bahanBaku.id, bahanBakuId));
    }

    const hargaAktif = hargaAktifSubquery(tx);
    const resepWithHarga = await tx
      .select({
        menuId: resepMenu.menuId,
        takaran: resepMenu.takaran,
        hargaPerSatuan: hargaAktif.hargaPerSatuan,
      })
      .from(resepMenu)
      .leftJoin(hargaAktif, eq(hargaAktif.bahanBakuId, resepMenu.bahanBakuId))
      .where(inArray(resepMenu.menuId, menuIds));

    const hppByMenu = new Map<string, number>();
    for (const r of resepWithHarga) {
      const cost = Number(r.takaran) * Number(r.hargaPerSatuan ?? 0);
      hppByMenu.set(r.menuId, (hppByMenu.get(r.menuId) ?? 0) + cost);
    }

    let totalPemasukan = 0;
    const detailValues = input.items.map((item) => {
      const m = menuMap.get(item.menuId)!;
      const hargaJualSaatItu = Number(m.hargaJual);
      const hppSaatItu = hppByMenu.get(item.menuId) ?? 0;
      totalPemasukan += hargaJualSaatItu * item.qty;
      return {
        menuId: item.menuId,
        qty: item.qty,
        hargaJualSaatItu: hargaJualSaatItu.toFixed(2),
        hppSaatItu: hppSaatItu.toFixed(2),
      };
    });

    const [row] = await tx
      .insert(transaksi)
      .values({ totalPemasukan: totalPemasukan.toFixed(2), metodeBayar: input.metodeBayar })
      .returning();

    await tx.insert(detailTransaksi).values(detailValues.map((d) => ({ ...d, transaksiId: row.id })));

    // Hutang belum masuk Keuangan sampai ditandai lunas (lihat lib/queries/hutang.ts) — stok
    // sudah dipotong di atas seperti biasa, barang sudah keluar terlepas dari metode bayar.
    if (input.metodeBayar === "hutang") {
      await tx.insert(hutang).values({
        transaksiId: row.id,
        namaPelanggan: input.namaPelanggan,
        jumlah: totalPemasukan.toFixed(2),
      });
    }

    return row;
  });
}

/**
 * Void transaksi — lock row, tolak jika sudah void, kembalikan stok bahan sesuai resep saat
 * transaksi dibuat. Kalau transaksi ini berasal dari Hutang: hutang yang belum lunas ikut
 * dihapus (piutang batal karena transaksinya batal); hutang yang sudah lunas menolak void
 * (uangnya sudah tercatat masuk di Keuangan — tidak bisa dibatalkan lewat void begitu saja).
 */
export async function voidTransaksi(id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(transaksi).where(eq(transaksi.id, id)).for("update");
    if (!row) return null;
    if (row.status !== "aktif") throw new TransaksiSudahVoidError();

    if (row.metodeBayar === "hutang") {
      const [hutangRow] = await tx.select().from(hutang).where(eq(hutang.transaksiId, id)).for("update");
      if (hutangRow?.status === "lunas") throw new HutangSudahLunasError();
      if (hutangRow) await tx.delete(hutang).where(eq(hutang.id, hutangRow.id));
    }

    const details = await tx.select().from(detailTransaksi).where(eq(detailTransaksi.transaksiId, id));
    const menuIds = [...new Set(details.map((d) => d.menuId))];
    const resepRows = menuIds.length ? await tx.select().from(resepMenu).where(inArray(resepMenu.menuId, menuIds)) : [];

    const restoreByBahan = new Map<string, number>();
    for (const d of details) {
      for (const r of resepRows.filter((row2) => row2.menuId === d.menuId)) {
        const amount = Number(r.takaran) * d.qty;
        restoreByBahan.set(r.bahanBakuId, (restoreByBahan.get(r.bahanBakuId) ?? 0) + amount);
      }
    }

    for (const [bahanBakuId, amount] of restoreByBahan) {
      await tx
        .update(bahanBaku)
        .set({ stokSaatIni: sql`${bahanBaku.stokSaatIni} + ${amount}`, updatedAt: new Date() })
        .where(eq(bahanBaku.id, bahanBakuId));
    }

    const [updated] = await tx
      .update(transaksi)
      .set({ status: "void", voidedAt: new Date() })
      .where(eq(transaksi.id, id))
      .returning();

    return updated;
  });
}

/** Riwayat transaksi hari ini (WIB) — dipakai halaman Transaksi untuk daftar + aksi void. */
export async function listTransaksiHariIni() {
  const { start, end } = getTodayRangeWIB();
  const rows = await db
    .select()
    .from(transaksi)
    .where(and(gte(transaksi.tanggal, start), lt(transaksi.tanggal, end)))
    .orderBy(desc(transaksi.tanggal));

  if (rows.length === 0) return [];

  const details = await db
    .select({
      transaksiId: detailTransaksi.transaksiId,
      menuId: detailTransaksi.menuId,
      qty: detailTransaksi.qty,
      hargaJualSaatItu: detailTransaksi.hargaJualSaatItu,
      menuNama: menu.nama,
    })
    .from(detailTransaksi)
    .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
    .where(
      inArray(
        detailTransaksi.transaksiId,
        rows.map((r) => r.id)
      )
    );

  return rows.map((r) => ({
    ...r,
    items: details.filter((d) => d.transaksiId === r.id),
  }));
}
