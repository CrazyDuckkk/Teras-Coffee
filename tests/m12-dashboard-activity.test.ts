import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  bahanBaku,
  detailTransaksi,
  hutang,
  menu,
  pengajuanVoid,
  stockMasuk,
  transaksi,
  tutupKasir,
  user,
} from "@/db/schema";
import { listAktivitasCore } from "@/lib/aktivitas-core";
import { getDashboardSummaryCore } from "@/lib/dashboard-core";
import { kosongkanDatabase } from "./helpers/db";

describe("M12 dashboard dan aktivitas", () => {
  beforeEach(async () => {
    await kosongkanDatabase();
  });

  it("menghitung ringkasan hari dan minggu serta perhatian owner", async () => {
    const now = new Date("2026-11-12T10:00:00Z");
    const [owner] = await db.insert(user).values({
      id: "owner-m12-dashboard",
      name: "Owner",
      email: "owner-m12-dashboard@test.local",
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
      stokSaatIni: "0.00",
      batasMinimumStok: "5.00",
    }).returning();
    const [hariIni] = await db.insert(transaksi).values({
      tanggal: new Date("2026-11-12T02:00:00Z"),
      totalPemasukan: "100.00",
      metodeBayar: "tunai",
      pelakuId: owner.id,
    }).returning();
    const [menungguVoid] = await db.insert(transaksi).values({
      tanggal: new Date("2026-11-12T03:00:00Z"),
      totalPemasukan: "40.00",
      metodeBayar: "qris",
      status: "menunggu_void",
      pelakuId: owner.id,
    }).returning();
    const [mingguIni] = await db.insert(transaksi).values({
      tanggal: new Date("2026-11-10T02:00:00Z"),
      totalPemasukan: "50.00",
      metodeBayar: "tunai",
      pelakuId: owner.id,
    }).returning();
    const [hutangLama] = await db.insert(transaksi).values({
      tanggal: new Date("2026-10-13T02:00:00Z"),
      totalPemasukan: "90.00",
      metodeBayar: "hutang",
      pelakuId: owner.id,
    }).returning();
    await db.insert(detailTransaksi).values([
      { transaksiId: hariIni.id, menuId: kopi.id, qty: 1, hargaJualSaatItu: "100.00", hppSaatItu: "40.00" },
      { transaksiId: menungguVoid.id, menuId: kopi.id, qty: 1, hargaJualSaatItu: "40.00", hppSaatItu: "15.00" },
      { transaksiId: mingguIni.id, menuId: kopi.id, qty: 1, hargaJualSaatItu: "50.00", hppSaatItu: "20.00" },
    ]);
    await db.insert(pengajuanVoid).values({
      transaksiId: menungguVoid.id,
      alasan: "Salah input",
      diajukanOleh: owner.id,
      diajukanAt: new Date("2026-11-12T08:00:00Z"),
    });
    await db.insert(stockMasuk).values({
      tanggal: new Date("2026-11-11T02:00:00Z"),
      bahanBakuId: bahan.id,
      qty: "2.00",
      hargaBeli: "10.00",
      totalPengeluaran: "20.00",
      dibayarDari: "kas_laci",
      statusHarga: "menunggu",
      pelakuId: owner.id,
    });
    await db.insert(tutupKasir).values([
      {
        tanggal: "2026-11-11",
        totalPenjualan: "0.00",
        totalPengeluaran: "0.00",
        labaKotor: "0.00",
        kasAwal: "100.00",
        kasDiharapkan: "100.00",
        qrisSistem: "0.00",
        statusPenutupan: "otomatis_belum_diverifikasi",
      },
      {
        tanggal: "2026-11-10",
        totalPenjualan: "0.00",
        totalPengeluaran: "0.00",
        labaKotor: "0.00",
        kasAwal: "100.00",
        kasFisik: "150.00",
        qrisTerhitung: "20.00",
        kasDiharapkan: "130.00",
        qrisSistem: "10.00",
        selisihKas: "20.00",
        selisihQris: "10.00",
        statusPenutupan: "manual",
      },
    ]);
    await db.insert(hutang).values({
      transaksiId: hutangLama.id,
      namaPelanggan: "Sari",
      jumlah: "90.00",
      tanggalHutang: new Date("2026-10-13T02:00:00Z"),
    });

    const summary = await getDashboardSummaryCore(db, now);

    expect(summary.omzetHariIni).toBe(140);
    expect(summary.labaDiakuiHariIni).toBe(85);
    expect(summary.omzetMingguIni).toBe(190);
    expect(summary.labaDiakuiMingguIni).toBe(115);
    expect(summary.stokMenipis).toHaveLength(1);
    expect(summary.menuTerlaris).toEqual([{ nama: "Kopi Susu", qty: 2 }]);
    expect(summary.perhatian.pengajuanVoid).toEqual({ jumlah: 1, umurTertuaMenit: 120 });
    expect(summary.perhatian.konfirmasiHarga).toEqual({ jumlah: 1, umurTertuaMenit: 1920 });
    expect(summary.perhatian.tutupOtomatis).toEqual(["2026-11-11"]);
    expect(summary.perhatian.selisihKasir).toMatchObject([
      { tanggal: "2026-11-10", selisihKas: 20, selisihQris: 10 },
    ]);
    expect(summary.perhatian.hutangLama).toMatchObject({
      jumlah: 1,
      daftar: [{ namaPelanggan: "Sari", sisa: 90, umurHari: 30 }],
    });
  });

  it("membaca aktivitas dari kolom pelaku transaksi tanpa tabel log terpisah", async () => {
    const waktu = new Date("2026-11-12T09:00:00Z");
    const [owner] = await db.insert(user).values({
      id: "owner-m12-activity",
      name: "Owner",
      email: "owner-m12-activity@test.local",
      role: "owner",
    }).returning();
    await db.insert(transaksi).values({
      tanggal: waktu,
      createdAt: waktu,
      totalPemasukan: "75.00",
      metodeBayar: "tunai",
      pelakuId: owner.id,
    });
    await db.insert(transaksi).values({
      tanggal: new Date("2026-11-11T09:00:00Z"),
      createdAt: new Date("2026-11-11T09:00:00Z"),
      totalPemasukan: "50.00",
      status: "void",
      voidedAt: new Date("2026-11-12T10:00:00Z"),
      voidedBy: owner.id,
      voidReason: "Salah transaksi",
      metodeBayar: "tunai",
      pelakuId: owner.id,
    });

    const aktivitas = await listAktivitasCore(db);

    expect(aktivitas).toHaveLength(3);
    expect(aktivitas.map((row) => row.aksi)).toEqual([
      "Transaksi di-void",
      "Transaksi dicatat",
      "Transaksi dicatat",
    ]);
    expect(aktivitas[0]).toMatchObject({
      pelakuNama: "Owner",
      detail: "Salah transaksi",
    });
    expect(aktivitas[1].waktu).toEqual(waktu);
  });
});
