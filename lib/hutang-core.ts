import { and, eq, isNull, sql } from "drizzle-orm";
import type { db } from "@/db";
import { hutang, hutangPembayaran, transaksi } from "@/db/schema";
import type { PembayaranHutangInput } from "@/lib/validations/hutang";

/**
 * Logika uang hutang (pembayaran sebagian, pelunasan, pembatalan, dampak void).
 * SENGAJA tanpa requireRole() supaya bisa diuji langsung ke database uji; pengecekan
 * peran dilakukan oleh pembungkus di lib/queries/hutang.ts dan lib/queries/transaksi.ts.
 * Semua fungsi *Tx harus dipanggil di dalam db.transaction.
 */

export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class HutangSudahLunasError extends Error {
  constructor() {
    super("Hutang ini sudah lunas.");
    this.name = "HutangSudahLunasError";
  }
}

export class HutangSudahAdaPembayaranError extends Error {
  constructor() {
    super("Hutang ini sudah ada pembayarannya, jadi tidak bisa diajukan void. Hubungi owner untuk penanganannya.");
    this.name = "HutangSudahAdaPembayaranError";
  }
}

export class HutangTidakAktifError extends Error {
  constructor() {
    super("Transaksi hutang ini sedang menunggu void atau sudah di-void, pembayaran tidak bisa dicatat.");
    this.name = "HutangTidakAktifError";
  }
}

export class PembayaranMelebihiSisaError extends Error {
  constructor(public sisa: number) {
    super(`Jumlah pembayaran melebihi sisa hutang (sisa Rp ${sisa.toLocaleString("id-ID")}).`);
    this.name = "PembayaranMelebihiSisaError";
  }
}

export class PembayaranSudahDibatalkanError extends Error {
  constructor() {
    super("Pembayaran ini sudah dibatalkan sebelumnya.");
    this.name = "PembayaranSudahDibatalkanError";
  }
}

