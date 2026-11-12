import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { db } from "@/db";
import {
  bahanBaku,
  menu,
  penyesuaianStok,
  penyesuaianStokDetail,
  resepMenu,
  riwayatHargaBahan,
  stockMasuk,
} from "@/db/schema";
import type {
  OpnameStokInput,
  PenyesuaianStokCreateInput,
  StockMasukCreateInput,
} from "@/lib/validations/inventaris";
import type { UserRole } from "@/lib/roles";
import { siapkanPencatatanKasTx } from "@/lib/tutup-kasir-core";

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

export class BahanPenyesuaianTidakDitemukanError extends Error {
  constructor() {
    super("Bahan baku tidak ditemukan atau sudah tidak aktif.");
    this.name = "BahanPenyesuaianTidakDitemukanError";
  }
}

export class MenuPenyesuaianTidakDitemukanError extends Error {
  constructor() {
    super("Menu tidak ditemukan atau sudah tidak aktif.");
    this.name = "MenuPenyesuaianTidakDitemukanError";
  }
}

export class MenuTidakAdaBahanPenyesuaianError extends Error {
  constructor() {
    super("Resep menu tidak memiliki bahan untuk mode yang dipilih.");
    this.name = "MenuTidakAdaBahanPenyesuaianError";
  }
}

export class StokTidakCukupUntukPenyesuaianError extends Error {
  constructor(public bahanNama: string, public tersedia: string, public dibutuhkan: string) {
    super(`Stok ${bahanNama} tidak cukup (tersedia ${tersedia}, dibutuhkan ${dibutuhkan}).`);
    this.name = "StokTidakCukupUntukPenyesuaianError";
  }
}

export class HargaSusutTidakDiketahuiError extends Error {
  constructor(public bahanNama: string) {
    super(`Harga aktif ${bahanNama} belum tersedia, sehingga nilai susut tidak dapat dihitung.`);
    this.name = "HargaSusutTidakDiketahuiError";
  }
}

export class OpnameTanpaSelisihError extends Error {
  constructor() {
    super("Stok fisik sama dengan stok sistem; tidak ada penyesuaian yang perlu dicatat.");
    this.name = "OpnameTanpaSelisihError";
  }
}

export class NilaiPenyesuaianTerlaluBesarError extends Error {
  constructor() {
    super("Nilai penyesuaian melebihi batas penyimpanan.");
    this.name = "NilaiPenyesuaianTerlaluBesarError";
  }
}

function keDuaDesimal(value: number) {
  return Math.round(value * 100) / 100;
}

const NILAI_MAKSIMUM_SEN = 999_999_999_999;

function kePerseratus(value: string | number): number {
  const scaled = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(scaled)) throw new NilaiPenyesuaianTerlaluBesarError();
  return scaled;
}

