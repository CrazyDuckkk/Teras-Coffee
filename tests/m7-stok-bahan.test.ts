import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, riwayatHargaBahan, stockMasuk, user } from "@/db/schema";
import {
  catatStockMasukTx,
  getHargaAktifTx,
  koreksiStockMasukTx,
  listStokBahanCore,
  putuskanHargaStockMasukTx,
  StockMasukLegacyTidakDapatDikoreksiError,
  StokTidakCukupUntukKoreksiError,
} from "@/lib/inventaris-core";
import { koreksiStockMasukSchema, stockMasukCreateSchema } from "@/lib/validations/inventaris";
import { kosongkanDatabase } from "./helpers/db";

const OWNER = "owner-m7";
const CASHIER = "cashier-m7";
let bahanId: string;
let urutanWaktu = 0;

function waktuBerikutnya() {
  urutanWaktu += 1;
  return new Date(Date.now() + urutanWaktu * 1_000);
}

async function siapkanBahan() {
  await db.insert(user).values([
    { id: OWNER, name: "Owner Uji", email: "owner-m7@uji.test", role: "owner" },
    { id: CASHIER, name: "Kasir Uji", email: "kasir-m7@uji.test", role: "cashier" },
  ]);
  const [bahan] = await db
    .insert(bahanBaku)
    .values({
      nama: "Kopi M7",
      satuan: "gram",
      stokSaatIni: "100.00",
      batasMinimumStok: "10.00",
    })
    .returning();
  bahanId = bahan.id;
  await db.insert(riwayatHargaBahan).values({
    bahanBakuId: bahanId,
    hargaPerSatuan: "2.00",
  });
  return bahan;
}

function catat(
  pelakuId: string,
  role: "owner" | "cashier",
  qty: number,
  totalHargaBeli: number,
  dibayarDari: "kas_laci" | "di_luar_laci" = "kas_laci"
) {
  return db.transaction((tx) =>
    catatStockMasukTx(
      tx,
      { bahanBakuId: bahanId, qty, totalHargaBeli, dibayarDari },
      pelakuId,
      role,
      waktuBerikutnya()
    )
  );
}

