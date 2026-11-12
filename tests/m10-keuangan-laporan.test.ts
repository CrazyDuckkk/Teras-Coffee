import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  bahanBaku,
  detailTransaksi,
  hutang,
  hutangPembayaran,
  menu,
  penyesuaianStok,
  penyesuaianStokDetail,
  stockMasuk,
  transaksi,
  tutupKasir,
  user,
} from "@/db/schema";
import {
  buatRentangLaporan,
  getLaporanKeuanganCore,
} from "@/lib/laporan-keuangan-core";
import { kosongkanDatabase } from "./helpers/db";

describe("M10 keuangan dan laporan", () => {
  beforeEach(async () => {
    await kosongkanDatabase();
  });

  it("membuat periode kalender WIB untuk minggu Senin-Minggu dan bulan", () => {
    const now = new Date("2026-11-12T05:00:00Z");
    const mingguan = buatRentangLaporan("mingguan", "2026-11-12", now);
    const bulanan = buatRentangLaporan("bulanan", "2026-11-12", now);

    expect(mingguan.tanggalMulai).toBe("2026-11-09");
    expect(mingguan.tanggalAkhir).toBe("2026-11-15");
    expect(mingguan.start.toISOString()).toBe("2026-11-08T17:00:00.000Z");
    expect(bulanan.tanggalMulai).toBe("2026-11-01");
    expect(bulanan.tanggalAkhir).toBe("2026-11-30");
    expect(buatRentangLaporan("bulanan", "2026-13-40", now).tanggalMulai).toBe("2026-11-01");
  });

  it("mengakui laba hutang pada pelunasan terakhir dan menyatukan angka layar", async () => {
    const [owner] = await db.insert(user).values({
      id: "owner-m10",
      name: "Owner",
      email: "owner-m10@test.local",
      role: "owner",
    }).returning();
    const [kopi] = await db.insert(menu).values({
      nama: "Kopi Susu",
      kategori: "kopi",
      hargaJual: "100.00",
    }).returning();
    const [bahan] = await db.insert(bahanBaku).values({
      nama: "Susu",
      satuan: "ml",
      stokSaatIni: "20.00",
    }).returning();

    const [tunai] = await db.insert(transaksi).values({
      tanggal: new Date("2026-11-10T02:00:00Z"),
      totalPemasukan: "200.00",
      metodeBayar: "tunai",
      pelakuId: owner.id,
    }).returning();
    const [hutangLunas] = await db.insert(transaksi).values({
      tanggal: new Date("2026-11-08T02:00:00Z"),
      totalPemasukan: "200.00",
      metodeBayar: "hutang",
      pelakuId: owner.id,
    }).returning();
    const [hutangBelumLunas] = await db.insert(transaksi).values({
      tanggal: new Date("2026-11-12T02:00:00Z"),
      totalPemasukan: "80.00",
      metodeBayar: "hutang",
      pelakuId: owner.id,
    }).returning();
    const [voided] = await db.insert(transaksi).values({
      tanggal: new Date("2026-11-13T02:00:00Z"),
      totalPemasukan: "100.00",
      metodeBayar: "tunai",
      status: "void",
      pelakuId: owner.id,
    }).returning();

    await db.insert(detailTransaksi).values([
      { transaksiId: tunai.id, menuId: kopi.id, qty: 2, hargaJualSaatItu: "100.00", hppSaatItu: "40.00" },
      { transaksiId: hutangLunas.id, menuId: kopi.id, qty: 1, hargaJualSaatItu: "200.00", hppSaatItu: "80.00" },
      { transaksiId: hutangBelumLunas.id, menuId: kopi.id, qty: 1, hargaJualSaatItu: "80.00", hppSaatItu: "30.00" },
      { transaksiId: voided.id, menuId: kopi.id, qty: 1, hargaJualSaatItu: "100.00", hppSaatItu: "40.00" },
    ]);

    const waktuLunas = new Date("2026-11-10T03:00:00Z");
    const [hutangRow] = await db.insert(hutang).values({
      transaksiId: hutangLunas.id,
      namaPelanggan: "Budi",
      jumlah: "200.00",
      tanggalHutang: new Date("2026-11-08T02:00:00Z"),
      status: "lunas",
      tanggalLunas: waktuLunas,
    }).returning();
    await db.insert(hutangPembayaran).values([
      { hutangId: hutangRow.id, jumlah: "100.00", metode: "tunai", dibayarAt: new Date("2026-11-09T03:00:00Z"), pelakuId: owner.id },
      { hutangId: hutangRow.id, jumlah: "100.00", metode: "qris", dibayarAt: waktuLunas, pelakuId: owner.id },
    ]);
    await db.insert(hutang).values({
      transaksiId: hutangBelumLunas.id,
      namaPelanggan: "Sari",
      jumlah: "80.00",
      tanggalHutang: new Date("2026-11-12T02:00:00Z"),
    }).returning();

    await db.insert(stockMasuk).values({
      tanggal: new Date("2026-11-11T03:00:00Z"),
      bahanBakuId: bahan.id,
      qty: "2.00",
      hargaBeli: "15.00",
      totalPengeluaran: "30.00",
      dibayarDari: "kas_laci",
      pelakuId: owner.id,
    });
    const [penyesuaian] = await db.insert(penyesuaianStok).values({
      jenis: "rusak",
      alasan: "Bahan rusak",
      pelakuId: owner.id,
      createdAt: new Date("2026-11-11T04:00:00Z"),
    }).returning();
    await db.insert(penyesuaianStokDetail).values({
      penyesuaianStokId: penyesuaian.id,
      bahanBakuId: bahan.id,
      perubahanQty: "-1.00",
      stokSebelum: "2.00",
      stokSesudah: "1.00",
      hargaPerSatuan: "20.00",
      nilaiSusut: "20.00",
    });

    await db.insert(tutupKasir).values([
      {
        tanggal: "2026-11-11",
        totalPenjualan: "0.00",
        totalPengeluaran: "0.00",
        labaKotor: "0.00",
        kasAwal: "0.00",
        kasDiharapkan: "0.00",
        qrisSistem: "0.00",
        statusPenutupan: "otomatis_belum_diverifikasi",
      },
      {
        tanggal: "2026-11-12",
        totalPenjualan: "0.00",
        totalPengeluaran: "0.00",
        labaKotor: "0.00",
        kasAwal: "0.00",
        kasFisik: "15.00",
        qrisTerhitung: "0.00",
        kasDiharapkan: "0.00",
        qrisSistem: "5.00",
        selisihKas: "15.00",
        selisihQris: "-5.00",
        statusPenutupan: "manual",
      },
    ]);

    const data = await getLaporanKeuanganCore(
      buatRentangLaporan("mingguan", "2026-11-12"),
      db,
    );

    expect(data.ringkasan.penjualanPerMetode).toEqual({ tunai: 200, qris: 0, hutang: 80 });
    expect(data.ringkasan.pembayaranHutang).toEqual({ tunai: 100, qris: 100, total: 200 });
    expect(data.ringkasan.totalPemasukan).toBe(400);
    expect(data.ringkasan.totalPengeluaran).toBe(30);
    expect(data.ringkasan.labaDiakui).toBe(240);
    expect(data.ringkasan.biayaSusut).toBe(20);
    expect(data.ringkasan.dasarBagiHasil).toBe(220);
    expect(data.ringkasan.totalPiutang).toBe(80);
    expect(data.ringkasan.selisihKas).toBe(15);
    expect(data.ringkasan.selisihQris).toBe(-5);
    expect(data.ringkasan.hariTutupOtomatis).toBe(1);
    expect(data.ringkasan.jumlahVoid).toBe(1);
    expect(data.performaMenu).toMatchObject([
      { nama: "Kopi Susu", porsiDineIn: 3, omzet: 400, hpp: 160, laba: 240 },
    ]);
    expect(data.piutang).toMatchObject([{ namaPelanggan: "Sari", sisa: 80 }]);
    expect(data.kasHarian.find((row) => row.tanggal === "2026-11-10")?.labaDiakui).toBe(240);
    expect(data.transaksi).toHaveLength(4);
    expect(data.stockDanSusut).toHaveLength(2);
    expect(data.bukuKas).toHaveLength(4);
  });
});
