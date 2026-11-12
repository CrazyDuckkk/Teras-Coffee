import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, menu, resepMenu, riwayatHargaBahan, stockMasuk, user } from "@/db/schema";
import type { BahanBakuCreateInput, BahanBakuUpdateInput, StockMasukCreateInput } from "@/lib/validations/inventaris";
import { requireRole } from "@/lib/auth-guard";
import {
  catatStockMasukTx,
  koreksiStockMasukTx,
  listStokBahanCore,
  putuskanHargaStockMasukTx,
} from "@/lib/inventaris-core";

export class BahanMasihDipakaiError extends Error {
  constructor(public menuNames: string[]) {
    super(`Bahan masih dipakai di resep menu aktif: ${menuNames.join(", ")}. Nonaktifkan/ubah resep menu tersebut dulu.`);
    this.name = "BahanMasihDipakaiError";
  }
}

export async function listBahanBaku(includeInactive = false) {
  await requireRole("owner");
  const hargaAktif = db
    .selectDistinctOn([riwayatHargaBahan.bahanBakuId], {
      bahanBakuId: riwayatHargaBahan.bahanBakuId,
      hargaPerSatuan: riwayatHargaBahan.hargaPerSatuan,
    })
    .from(riwayatHargaBahan)
    .where(isNull(riwayatHargaBahan.dibatalkanAt))
    .orderBy(riwayatHargaBahan.bahanBakuId, desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .as("harga_aktif");

  return db
    .select({
      id: bahanBaku.id,
      nama: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      stokSaatIni: bahanBaku.stokSaatIni,
      batasMinimumStok: bahanBaku.batasMinimumStok,
      isActive: bahanBaku.isActive,
      hargaAktif: hargaAktif.hargaPerSatuan,
    })
    .from(bahanBaku)
    .leftJoin(hargaAktif, eq(hargaAktif.bahanBakuId, bahanBaku.id))
    .where(includeInactive ? undefined : eq(bahanBaku.isActive, true))
    .orderBy(bahanBaku.nama);
}

export async function getBahanBakuById(id: string) {
  await requireRole("owner");
  const [row] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, id)).limit(1);
  return row ?? null;
}

export async function getHargaAktif(bahanBakuId: string) {
  await requireRole("owner");
  const [row] = await db
    .select()
    .from(riwayatHargaBahan)
    .where(and(eq(riwayatHargaBahan.bahanBakuId, bahanBakuId), isNull(riwayatHargaBahan.dibatalkanAt)))
    .orderBy(desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getRiwayatHarga(bahanBakuId: string) {
  await requireRole("owner");
  return db
    .select()
    .from(riwayatHargaBahan)
    .where(eq(riwayatHargaBahan.bahanBakuId, bahanBakuId))
    .orderBy(desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt));
}

export async function createBahanBaku(input: BahanBakuCreateInput) {
  await requireRole("owner");
  // Harga per satuan dihitung dari total harga beli awal dibagi qty (mis. beli 1000ml
  // seharga Rp40.000 -> Rp40/ml) — bukan diinput langsung per satuan oleh user.
  const hargaPerSatuan = input.totalHargaBeliAwal / input.stokAwal;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(bahanBaku)
      .values({
        nama: input.nama,
        satuan: input.satuan,
        stokSaatIni: String(input.stokAwal),
        batasMinimumStok: String(input.batasMinimumStok),
      })
      .returning();
    await tx.insert(riwayatHargaBahan).values({
      bahanBakuId: row.id,
      hargaPerSatuan: hargaPerSatuan.toFixed(2),
    });
    return row;
  });
}

export async function updateBahanBaku(id: string, input: BahanBakuUpdateInput) {
  await requireRole("owner");
  const [row] = await db
    .update(bahanBaku)
    .set({
      ...(input.nama !== undefined && { nama: input.nama }),
      ...(input.satuan !== undefined && { satuan: input.satuan }),
      ...(input.batasMinimumStok !== undefined && { batasMinimumStok: String(input.batasMinimumStok) }),
      updatedAt: new Date(),
    })
    .where(eq(bahanBaku.id, id))
    .returning();
  return row ?? null;
}

