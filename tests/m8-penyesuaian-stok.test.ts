import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bahanBaku,
  menu,
  penyesuaianStok,
  penyesuaianStokDetail,
  resepMenu,
  riwayatHargaBahan,
  user,
} from "@/db/schema";
import {
  catatOpnameStokTx,
  catatPenyesuaianStokTx,
  HargaSusutTidakDiketahuiError,
  OpnameTanpaSelisihError,
  StokTidakCukupUntukPenyesuaianError,
} from "@/lib/inventaris-core";
import { opnameStokSchema, penyesuaianStokCreateSchema } from "@/lib/validations/inventaris";
import { kosongkanDatabase } from "./helpers/db";

const OWNER = "owner-m8";
const CASHIER = "cashier-m8";
let waktu = 0;

function waktuBerikutnya() {
  waktu += 1;
  return new Date(Date.now() + waktu * 1_000);
}

async function siapkanPengguna() {
  await db.insert(user).values([
    { id: OWNER, name: "Owner Uji", email: "owner-m8@uji.test", role: "owner" },
    { id: CASHIER, name: "Kasir Uji", email: "kasir-m8@uji.test", role: "cashier" },
  ]);
}

async function siapkanBahan(
  bahan: { nama: string; stok: string; harga?: string; satuan?: "gram" | "ml" | "pcs" }[]
) {
  const rows = await db
    .insert(bahanBaku)
    .values(
      bahan.map((item) => ({
        nama: item.nama,
        satuan: item.satuan ?? "gram",
        stokSaatIni: item.stok,
        batasMinimumStok: "1.00",
      }))
    )
    .returning();

  const harga = rows.flatMap((row, index) =>
    bahan[index].harga ? [{ bahanBakuId: row.id, hargaPerSatuan: bahan[index].harga! }] : []
  );
  if (harga.length > 0) await db.insert(riwayatHargaBahan).values(harga);
  return rows;
}