describe("M7 Stok Bahan dan Stock Masuk", () => {
  beforeEach(async () => {
    urutanWaktu = 0;
    await kosongkanDatabase();
  });

  it("menerima sumber pembayaran, dan mewajibkan alasan koreksi", () => {
    expect(
      stockMasukCreateSchema.safeParse({
        bahanBakuId: randomUUID(),
        qty: 5,
        totalHargaBeli: 15000,
        dibayarDari: "kas_laci",
      }).success
    ).toBe(true);
    expect(
      stockMasukCreateSchema.safeParse({
        bahanBakuId: randomUUID(),
        qty: 5,
        totalHargaBeli: 15000,
      }).success
    ).toBe(false);
    expect(
      stockMasukCreateSchema.safeParse({
        bahanBakuId: randomUUID(),
        qty: 1.123,
        totalHargaBeli: 15000,
        dibayarDari: "kas_laci",
      }).success
    ).toBe(false);
    expect(
      stockMasukCreateSchema.safeParse({
        bahanBakuId: randomUUID(),
        qty: 1000,
        totalHargaBeli: 1,
        dibayarDari: "kas_laci",
      }).success
    ).toBe(false);
    expect(koreksiStockMasukSchema.safeParse({ alasan: "  " }).success).toBe(false);
    expect(koreksiStockMasukSchema.safeParse({ alasan: "Jumlah salah" }).success).toBe(true);
  });

  it("memberi kasir data stok tanpa kolom harga bahan", async () => {
    await siapkanBahan();

    const [row] = await listStokBahanCore(db);

    expect(row).toEqual({
      id: bahanId,
      nama: "Kopi M7",
      satuan: "gram",
      stokSaatIni: "100.00",
      batasMinimumStok: "10.00",
    });
    expect(row).not.toHaveProperty("hargaAktif");
    expect(row).not.toHaveProperty("hargaPerSatuan");
  });

  it("menambah stok segera dan memutuskan harga per entri", async () => {
    await siapkanBahan();
    const pengajuanPertama = await catat(CASHIER, "cashier", 5, 20, "kas_laci");
    const pengajuanKedua = await catat(CASHIER, "cashier", 5, 25, "di_luar_laci");

    expect(pengajuanPertama.statusHarga).toBe("menunggu");
    expect(pengajuanKedua.statusHarga).toBe("menunggu");
    expect(pengajuanPertama.dibayarDari).toBe("kas_laci");
    expect(pengajuanKedua.dibayarDari).toBe("di_luar_laci");
    expect(await getHargaAktifTx(db, bahanId)).toBe("2.00");

    const [bahanSesudah] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, bahanId));
    expect(bahanSesudah.stokSaatIni).toBe("110.00");

    await db.transaction((tx) =>
      putuskanHargaStockMasukTx(tx, pengajuanPertama.id, "setujui", OWNER, waktuBerikutnya())
    );
    expect(await getHargaAktifTx(db, bahanId)).toBe("4.00");

    await expect(
      db.transaction((tx) =>
        putuskanHargaStockMasukTx(tx, pengajuanKedua.id, "tolak", OWNER, waktuBerikutnya())
      )
    ).resolves.toMatchObject({ statusHarga: "ditolak" });
    expect(await getHargaAktifTx(db, bahanId)).toBe("4.00");
    const [history] = await db
      .select()
      .from(riwayatHargaBahan)
      .where(eq(riwayatHargaBahan.stockMasukId, pengajuanPertama.id));
    expect(history.hargaPerSatuan).toBe("4.00");
  });

  it("harga Stock Masuk owner langsung aktif tanpa antrean persetujuan", async () => {
    await siapkanBahan();

    const row = await catat(OWNER, "owner", 10, 30, "di_luar_laci");

    expect(row.statusHarga).toBe("disetujui");
    expect(row.konfirmasiHargaOleh).toBe(OWNER);
    expect(await getHargaAktifTx(db, bahanId)).toBe("3.00");
  });

  it("koreksi membalik stok, menandai audit, dan memulihkan harga sebelumnya", async () => {
    await siapkanBahan();
    const entry = await catat(OWNER, "owner", 10, 40);

    const corrected = await db.transaction((tx) =>
      koreksiStockMasukTx(tx, entry.id, "Jumlah pembelian salah", OWNER, waktuBerikutnya())
    );

    expect(corrected?.dibatalkanAt).not.toBeNull();
    expect(corrected?.dibatalkanOleh).toBe(OWNER);
    expect(corrected?.alasanBatal).toBe("Jumlah pembelian salah");
    const [bahanSesudah] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, bahanId));
    expect(bahanSesudah.stokSaatIni).toBe("100.00");
    expect(await getHargaAktifTx(db, bahanId)).toBe("2.00");
    const [entryPrice] = await db
      .select()
      .from(riwayatHargaBahan)
      .where(eq(riwayatHargaBahan.stockMasukId, entry.id));
    expect(entryPrice.dibatalkanAt).not.toBeNull();
  });

  it("menolak koreksi yang akan membuat stok negatif dan membiarkan data tetap utuh", async () => {
    await siapkanBahan();
    const entry = await catat(OWNER, "owner", 10, 40);
    await db.update(bahanBaku).set({ stokSaatIni: "5.00" }).where(eq(bahanBaku.id, bahanId));

    await expect(
      db.transaction((tx) =>
        koreksiStockMasukTx(tx, entry.id, "Jumlah salah", OWNER, waktuBerikutnya())
      )
    ).rejects.toBeInstanceOf(StokTidakCukupUntukKoreksiError);

    const [unchanged] = await db.select().from(stockMasuk).where(eq(stockMasuk.id, entry.id));
    expect(unchanged.dibatalkanAt).toBeNull();
    const [bahan] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, bahanId));
    expect(bahan.stokSaatIni).toBe("5.00");
  });

  it("tidak mengizinkan koreksi data lama yang sumber pembayarannya tidak diketahui", async () => {
    await siapkanBahan();
    const [legacy] = await db
      .insert(stockMasuk)
      .values({
        bahanBakuId: bahanId,
        qty: "5.00",
        hargaBeli: "2.00",
        totalPengeluaran: "10.00",
        pelakuId: OWNER,
      })
      .returning();

    await expect(
      db.transaction((tx) =>
        koreksiStockMasukTx(tx, legacy.id, "Entri lama salah", OWNER, waktuBerikutnya())
      )
    ).rejects.toBeInstanceOf(StockMasukLegacyTidakDapatDikoreksiError);
  });
});
