import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { bahanBaku, hutang, hutangPembayaran, pengaturan, stockMasuk, transaksi, tutupKasir } from "@/db/schema";
import {
  buatJadwalTutupBerikutnya,
  DEFAULT_JAM_TUTUP_KASIR,
  getJamTutupUntukTanggal,
  hitungRekonsiliasiKas,
  isWaktuTutupTiba,
  parseJadwalTutupKasir,
  apakahSetelahTutupKasir,
  KUNCI_JADWAL_TUTUP_KASIR,
} from "@/lib/tutup-kasir-core";
import { tutupKasirOtomatisJikaTiba } from "@/lib/queries/tutup-kasir";
import { kosongkanDatabase } from "./helpers/db";

describe("M9 tutup kasir: hitung kas dan jadwal WIB", () => {
  it("menghitung kas yang diharapkan dan selisih QRIS bruto dalam satuan sen", () => {
    expect(
      hitungRekonsiliasiKas({
        kasAwal: "100000.00",
        penjualanTunai: "250000.00",
        pembayaranHutangTunai: "15000.00",
        pembelianKasLaci: "30000.00",
        kasFisik: "337000.00",
        qrisTerhitung: "249000.00",
        penjualanQris: "200000.00",
        pembayaranHutangQris: "50000.00",
      }),
    ).toEqual({
      kasDiharapkan: "335000.00",
      qrisSistem: "250000.00",
      selisihKas: "2000.00",
      selisihQris: "-1000.00",
    });
  });

  it("menerapkan jam penutupan baru mulai tanggal berikutnya", () => {
    const jadwalLama = parseJadwalTutupKasir(null);
    const jadwalBaru = buatJadwalTutupBerikutnya(jadwalLama, "22:30", "2026-12-31");

    expect(DEFAULT_JAM_TUTUP_KASIR).toBe("23:59");
    expect(getJamTutupUntukTanggal(jadwalBaru, "2026-12-31")).toBe("23:59");
    expect(getJamTutupUntukTanggal(jadwalBaru, "2027-01-01")).toBe("22:30");
  });

  it("menentukan waktu jatuh tempo berdasarkan WIB dan menolak pengaturan rusak", () => {
    expect(isWaktuTutupTiba(new Date("2026-11-12T16:58:00.000Z"), "23:59")).toBe(false);
    expect(isWaktuTutupTiba(new Date("2026-11-12T16:59:00.000Z"), "23:59")).toBe(true);
    expect(() => parseJadwalTutupKasir("{rusak")).toThrow("tidak valid");
  });
});