/** Menonaktifkan bahan baku — ditolak (BahanMasihDipakaiError) jika masih dipakai resep menu aktif. */
export async function deactivateBahanBaku(id: string) {
  await requireRole("owner");
  const menuAktifTerkait = await db
    .selectDistinct({ nama: menu.nama })
    .from(resepMenu)
    .innerJoin(menu, eq(menu.id, resepMenu.menuId))
    .where(and(eq(resepMenu.bahanBakuId, id), eq(menu.isActive, true)));

  if (menuAktifTerkait.length > 0) {
    throw new BahanMasihDipakaiError(menuAktifTerkait.map((m) => m.nama));
  }

  const [row] = await db
    .update(bahanBaku)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(bahanBaku.id, id))
    .returning();
  return row ?? null;
}

/** Mengaktifkan kembali bahan baku yang sebelumnya dinonaktifkan. */
export async function reactivateBahanBaku(id: string) {
  await requireRole("owner");
  const [row] = await db
    .update(bahanBaku)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(bahanBaku.id, id))
    .returning();
  return row ?? null;
}

/**
 * Stock Masuk — transactional: insert stock_masuk, tambah stok bahan_baku,
 * dan insert riwayat_harga_bahan baru HANYA jika harga per satuan hasil hitungan
 * beda dari harga aktif. Harga per satuan = totalHargaBeli / qty (bukan diinput
 * langsung) — mis. beli 1000ml susu seharga Rp40.000 -> Harga Aktif Rp40/ml.
 */
export async function createStockMasuk(input: StockMasukCreateInput, pelakuId: string) {
  const session = await requireRole("owner", "cashier");
  return db.transaction((tx) => catatStockMasukTx(tx, input, pelakuId, session.user.role));
}

export async function listStockMasuk(bahanBakuId?: string) {
  await requireRole("owner");
  return db
    .select({
      id: stockMasuk.id,
      tanggal: stockMasuk.tanggal,
      bahanBakuId: stockMasuk.bahanBakuId,
      bahanNama: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      qty: stockMasuk.qty,
      hargaBeli: stockMasuk.hargaBeli,
      totalPengeluaran: stockMasuk.totalPengeluaran,
      dibayarDari: stockMasuk.dibayarDari,
      statusHarga: stockMasuk.statusHarga,
      pelakuNama: user.name,
      dibatalkanAt: stockMasuk.dibatalkanAt,
      alasanBatal: stockMasuk.alasanBatal,
    })
    .from(stockMasuk)
    .innerJoin(bahanBaku, eq(bahanBaku.id, stockMasuk.bahanBakuId))
    .leftJoin(user, eq(user.id, stockMasuk.pelakuId))
    .where(bahanBakuId ? eq(stockMasuk.bahanBakuId, bahanBakuId) : undefined)
    .orderBy(desc(stockMasuk.tanggal))
    .limit(100);
}

export async function listStockMasukMenungguKonfirmasi() {
  await requireRole("owner");
  return db
    .select({
      id: stockMasuk.id,
      tanggal: stockMasuk.tanggal,
      bahanNama: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      qty: stockMasuk.qty,
      hargaBeli: stockMasuk.hargaBeli,
      totalPengeluaran: stockMasuk.totalPengeluaran,
      dibayarDari: stockMasuk.dibayarDari,
      pelakuNama: user.name,
    })
    .from(stockMasuk)
    .innerJoin(bahanBaku, eq(bahanBaku.id, stockMasuk.bahanBakuId))
    .leftJoin(user, eq(user.id, stockMasuk.pelakuId))
    .where(and(eq(stockMasuk.statusHarga, "menunggu"), isNull(stockMasuk.dibatalkanAt)))
    .orderBy(desc(stockMasuk.tanggal));
}

export async function putuskanHargaStockMasuk(
  id: string,
  keputusan: "setujui" | "tolak",
  pelakuId: string
) {
  await requireRole("owner");
  return db.transaction((tx) => putuskanHargaStockMasukTx(tx, id, keputusan, pelakuId));
}

export async function koreksiStockMasuk(id: string, alasan: string, pelakuId: string) {
  await requireRole("owner");
  return db.transaction((tx) => koreksiStockMasukTx(tx, id, alasan, pelakuId));
}

export async function listStokBahan() {
  await requireRole("owner", "cashier");
  return listStokBahanCore(db);
}
