import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { db } from "@/db";
import { bahanBaku, riwayatHargaBahan, stockMasuk } from "@/db/schema";
import type { StockMasukCreateInput } from "@/lib/validations/inventaris";
import type { UserRole } from "@/lib/roles";

export type InventarisDbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class BahanStockMasukTidakDitemukanError extends Error {
  constructor() {
    super("Bahan baku tidak ditemukan atau sudah tidak aktif.");
    this.name = "BahanStockMasukTidakDitemukanError";
  }
}

export class StockMasukSudahDiprosesError extends Error {
  constructor() {
    super("Pengajuan harga Stock Masuk ini sudah diproses.");
    this.name = "StockMasukSudahDiprosesError";
  }
}

export class StockMasukSudahDibatalkanError extends Error {
  constructor() {
    super("Stock Masuk ini sudah dikoreksi sebelumnya.");
    this.name = "StockMasukSudahDibatalkanError";
  }
}

export class HargaStockMasukTidakValidError extends Error {
  constructor() {
    super("Harga per satuan terlalu kecil atau tidak valid.");
    this.name = "HargaStockMasukTidakValidError";
  }
}

export class StockMasukLegacyTidakDapatDikoreksiError extends Error {
  constructor() {
    super("Stock Masuk lama tidak dapat dikoreksi karena sumber pembayarannya belum tercatat.");
    this.name = "StockMasukLegacyTidakDapatDikoreksiError";
  }
}

export class StokTidakCukupUntukKoreksiError extends Error {
  constructor(public tersedia: number, public dikoreksi: number) {
    super(
      `Stok tidak cukup untuk mengoreksi Stock Masuk ini (tersedia ${tersedia}, perlu dikurangi ${dikoreksi}).`
    );
    this.name = "StokTidakCukupUntukKoreksiError";
  }
}

