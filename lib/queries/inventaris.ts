import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, menu, resepMenu, riwayatHargaBahan, stockMasuk } from "@/db/schema";
import type { BahanBakuCreateInput, BahanBakuUpdateInput, StockMasukCreateInput } from "@/lib/validations/inventaris";

export class BahanMasihDipakaiError extends Error {
  constructor(public menuNames: string[]) {
    super(`Bahan masih dipakai di resep menu aktif: ${menuNames.join(", ")}. Nonaktifkan/ubah resep menu tersebut dulu.`);
    this.name = "BahanMasihDipakaiError";
  }
}

export async function listBahanBaku(includeInactive = false) {
  const hargaAktif = db
    .selectDistinctOn([riwayatHargaBahan.bahanBakuId], {
      bahanBakuId: riwayatHargaBahan.bahanBakuId,
      hargaPerSatuan: riwayatHargaBahan.hargaPerSatuan,
    })
    .from(riwayatHargaBahan)
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
  const [row] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, id)).limit(1);
  return row ?? null;
}

export async function getHargaAktif(bahanBakuId: string) {
  const [row] = await db
    .select()
    .from(riwayatHargaBahan)
    .where(eq(riwayatHargaBahan.bahanBakuId, bahanBakuId))
    .orderBy(desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getRiwayatHarga(bahanBakuId: string) {
  return db
    .select()
    .from(riwayatHargaBahan)
    .where(eq(riwayatHargaBahan.bahanBakuId, bahanBakuId))
    .orderBy(desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt));
}

export async function createBahanBaku(input: BahanBakuCreateInput) {
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
export async function createStockMasuk(input: StockMasukCreateInput) {
  const hargaPerSatuanBaru = input.totalHargaBeli / input.qty;

  return db.transaction(async (tx) => {
    const bahan = await tx.select().from(bahanBaku).where(eq(bahanBaku.id, input.bahanBakuId)).limit(1);
    if (bahan.length === 0) {
      throw new Error("Bahan baku tidak ditemukan");
    }

    const [hargaAktifRow] = await tx
      .select()
      .from(riwayatHargaBahan)
      .where(eq(riwayatHargaBahan.bahanBakuId, input.bahanBakuId))
      .orderBy(desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
      .limit(1);

    const hargaPerSatuanStr = hargaPerSatuanBaru.toFixed(2);
    if (!hargaAktifRow || Number(hargaAktifRow.hargaPerSatuan) !== hargaPerSatuanBaru) {
      await tx.insert(riwayatHargaBahan).values({
        bahanBakuId: input.bahanBakuId,
        hargaPerSatuan: hargaPerSatuanStr,
      });
    }

    const [row] = await tx
      .insert(stockMasuk)
      .values({
        bahanBakuId: input.bahanBakuId,
        qty: String(input.qty),
        hargaBeli: hargaPerSatuanStr,
        // Total pengeluaran = persis nilai yang dibayar user, bukan qty x harga per satuan
        // yang sudah dibulatkan (hindari drift pembulatan dari pembagian).
        totalPengeluaran: input.totalHargaBeli.toFixed(2),
      })
      .returning();

    await tx
      .update(bahanBaku)
      .set({
        stokSaatIni: (Number(bahan[0].stokSaatIni) + input.qty).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(bahanBaku.id, input.bahanBakuId));

    return row;
  });
}

export async function listStockMasuk(bahanBakuId?: string) {
  return db
    .select()
    .from(stockMasuk)
    .where(bahanBakuId ? eq(stockMasuk.bahanBakuId, bahanBakuId) : undefined)
    .orderBy(desc(stockMasuk.tanggal));
}