/** Uang dihitung dalam sen (bilangan bulat) supaya perbandingan sisa tidak kena galat desimal. */
export function toSen(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function fromSen(sen: number): string {
  return (sen / 100).toFixed(2);
}

export function hitungSisa(jumlah: string | number, dibayar: string | number): string {
  return fromSen(toSen(jumlah) - toSen(dibayar));
}

async function jumlahDibayarSen(tx: DbOrTx, hutangId: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${hutangPembayaran.jumlah}), 0)` })
    .from(hutangPembayaran)
    .where(and(eq(hutangPembayaran.hutangId, hutangId), isNull(hutangPembayaran.dibatalkanAt)));
  return toSen(row?.total ?? 0);
}

/**
 * Kunci transaksi dulu, baru hutang. Urutan ini sama dengan ajukanVoidTransaksi dan
 * voidTransaksi, sehingga pembayaran dan void yang bersamaan tidak saling menunggu (deadlock).
 */
async function kunciHutang(tx: DbOrTx, hutangId: string) {
  const [awal] = await tx
    .select({ transaksiId: hutang.transaksiId })
    .from(hutang)
    .where(eq(hutang.id, hutangId))
    .limit(1);
  if (!awal) return null;

  const [trx] = await tx.select().from(transaksi).where(eq(transaksi.id, awal.transaksiId)).for("update");
  const [row] = await tx.select().from(hutang).where(eq(hutang.id, hutangId)).for("update");
  if (!trx || !row) return null;
  return { hutang: row, transaksi: trx };
}

/** Catat satu pembayaran (sebagian atau penuh). Hutang lunas otomatis saat sisa menjadi nol. */
export async function catatPembayaranTx(
  tx: DbOrTx,
  hutangId: string,
  input: PembayaranHutangInput,
  pelakuId: string | null,
  now: Date = new Date(),
) {
  const kunci = await kunciHutang(tx, hutangId);
  if (!kunci) return null;

  if (kunci.transaksi.status !== "aktif") throw new HutangTidakAktifError();
  if (kunci.hutang.status === "lunas") throw new HutangSudahLunasError();

  const sisaSen = toSen(kunci.hutang.jumlah) - (await jumlahDibayarSen(tx, hutangId));
  if (sisaSen <= 0) throw new HutangSudahLunasError();

  const jumlahSen = toSen(input.jumlah);
  if (jumlahSen > sisaSen) throw new PembayaranMelebihiSisaError(sisaSen / 100);

  const [pembayaran] = await tx
    .insert(hutangPembayaran)
    .values({
      hutangId,
      jumlah: fromSen(jumlahSen),
      metode: input.metode,
      dibayarAt: now,
      pelakuId,
    })
    .returning();

  const lunas = jumlahSen === sisaSen;
  let hutangRow = kunci.hutang;
  if (lunas) {
    // Tanggal lunas = tanggal pembayaran terakhir (laba diakui pada tanggal ini, lihat M10).
    [hutangRow] = await tx
      .update(hutang)
      .set({ status: "lunas", tanggalLunas: now })
      .where(eq(hutang.id, hutangId))
      .returning();
  }

  return { pembayaran, hutang: hutangRow, sisa: fromSen(sisaSen - jumlahSen), lunas };
}

/**
 * Batalkan satu pembayaran (hanya owner, dijaga oleh pembungkus). Baris tidak dihapus.
 * Jika hutang tadinya lunas, statusnya kembali belum lunas dan tanggal lunas dikosongkan.
 */
export async function batalkanPembayaranTx(
  tx: DbOrTx,
  hutangId: string,
  pembayaranId: string,
  alasan: string,
  pelakuId: string | null,
  now: Date = new Date(),
) {
  const kunci = await kunciHutang(tx, hutangId);
  if (!kunci) return null;

  const [pembayaran] = await tx
    .select()
    .from(hutangPembayaran)
    .where(and(eq(hutangPembayaran.id, pembayaranId), eq(hutangPembayaran.hutangId, hutangId)))
    .for("update");
  if (!pembayaran) return null;
  if (pembayaran.dibatalkanAt) throw new PembayaranSudahDibatalkanError();

  const [dibatalkan] = await tx
    .update(hutangPembayaran)
    .set({ dibatalkanAt: now, dibatalkanOleh: pelakuId, alasanBatal: alasan })
    .where(eq(hutangPembayaran.id, pembayaranId))
    .returning();

  let hutangRow = kunci.hutang;
  if (hutangRow.status === "lunas") {
    [hutangRow] = await tx
      .update(hutang)
      .set({ status: "belum_lunas", tanggalLunas: null })
      .where(eq(hutang.id, hutangId))
      .returning();
  }

  const sisa = hitungSisa(hutangRow.jumlah, fromSen(await jumlahDibayarSen(tx, hutangId)));
  return { pembayaran: dibatalkan, hutang: hutangRow, sisa };
}

/**
 * Aturan pengajuan void kasir: transaksi hutang yang sudah ada pembayaran aktifnya tidak
 * boleh diajukan lewat alur biasa; penanganannya oleh owner (void langsung).
 */
export async function pastikanHutangBisaDiajukanVoidTx(tx: DbOrTx, transaksiId: string) {
  const [row] = await tx.select().from(hutang).where(eq(hutang.transaksiId, transaksiId)).for("update");
  if (!row) return;
  if ((await jumlahDibayarSen(tx, row.id)) > 0) throw new HutangSudahAdaPembayaranError();
}

/**
 * Dampak void (oleh owner) pada hutang transaksi tersebut:
 * - tidak pernah ada pembayaran: baris hutang dihapus (perilaku lama);
 * - ada pembayaran: semua pembayaran aktif dibatalkan otomatis (jejak tetap ada) dan baris
 *   hutang dipertahankan sebagai arsip; daftar Hutang menyaring transaksi yang sudah void.
 */
export async function batalkanHutangSaatVoidTx(
  tx: DbOrTx,
  transaksiId: string,
  pelakuId: string | null,
  now: Date = new Date(),
) {
  const [row] = await tx.select().from(hutang).where(eq(hutang.transaksiId, transaksiId)).for("update");
  if (!row) return { pembayaranDibatalkan: 0 };

  const dibatalkan = await tx
    .update(hutangPembayaran)
    .set({ dibatalkanAt: now, dibatalkanOleh: pelakuId, alasanBatal: "Transaksi di-void oleh owner" })
    .where(and(eq(hutangPembayaran.hutangId, row.id), isNull(hutangPembayaran.dibatalkanAt)))
    .returning({ id: hutangPembayaran.id });

  const [pernahAdaPembayaran] = await tx
    .select({ id: hutangPembayaran.id })
    .from(hutangPembayaran)
    .where(eq(hutangPembayaran.hutangId, row.id))
    .limit(1);

  if (!pernahAdaPembayaran) {
    await tx.delete(hutang).where(eq(hutang.id, row.id));
  } else if (row.status === "lunas") {
    await tx.update(hutang).set({ status: "belum_lunas", tanggalLunas: null }).where(eq(hutang.id, row.id));
  }

  return { pembayaranDibatalkan: dibatalkan.length };
}