function keDuaDesimal(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getHargaAktifTx(tx: InventarisDbOrTx, bahanBakuId: string) {
  const [row] = await tx
    .select({ hargaPerSatuan: riwayatHargaBahan.hargaPerSatuan })
    .from(riwayatHargaBahan)
    .where(and(eq(riwayatHargaBahan.bahanBakuId, bahanBakuId), isNull(riwayatHargaBahan.dibatalkanAt)))
    .orderBy(desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .limit(1);
  return row?.hargaPerSatuan ?? null;
}

async function catatRiwayatHarga(
  tx: InventarisDbOrTx,
  stockMasukId: string,
  bahanBakuId: string,
  hargaPerSatuan: string,
  now: Date
) {
  await tx.insert(riwayatHargaBahan).values({
    stockMasukId,
    bahanBakuId,
    hargaPerSatuan,
    berlakuSejak: now,
  });
}

export async function listStokBahanCore(tx: InventarisDbOrTx) {
  return tx
    .select({
      id: bahanBaku.id,
      nama: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      stokSaatIni: bahanBaku.stokSaatIni,
      batasMinimumStok: bahanBaku.batasMinimumStok,
    })
    .from(bahanBaku)
    .where(eq(bahanBaku.isActive, true))
    .orderBy(bahanBaku.nama);
}

export async function catatStockMasukTx(
  tx: InventarisDbOrTx,
  input: StockMasukCreateInput,
  pelakuId: string,
  role: UserRole,
  now: Date = new Date()
) {
  const [bahan] = await tx
    .select()
    .from(bahanBaku)
    .where(eq(bahanBaku.id, input.bahanBakuId))
    .for("update");
  if (!bahan || !bahan.isActive) throw new BahanStockMasukTidakDitemukanError();

  const hargaPerSatuan = keDuaDesimal(input.totalHargaBeli / input.qty);
  if (!Number.isFinite(hargaPerSatuan) || hargaPerSatuan <= 0) {
    throw new HargaStockMasukTidakValidError();
  }

  const hargaAktif = await getHargaAktifTx(tx, input.bahanBakuId);
  const hargaBerubah = hargaAktif === null || keDuaDesimal(Number(hargaAktif)) !== hargaPerSatuan;
  const menungguKonfirmasi = role === "cashier" && hargaBerubah;
  const [entry] = await tx
    .insert(stockMasuk)
    .values({
      bahanBakuId: input.bahanBakuId,
      qty: input.qty.toFixed(2),
      hargaBeli: hargaPerSatuan.toFixed(2),
      totalPengeluaran: input.totalHargaBeli.toFixed(2),
      dibayarDari: input.dibayarDari,
      statusHarga: menungguKonfirmasi ? "menunggu" : "disetujui",
      pelakuId,
      ...(role === "owner" && {
        konfirmasiHargaAt: now,
        konfirmasiHargaOleh: pelakuId,
      }),
    })
    .returning();

  await tx
    .update(bahanBaku)
    .set({
      stokSaatIni: sql`${bahanBaku.stokSaatIni} + ${input.qty.toFixed(2)}`,
      updatedAt: now,
    })
    .where(eq(bahanBaku.id, input.bahanBakuId));

  if (!menungguKonfirmasi && hargaBerubah) {
    await catatRiwayatHarga(tx, entry.id, input.bahanBakuId, hargaPerSatuan.toFixed(2), now);
  }

  return entry;
}

export async function putuskanHargaStockMasukTx(
  tx: InventarisDbOrTx,
  id: string,
  keputusan: "setujui" | "tolak",
  pelakuId: string,
  now: Date = new Date()
) {
  const [entry] = await tx.select().from(stockMasuk).where(eq(stockMasuk.id, id)).for("update");
  if (!entry) return null;
  if (entry.dibatalkanAt) throw new StockMasukSudahDibatalkanError();
  if (entry.statusHarga !== "menunggu") throw new StockMasukSudahDiprosesError();

  const [bahan] = await tx.select().from(bahanBaku).where(eq(bahanBaku.id, entry.bahanBakuId)).for("update");
  if (!bahan) throw new BahanStockMasukTidakDitemukanError();

  if (keputusan === "setujui") {
    const hargaAktif = await getHargaAktifTx(tx, entry.bahanBakuId);
    if (hargaAktif === null || keDuaDesimal(Number(hargaAktif)) !== keDuaDesimal(Number(entry.hargaBeli))) {
      await catatRiwayatHarga(tx, entry.id, entry.bahanBakuId, entry.hargaBeli, now);
    }
  }

  const [updated] = await tx
    .update(stockMasuk)
    .set({
      statusHarga: keputusan === "setujui" ? "disetujui" : "ditolak",
      konfirmasiHargaAt: now,
      konfirmasiHargaOleh: pelakuId,
    })
    .where(eq(stockMasuk.id, id))
    .returning();
  return updated;
}

export async function koreksiStockMasukTx(
  tx: InventarisDbOrTx,
  id: string,
  alasan: string,
  pelakuId: string,
  now: Date = new Date()
) {
  const [entry] = await tx.select().from(stockMasuk).where(eq(stockMasuk.id, id)).for("update");
  if (!entry) return null;
  if (entry.dibatalkanAt) throw new StockMasukSudahDibatalkanError();
  if (!entry.dibayarDari) {
    throw new StockMasukLegacyTidakDapatDikoreksiError();
  }

  const [bahan] = await tx
    .select()
    .from(bahanBaku)
    .where(eq(bahanBaku.id, entry.bahanBakuId))
    .for("update");
  if (!bahan) throw new BahanStockMasukTidakDitemukanError();

  const stokTersedia = keDuaDesimal(Number(bahan.stokSaatIni));
  const stokDikoreksi = keDuaDesimal(Number(entry.qty));
  if (stokTersedia < stokDikoreksi) {
    throw new StokTidakCukupUntukKoreksiError(stokTersedia, stokDikoreksi);
  }

  const [updated] = await tx
    .update(stockMasuk)
    .set({ dibatalkanAt: now, dibatalkanOleh: pelakuId, alasanBatal: alasan })
    .where(eq(stockMasuk.id, id))
    .returning();

  await tx
    .update(bahanBaku)
    .set({ stokSaatIni: (stokTersedia - stokDikoreksi).toFixed(2), updatedAt: now })
    .where(eq(bahanBaku.id, entry.bahanBakuId));

  await tx
    .update(riwayatHargaBahan)
    .set({ dibatalkanAt: now })
    .where(and(eq(riwayatHargaBahan.stockMasukId, id), isNull(riwayatHargaBahan.dibatalkanAt)));

  return updated;
}