function dariPerseratus(value: number): string {
  const negative = value < 0;
  const absolute = Math.abs(value);
  return `${negative ? "-" : ""}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function hitungNilaiSusut(qtyPerseratus: number, hargaPerseratus: number): number {
  if (qtyPerseratus <= 0 || hargaPerseratus < 0) throw new NilaiPenyesuaianTerlaluBesarError();
  if (hargaPerseratus === 0) return 0;
  const produkMaksimum = NILAI_MAKSIMUM_SEN * 100 + 49;
  if (qtyPerseratus > Math.floor(produkMaksimum / hargaPerseratus)) {
    throw new NilaiPenyesuaianTerlaluBesarError();
  }
  const nilaiSen = Math.floor((qtyPerseratus * hargaPerseratus + 50) / 100);
  if (nilaiSen > NILAI_MAKSIMUM_SEN) throw new NilaiPenyesuaianTerlaluBesarError();
  return nilaiSen;
}

type PerubahanBahan = {
  bahanBakuId: string;
  bahanNama: string;
  perubahanQty: number;
  stokSebelum: number;
  stokSesudah: number;
  hargaPerSatuan: string | null;
  nilaiSusut: number;
};

async function siapkanPerubahanBahan(
  tx: InventarisDbOrTx,
  bahanBakuId: string,
  perubahanQty: number
): Promise<PerubahanBahan> {
  const [bahan] = await tx.select().from(bahanBaku).where(eq(bahanBaku.id, bahanBakuId)).for("update");
  if (!bahan || !bahan.isActive) throw new BahanPenyesuaianTidakDitemukanError();

  const stokSebelum = kePerseratus(bahan.stokSaatIni);
  const stokSesudah = stokSebelum + perubahanQty;
  if (stokSesudah < 0) {
    throw new StokTidakCukupUntukPenyesuaianError(
      bahan.nama,
      dariPerseratus(stokSebelum),
      dariPerseratus(-perubahanQty)
    );
  }
  if (stokSesudah > NILAI_MAKSIMUM_SEN) throw new NilaiPenyesuaianTerlaluBesarError();

  const hargaPerSatuan = await getHargaAktifTx(tx, bahanBakuId);
  let nilaiSusut = 0;
  if (perubahanQty < 0) {
    if (hargaPerSatuan === null) throw new HargaSusutTidakDiketahuiError(bahan.nama);
    nilaiSusut = hitungNilaiSusut(-perubahanQty, kePerseratus(hargaPerSatuan));
    if (nilaiSusut > NILAI_MAKSIMUM_SEN) throw new NilaiPenyesuaianTerlaluBesarError();
  }

  return {
    bahanBakuId,
    bahanNama: bahan.nama,
    perubahanQty,
    stokSebelum,
    stokSesudah,
    hargaPerSatuan,
    nilaiSusut,
  };
}

async function simpanPenyesuaianTx(
  tx: InventarisDbOrTx,
  values: {
    jenis: (typeof penyesuaianStok.$inferInsert)["jenis"];
    alasan: string;
    menuId?: string;
    bawaPulang?: boolean;
    pelakuId: string;
  },
  perubahan: PerubahanBahan[],
  now: Date
) {
  const [entry] = await tx
    .insert(penyesuaianStok)
    .values({
      jenis: values.jenis,
      alasan: values.alasan,
      menuId: values.menuId,
      bawaPulang: values.bawaPulang,
      pelakuId: values.pelakuId,
      createdAt: now,
    })
    .returning();

  for (const item of perubahan) {
    await tx
      .update(bahanBaku)
      .set({ stokSaatIni: dariPerseratus(item.stokSesudah), updatedAt: now })
      .where(eq(bahanBaku.id, item.bahanBakuId));
  }

  await tx.insert(penyesuaianStokDetail).values(
    perubahan.map((item) => ({
      penyesuaianStokId: entry.id,
      bahanBakuId: item.bahanBakuId,
      perubahanQty: dariPerseratus(item.perubahanQty),
      stokSebelum: dariPerseratus(item.stokSebelum),
      stokSesudah: dariPerseratus(item.stokSesudah),
      hargaPerSatuan: item.hargaPerSatuan,
      nilaiSusut: dariPerseratus(item.nilaiSusut),
    }))
  );

  return entry;
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
  now?: Date
) {
  const { timestamp: waktuMasuk, setelahTutup } = await siapkanPencatatanKasTx(tx, now);
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
      tanggal: waktuMasuk,
      bahanBakuId: input.bahanBakuId,
      qty: input.qty.toFixed(2),
      hargaBeli: hargaPerSatuan.toFixed(2),
      totalPengeluaran: input.totalHargaBeli.toFixed(2),
      dibayarDari: input.dibayarDari,
      setelahTutup,
      statusHarga: menungguKonfirmasi ? "menunggu" : "disetujui",
      pelakuId,
      ...(role === "owner" && {
        konfirmasiHargaAt: waktuMasuk,
        konfirmasiHargaOleh: pelakuId,
      }),
    })
    .returning();

  await tx
    .update(bahanBaku)
    .set({
      stokSaatIni: sql`${bahanBaku.stokSaatIni} + ${input.qty.toFixed(2)}`,
      updatedAt: waktuMasuk,
    })
    .where(eq(bahanBaku.id, input.bahanBakuId));

  if (!menungguKonfirmasi && hargaBerubah) {
    await catatRiwayatHarga(tx, entry.id, input.bahanBakuId, hargaPerSatuan.toFixed(2), waktuMasuk);
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

export async function catatPenyesuaianStokTx(
  tx: InventarisDbOrTx,
  input: PenyesuaianStokCreateInput,
  pelakuId: string,
  now: Date = new Date()
) {
  if ("menuId" in input) {
    const [menuRow] = await tx
      .select()
      .from(menu)
      .where(and(eq(menu.id, input.menuId), eq(menu.isActive, true)))
      .for("update");
    if (!menuRow) throw new MenuPenyesuaianTidakDitemukanError();

    const resep = await tx
      .select({
        bahanBakuId: resepMenu.bahanBakuId,
        takaran: resepMenu.takaran,
        hanyaBawaPulang: resepMenu.hanyaBawaPulang,
      })
      .from(resepMenu)
      .where(eq(resepMenu.menuId, input.menuId))
      .orderBy(asc(resepMenu.bahanBakuId));
    const bahanTerpakai = resep.filter((row) => input.bawaPulang || !row.hanyaBawaPulang);
    if (bahanTerpakai.length === 0) throw new MenuTidakAdaBahanPenyesuaianError();

    const perubahan: PerubahanBahan[] = [];
    for (const row of bahanTerpakai) {
      perubahan.push(
        await siapkanPerubahanBahan(tx, row.bahanBakuId, -kePerseratus(row.takaran))
      );
    }

    return simpanPenyesuaianTx(
      tx,
      {
        jenis: input.jenis,
        alasan: input.alasan,
        menuId: input.menuId,
        bawaPulang: input.bawaPulang,
        pelakuId,
      },
      perubahan,
      now
    );
  }

  const perubahan = await siapkanPerubahanBahan(tx, input.bahanBakuId, -kePerseratus(input.qty));
  return simpanPenyesuaianTx(
    tx,
    { jenis: input.jenis, alasan: input.alasan, pelakuId },
    [perubahan],
    now
  );
}

export async function catatOpnameStokTx(
  tx: InventarisDbOrTx,
  input: OpnameStokInput,
  pelakuId: string,
  now: Date = new Date()
) {
  const [bahan] = await tx
    .select()
    .from(bahanBaku)
    .where(eq(bahanBaku.id, input.bahanBakuId))
    .for("update");
  if (!bahan || !bahan.isActive) throw new BahanPenyesuaianTidakDitemukanError();

  const stokSebelum = kePerseratus(bahan.stokSaatIni);
  const stokSesudah = kePerseratus(input.stokFisik);
  const perubahanQty = stokSesudah - stokSebelum;
  if (perubahanQty === 0) throw new OpnameTanpaSelisihError();

  let hargaPerSatuan: string | null = null;
  let nilaiSusut = 0;
  if (perubahanQty < 0) {
    hargaPerSatuan = await getHargaAktifTx(tx, input.bahanBakuId);
    if (hargaPerSatuan === null) throw new HargaSusutTidakDiketahuiError(bahan.nama);
    nilaiSusut = hitungNilaiSusut(-perubahanQty, kePerseratus(hargaPerSatuan));
    if (nilaiSusut > NILAI_MAKSIMUM_SEN) throw new NilaiPenyesuaianTerlaluBesarError();
  }

  return simpanPenyesuaianTx(
    tx,
    { jenis: "opname", alasan: input.alasan, pelakuId },
    [
      {
        bahanBakuId: bahan.id,
        bahanNama: bahan.nama,
        perubahanQty,
        stokSebelum,
        stokSesudah,
        hargaPerSatuan,
        nilaiSusut,
      },
    ],
    now
  );
}