describe("M8 Penyesuaian stok dan opname", () => {
  beforeEach(async () => {
    waktu = 0;
    await kosongkanDatabase();
    await siapkanPengguna();
  });

  it("memvalidasi alasan, mode menu, jumlah, dan hitungan opname", () => {
    const bahanBakuId = randomUUID();
    const menuId = randomUUID();
    expect(
      penyesuaianStokCreateSchema.safeParse({
        jenis: "menu_tumpah",
        menuId,
        bawaPulang: true,
        alasan: "Tumpah saat dibuat",
      }).success
    ).toBe(true);
    expect(
      penyesuaianStokCreateSchema.safeParse({
        jenis: "kalibrasi",
        bahanBakuId,
        qty: 1.125,
        alasan: "Kalibrasi grinder",
      }).success
    ).toBe(false);
    expect(
      penyesuaianStokCreateSchema.safeParse({
        jenis: "rusak",
        bahanBakuId,
        qty: 1,
        alasan: "  ",
      }).success
    ).toBe(false);
    expect(opnameStokSchema.safeParse({ bahanBakuId, stokFisik: 0, alasan: "Opname fisik" }).success).toBe(true);
    expect(opnameStokSchema.safeParse({ bahanBakuId, stokFisik: -1, alasan: "Opname fisik" }).success).toBe(false);
  });

  it("mencatat penyesuaian bahan, aktor, dan nilai susut berdasarkan harga saat itu", async () => {
    const [kopi] = await siapkanBahan([{ nama: "Kopi M8", stok: "20.00", harga: "5.25" }]);
    const row = await db.transaction((tx) =>
      catatPenyesuaianStokTx(
        tx,
        { jenis: "kalibrasi", bahanBakuId: kopi.id, qty: 1.25, alasan: "Kalibrasi grinder" },
        CASHIER,
        waktuBerikutnya()
      )
    );

    expect(row.jenis).toBe("kalibrasi");
    expect(row.pelakuId).toBe(CASHIER);
    const [stok] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, kopi.id));
    expect(stok.stokSaatIni).toBe("18.75");

    const [detail] = await db
      .select()
      .from(penyesuaianStokDetail)
      .where(eq(penyesuaianStokDetail.penyesuaianStokId, row.id));
    expect(detail.perubahanQty).toBe("-1.25");
    expect(detail.hargaPerSatuan).toBe("5.25");
    expect(detail.nilaiSusut).toBe("6.56");

    await db.insert(riwayatHargaBahan).values({
      bahanBakuId: kopi.id,
      hargaPerSatuan: "10.00",
      berlakuSejak: waktuBerikutnya(),
    });
    const [detailLama] = await db
      .select()
      .from(penyesuaianStokDetail)
      .where(eq(penyesuaianStokDetail.id, detail.id));
    expect(detailLama.nilaiSusut).toBe("6.56");
  });

  it("memotong resep sesuai mode dan hanya mengurangi kemasan untuk bawa pulang", async () => {
    const [kopi, gelas] = await siapkanBahan([
      { nama: "Kopi Resep M8", stok: "100.00", harga: "2.00" },
      { nama: "Gelas Resep M8", stok: "10.00", harga: "1.00", satuan: "pcs" },
    ]);
    const [menuRow] = await db
      .insert(menu)
      .values({ nama: "Menu M8", kategori: "kopi", hargaJual: "10000.00" })
      .returning();
    await db.insert(resepMenu).values([
      { menuId: menuRow.id, bahanBakuId: kopi.id, takaran: "18.00" },
      { menuId: menuRow.id, bahanBakuId: gelas.id, takaran: "1.00", hanyaBawaPulang: true },
    ]);

    const dineIn = await db.transaction((tx) =>
      catatPenyesuaianStokTx(
        tx,
        { jenis: "menu_tumpah", menuId: menuRow.id, bawaPulang: false, alasan: "Minuman tumpah" },
        CASHIER,
        waktuBerikutnya()
      )
    );
    const takeout = await db.transaction((tx) =>
      catatPenyesuaianStokTx(
        tx,
        { jenis: "menu_gagal", menuId: menuRow.id, bawaPulang: true, alasan: "Pesanan gagal dibuat" },
        OWNER,
        waktuBerikutnya()
      )
    );

    const [kopiSesudah, gelasSesudah] = await Promise.all([
      db.select().from(bahanBaku).where(eq(bahanBaku.id, kopi.id)),
      db.select().from(bahanBaku).where(eq(bahanBaku.id, gelas.id)),
    ]);
    expect(kopiSesudah[0].stokSaatIni).toBe("64.00");
    expect(gelasSesudah[0].stokSaatIni).toBe("9.00");

    const detailDineIn = await db
      .select()
      .from(penyesuaianStokDetail)
      .where(eq(penyesuaianStokDetail.penyesuaianStokId, dineIn.id));
    const detailTakeout = await db
      .select()
      .from(penyesuaianStokDetail)
      .where(eq(penyesuaianStokDetail.penyesuaianStokId, takeout.id));
    expect(detailDineIn).toHaveLength(1);
    expect(detailTakeout).toHaveLength(2);
    expect(takeout.bawaPulang).toBe(true);
  });

  it("mencatat opname ke dua arah, tetapi menghitung susut hanya saat stok turun", async () => {
    const [bahan] = await siapkanBahan([{ nama: "Susu M8", stok: "10.00", harga: "1.50", satuan: "ml" }]);
    const turun = await db.transaction((tx) =>
      catatOpnameStokTx(
        tx,
        { bahanBakuId: bahan.id, stokFisik: 7.25, alasan: "Hitung stok pergantian shift" },
        OWNER,
        waktuBerikutnya()
      )
    );
    const naik = await db.transaction((tx) =>
      catatOpnameStokTx(
        tx,
        { bahanBakuId: bahan.id, stokFisik: 8.25, alasan: "Hitung ulang stok" },
        OWNER,
        waktuBerikutnya()
      )
    );

    const [detailTurun] = await db
      .select()
      .from(penyesuaianStokDetail)
      .where(eq(penyesuaianStokDetail.penyesuaianStokId, turun.id));
    const [detailNaik] = await db
      .select()
      .from(penyesuaianStokDetail)
      .where(eq(penyesuaianStokDetail.penyesuaianStokId, naik.id));
    expect(detailTurun.perubahanQty).toBe("-2.75");
    expect(detailTurun.nilaiSusut).toBe("4.13");
    expect(detailNaik.perubahanQty).toBe("1.00");
    expect(detailNaik.nilaiSusut).toBe("0.00");

    await expect(
      db.transaction((tx) =>
        catatOpnameStokTx(
          tx,
          { bahanBakuId: bahan.id, stokFisik: 8.25, alasan: "Hitung ulang" },
          OWNER,
          waktuBerikutnya()
        )
      )
    ).rejects.toBeInstanceOf(OpnameTanpaSelisihError);
  });

  it("membatalkan transaksi saat stok kurang atau harga susut tidak tersedia", async () => {
    const [cukup, tanpaHarga] = await siapkanBahan([
      { nama: "Cukup M8", stok: "2.00", harga: "3.00" },
      { nama: "Tanpa Harga M8", stok: "5.00" },
    ]);

    await expect(
      db.transaction((tx) =>
        catatPenyesuaianStokTx(
          tx,
          { jenis: "rusak", bahanBakuId: cukup.id, qty: 3, alasan: "Bahan rusak" },
          CASHIER,
          waktuBerikutnya()
        )
      )
    ).rejects.toBeInstanceOf(StokTidakCukupUntukPenyesuaianError);

    await expect(
      db.transaction((tx) =>
        catatPenyesuaianStokTx(
          tx,
          { jenis: "kedaluwarsa", bahanBakuId: tanpaHarga.id, qty: 1, alasan: "Bahan kedaluwarsa" },
          CASHIER,
          waktuBerikutnya()
        )
      )
    ).rejects.toBeInstanceOf(HargaSusutTidakDiketahuiError);

    const [stok] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, cukup.id));
    const [stokTanpaHarga] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, tanpaHarga.id));
    const penyesuaian = await db.select().from(penyesuaianStok);
    expect(stok.stokSaatIni).toBe("2.00");
    expect(stokTanpaHarga.stokSaatIni).toBe("5.00");
    expect(penyesuaian).toHaveLength(0);
  });

  it("mencegah dua penyesuaian bersamaan menghabiskan stok yang sama", async () => {
    const [bahan] = await siapkanBahan([{ nama: "Stok Bersama M8", stok: "3.00", harga: "1.00" }]);
    const hasil = await Promise.allSettled([
      db.transaction((tx) =>
        catatPenyesuaianStokTx(
          tx,
          { jenis: "tes_rasa", bahanBakuId: bahan.id, qty: 2, alasan: "Tes rasa pertama" },
          CASHIER,
          waktuBerikutnya()
        )
      ),
      db.transaction((tx) =>
        catatPenyesuaianStokTx(
          tx,
          { jenis: "tes_rasa", bahanBakuId: bahan.id, qty: 2, alasan: "Tes rasa kedua" },
          CASHIER,
          waktuBerikutnya()
        )
      ),
    ]);

    expect(hasil.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(
      hasil.filter(
        (item) => item.status === "rejected" && item.reason instanceof StokTidakCukupUntukPenyesuaianError
      )
    ).toHaveLength(1);
    const [stok] = await db.select().from(bahanBaku).where(eq(bahanBaku.id, bahan.id));
    const details = await db.select().from(penyesuaianStokDetail).where(and(eq(penyesuaianStokDetail.bahanBakuId, bahan.id)));
    expect(stok.stokSaatIni).toBe("1.00");
    expect(details).toHaveLength(1);
  });
});
