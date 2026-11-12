import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { hutang, hutangPembayaran, transaksi, user } from "@/db/schema";
import {
  buatWorkbookLaporan,
  getPeringatanEksporUntukTanggalCore,
  getTanggalDampakPembatalanHutangCore,
  simpanEksporLaporanCore,
} from "@/lib/laporan-ekspor-core";
import { buatRentangLaporan, getLaporanKeuanganCore } from "@/lib/laporan-keuangan-core";
import { kosongkanDatabase } from "./helpers/db";

describe("M11 ekspor Excel", () => {
  beforeEach(async () => {
    await kosongkanDatabase();
  });

  it("membuat enam sheet dan rumus bagi hasil yang dapat diubah di Excel", async () => {
    const data = await getLaporanKeuanganCore(
      buatRentangLaporan("bulanan", "2026-11-01"),
      db,
    );
    const workbook = buatWorkbookLaporan(data, new Date("2026-11-30T12:00:00Z"));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Ringkasan",
      "Harian",
      "Transaksi",
      "Performa Menu",
      "Stok dan Susut",
      "Hutang",
    ]);
    expect(workbook.getWorksheet("Ringkasan")?.getCell("B13").value).toEqual({ formula: "B10-B11-B12" });
    expect(workbook.getWorksheet("Ringkasan")?.getCell("B15").value).toEqual({
      formula: 'IF(B14="",0,B13*B14)',
    });
    expect(workbook.getWorksheet("Ringkasan")?.getCell("B21").numFmt).toContain('"Rp"');
    expect(workbook.getWorksheet("Ringkasan")?.getCell("B14").dataValidation.type).toBe("decimal");
  });

  it("mencatat ekspor dan memberi peringatan hanya untuk tanggal di dalam periode", async () => {
    const [owner] = await db.insert(user).values({
      id: "owner-m11",
      name: "Owner",
      email: "owner-m11@test.local",
      role: "owner",
    }).returning();
    const range = buatRentangLaporan("mingguan", "2026-11-09");

    await simpanEksporLaporanCore({
      periode: range.periode,
      rentangMulai: range.start,
      rentangSampai: range.end,
      namaFile: "Laporan_Teras_Coffee_mingguan-2026-11-09-2026-11-15.xlsx",
      dieksporOleh: owner.id,
      dieksporPada: new Date("2026-11-12T12:00:00Z"),
    }, db);

    const warnings = await getPeringatanEksporUntukTanggalCore([
      new Date("2026-11-10T12:00:00Z"),
      range.end,
    ], db);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("sudah pernah diekspor");
    expect(warnings[0]).toContain("9 November 2026");
    expect(warnings[0]).toContain("15 November 2026");
  });

  it("mencakup tanggal pelunasan baru saat pembayaran terakhir dibatalkan", async () => {
    const [owner] = await db.insert(user).values({
      id: "owner-m11-payment",
      name: "Owner",
      email: "owner-m11-payment@test.local",
      role: "owner",
    }).returning();
    const [sale] = await db.insert(transaksi).values({
      totalPemasukan: "200.00",
      metodeBayar: "hutang",
      pelakuId: owner.id,
    }).returning();
    const [debt] = await db.insert(hutang).values({
      transaksiId: sale.id,
      jumlah: "200.00",
      tanggalHutang: new Date("2026-11-08T02:00:00Z"),
      status: "lunas",
      tanggalLunas: new Date("2026-11-10T03:00:00Z"),
    }).returning();
    const tanggalPembayaranPertama = new Date("2026-11-09T03:00:00Z");
    const tanggalPembayaranTerakhir = new Date("2026-11-10T03:00:00Z");
    const [, pembayaranTerakhir] = await db.insert(hutangPembayaran).values([
      {
        hutangId: debt.id,
        jumlah: "100.00",
        metode: "tunai",
        dibayarAt: tanggalPembayaranPertama,
        pelakuId: owner.id,
      },
      {
        hutangId: debt.id,
        jumlah: "100.00",
        metode: "tunai",
        dibayarAt: tanggalPembayaranTerakhir,
        pelakuId: owner.id,
      },
    ]).returning({ id: hutangPembayaran.id });

    const tanggalDampak = await getTanggalDampakPembatalanHutangCore(debt.id, pembayaranTerakhir.id, db);

    expect(tanggalDampak).toEqual([
      tanggalPembayaranTerakhir,
      tanggalPembayaranTerakhir,
      tanggalPembayaranPertama,
    ]);
  });
});