describe("M9 tutup kasir: penutupan otomatis dan penanda setelah tutup", () => {
  beforeEach(async () => {
    await kosongkanDatabase();
  });

  it("menutup otomatis pada jam aktif dengan saldo sistem tanpa angka selisih", async () => {
    const now = new Date("2026-11-12T16:59:00.000Z");
    const [, , hutangTrx] = await db
      .insert(transaksi)
      .values([
        { tanggal: now, totalPemasukan: "10000.00", metodeBayar: "tunai" },
        { tanggal: now, totalPemasukan: "20000.00", metodeBayar: "qris" },
        { tanggal: now, totalPemasukan: "30000.00", metodeBayar: "hutang" },
        { tanggal: now, totalPemasukan: "5000.00", metodeBayar: "tunai", status: "void" },
      ])
      .returning();
    const [utang] = await db
      .insert(hutang)
      .values({ transaksiId: hutangTrx.id, namaPelanggan: "Pelanggan Uji", jumlah: "30000.00" })
      .returning();
    await db.insert(hutangPembayaran).values([
      { hutangId: utang.id, jumlah: "2000.00", metode: "tunai", dibayarAt: now },
      { hutangId: utang.id, jumlah: "3000.00", metode: "qris", dibayarAt: now },
      {
        hutangId: utang.id,
        jumlah: "7000.00",
        metode: "tunai",
        dibayarAt: now,
        dibatalkanAt: now,
        alasanBatal: "Pembayaran uji dibatalkan",
      },
    ]);

    const [bahan] = await db
      .insert(bahanBaku)
      .values({ nama: "Bahan Uji", satuan: "gram" })
      .returning();
    await db.insert(stockMasuk).values([
      {
        bahanBakuId: bahan.id,
        qty: "10.00",
        hargaBeli: "150.00",
        totalPengeluaran: "1500.00",
        dibayarDari: "kas_laci",
        tanggal: now,
      },
      {
        bahanBakuId: bahan.id,
        qty: "10.00",
        hargaBeli: "500.00",
        totalPengeluaran: "5000.00",
        dibayarDari: "di_luar_laci",
        tanggal: now,
      },
      {
        bahanBakuId: bahan.id,
        qty: "10.00",
        hargaBeli: "400.00",
        totalPengeluaran: "4000.00",
        dibayarDari: "kas_laci",
        tanggal: now,
        dibatalkanAt: now,
        alasanBatal: "Stock Masuk uji dibatalkan",
      },
    ]);

    expect(await tutupKasirOtomatisJikaTiba(new Date("2026-11-12T16:58:00.000Z"))).toEqual({
      status: "belum_waktunya",
    });
    expect(await tutupKasirOtomatisJikaTiba(now)).toEqual({ status: "ditutup" });
    expect(await tutupKasirOtomatisJikaTiba(now)).toEqual({ status: "sudah_tutup" });

    const [row] = await db
      .select()
      .from(tutupKasir)
      .where(eq(tutupKasir.tanggal, "2026-11-12"));
    expect(row).toMatchObject({
      statusPenutupan: "otomatis_belum_diverifikasi",
      kasAwal: "0.00",
      kasDiharapkan: "10500.00",
      qrisSistem: "23000.00",
      kasFisik: null,
      qrisTerhitung: null,
      selisihKas: null,
      selisihQris: null,
    });
  });

  it("mendeteksi transaksi baru setelah tanggal tersebut ditutup", async () => {
    const now = new Date("2026-11-12T16:10:00.000Z");
    expect(await db.transaction((tx) => apakahSetelahTutupKasir(tx, now))).toBe(false);
    await db.insert(tutupKasir).values({
      tanggal: "2026-11-12",
      totalPenjualan: "0.00",
      totalPengeluaran: "0.00",
      labaKotor: "0.00",
    });

    const result = await db.transaction((tx) => apakahSetelahTutupKasir(tx, now));
    expect(result).toBe(true);
  });

  it("meneruskan kas pascatutup ke kas awal hari berikutnya", async () => {
    const waktuTutup = new Date("2026-11-11T15:00:00.000Z");
    const waktuPascatutup = new Date("2026-11-11T15:30:00.000Z");
    await db.insert(tutupKasir).values({
      tanggal: "2026-11-11",
      totalPenjualan: "0.00",
      totalPengeluaran: "0.00",
      labaKotor: "0.00",
      createdAt: waktuTutup,
      kasAwal: "80000.00",
      kasFisik: "100000.00",
      qrisTerhitung: "0.00",
      kasDiharapkan: "100000.00",
      qrisSistem: "0.00",
      selisihKas: "0.00",
      selisihQris: "0.00",
      statusPenutupan: "manual",
    });
    await db.insert(transaksi).values([
      {
        tanggal: new Date("2026-11-11T14:00:00.000Z"),
        totalPemasukan: "90000.00",
        metodeBayar: "tunai",
      },
      {
        tanggal: waktuPascatutup,
        totalPemasukan: "20000.00",
        metodeBayar: "tunai",
        setelahTutup: true,
      },
      {
        tanggal: waktuPascatutup,
        totalPemasukan: "30000.00",
        metodeBayar: "hutang",
        setelahTutup: true,
      },
    ]).returning();
    const [transaksiHutang] = await db
      .select()
      .from(transaksi)
      .where(eq(transaksi.metodeBayar, "hutang"));
    const [rowHutang] = await db
      .insert(hutang)
      .values({ transaksiId: transaksiHutang.id, jumlah: "30000.00" })
      .returning();
    await db.insert(hutangPembayaran).values({
      hutangId: rowHutang.id,
      jumlah: "5000.00",
      metode: "tunai",
      dibayarAt: new Date("2026-11-11T16:00:00.000Z"),
      setelahTutup: true,
    });
    const [bahan] = await db
      .insert(bahanBaku)
      .values({ nama: "Bahan Kas Laci", satuan: "gram" })
      .returning();
    await db.insert(stockMasuk).values({
      bahanBakuId: bahan.id,
      qty: "10.00",
      hargaBeli: "200.00",
      totalPengeluaran: "2000.00",
      dibayarDari: "kas_laci",
      tanggal: new Date("2026-11-11T16:45:00.000Z"),
      setelahTutup: true,
    });

    expect(await tutupKasirOtomatisJikaTiba(new Date("2026-11-12T16:59:00.000Z"))).toEqual({
      status: "ditutup",
    });
    const [hariBerikutnya] = await db
      .select()
      .from(tutupKasir)
      .where(eq(tutupKasir.tanggal, "2026-11-12"));
    expect(hariBerikutnya.kasAwal).toBe("123000.00");
    expect(hariBerikutnya.kasDiharapkan).toBe("123000.00");
  });

  it("menggunakan jam otomatis yang dijadwalkan untuk hari ini", async () => {
    await db.insert(pengaturan).values({
      kunci: KUNCI_JADWAL_TUTUP_KASIR,
      nilai: JSON.stringify({
        jamAktif: "23:59",
        berikutnya: { jam: "22:30", berlakuMulai: "2026-11-12" },
      }),
    });

    const result = await tutupKasirOtomatisJikaTiba(new Date("2026-11-12T15:30:00.000Z"));
    expect(result).toEqual({ status: "ditutup" });
  });
});
