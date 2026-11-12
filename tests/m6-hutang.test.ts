import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hutang, hutangPembayaran, transaksi, user } from "@/db/schema";
import {
  HutangSudahAdaPembayaranError,
  HutangSudahLunasError,
  HutangTidakAktifError,
  PembayaranMelebihiSisaError,
  PembayaranSudahDibatalkanError,
  batalkanHutangSaatVoidTx,
  batalkanPembayaranTx,
  catatPembayaranTx,
  hitungSisa,
  pastikanHutangBisaDiajukanVoidTx,
  toSen,
} from "@/lib/hutang-core";
import { roleCanAccess } from "@/lib/roles";
import { batalPembayaranSchema, pembayaranHutangSchema } from "@/lib/validations/hutang";
import { kosongkanDatabase } from "./helpers/db";

const KASIR = "kasir-uji-1";
const OWNER = "owner-uji-1";

async function siapkanHutang(jumlah = "50000.00", statusTransaksi: "aktif" | "menunggu_void" | "void" = "aktif") {
  await db.insert(user).values([
    { id: KASIR, name: "Kasir Uji", email: "kasir@uji.test", role: "cashier" },
    { id: OWNER, name: "Owner Uji", email: "owner@uji.test", role: "owner" },
  ]);
  const [trx] = await db
    .insert(transaksi)
    .values({ totalPemasukan: jumlah, metodeBayar: "hutang", status: statusTransaksi, pelakuId: KASIR })
    .returning();
  const [h] = await db.insert(hutang).values({ transaksiId: trx.id, namaPelanggan: "Budi", jumlah }).returning();
  return { trx, h };
}

const bayar = (hutangId: string, jumlah: number, metode: "tunai" | "qris" = "tunai", now?: Date) =>
  db.transaction((tx) => catatPembayaranTx(tx, hutangId, { jumlah, metode }, KASIR, now));

const ambilHutang = async (id: string) => (await db.select().from(hutang).where(eq(hutang.id, id)))[0];

describe("M6 hutang: validasi dan peran", () => {
  it("menerima tunai dan QRIS, menolak transfer atau jumlah tidak valid", () => {
    expect(pembayaranHutangSchema.safeParse({ jumlah: 10000, metode: "tunai" }).success).toBe(true);
    expect(pembayaranHutangSchema.safeParse({ jumlah: 10000, metode: "qris" }).success).toBe(true);
    expect(pembayaranHutangSchema.safeParse({ jumlah: 10000, metode: "transfer" }).success).toBe(false);
    expect(pembayaranHutangSchema.safeParse({ jumlah: 0, metode: "tunai" }).success).toBe(false);
    expect(pembayaranHutangSchema.safeParse({ jumlah: -5, metode: "tunai" }).success).toBe(false);
    expect(pembayaranHutangSchema.safeParse({ jumlah: 100.555, metode: "tunai" }).success).toBe(false);
  });

  it("mewajibkan alasan pembatalan", () => {
    expect(batalPembayaranSchema.safeParse({ alasan: "   " }).success).toBe(false);
    expect(batalPembayaranSchema.safeParse({ alasan: "Salah input" }).success).toBe(true);
  });

  it("pembatalan pembayaran hanya untuk owner", () => {
    expect(roleCanAccess("cashier", ["owner"])).toBe(false);
    expect(roleCanAccess("owner", ["owner"])).toBe(true);
  });

  it("menghitung sisa tanpa galat desimal", () => {
    expect(toSen("0.10") + toSen("0.20")).toBe(toSen("0.30"));
    expect(hitungSisa("50000.00", "20000.00")).toBe("30000.00");
  });
});

describe("M6 hutang: pembayaran sebagian dan pelunasan", () => {
  beforeEach(async () => {
    await kosongkanDatabase();
  });

  it("pembayaran sebagian mengurangi sisa dan belum melunasi", async () => {
    const { h } = await siapkanHutang("50000.00");
    const hasil = await bayar(h.id, 20000);

    expect(hasil?.sisa).toBe("30000.00");
    expect(hasil?.lunas).toBe(false);
    const row = await ambilHutang(h.id);
    expect(row.status).toBe("belum_lunas");
    expect(row.tanggalLunas).toBeNull();
    expect(hasil?.pembayaran.pelakuId).toBe(KASIR);
  });

  it("lunas saat sisa nol, tanggal lunas = waktu pembayaran terakhir", async () => {
    const { h } = await siapkanHutang("50000.00");
    await bayar(h.id, 20000, "tunai", new Date("2026-11-10T03:00:00Z"));
    const akhir = new Date("2026-11-12T05:00:00Z");
    const hasil = await bayar(h.id, 30000, "qris", akhir);

    expect(hasil?.lunas).toBe(true);
    const row = await ambilHutang(h.id);
    expect(row.status).toBe("lunas");
    expect(row.tanggalLunas?.toISOString()).toBe(akhir.toISOString());
  });

  it("menolak pembayaran melebihi sisa dan tidak menyimpan apa pun", async () => {
    const { h } = await siapkanHutang("50000.00");
    await bayar(h.id, 20000);

    await expect(bayar(h.id, 30001)).rejects.toBeInstanceOf(PembayaranMelebihiSisaError);
    const rows = await db.select().from(hutangPembayaran).where(eq(hutangPembayaran.hutangId, h.id));
    expect(rows).toHaveLength(1);
  });

  it("menolak pembayaran pada hutang yang sudah lunas", async () => {
    const { h } = await siapkanHutang("10000.00");
    await bayar(h.id, 10000);
    await expect(bayar(h.id, 1000)).rejects.toBeInstanceOf(HutangSudahLunasError);
  });

  it("menolak pembayaran saat transaksi menunggu void atau sudah void", async () => {
    const { h } = await siapkanHutang("10000.00", "menunggu_void");
    await expect(bayar(h.id, 1000)).rejects.toBeInstanceOf(HutangTidakAktifError);
  });

  it("dua pembayaran bersamaan tidak boleh melewati sisa (hanya satu yang berhasil)", async () => {
    const { h } = await siapkanHutang("10000.00");
    const hasil = await Promise.allSettled([bayar(h.id, 10000), bayar(h.id, 10000)]);

    expect(hasil.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(hasil.filter((r) => r.status === "rejected")).toHaveLength(1);
    const rows = await db.select().from(hutangPembayaran).where(eq(hutangPembayaran.hutangId, h.id));
    expect(rows).toHaveLength(1);
  });

  it("check constraint database menolak pembayaran bernilai nol", async () => {
    const { h } = await siapkanHutang();
    await expect(
      db.insert(hutangPembayaran).values({ hutangId: h.id, jumlah: "0", metode: "tunai" }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});

describe("M6 hutang: pembatalan pembayaran oleh owner", () => {
  beforeEach(async () => {
    await kosongkanDatabase();
  });

  it("membatalkan pembayaran terakhir mengembalikan hutang ke belum lunas, jejak tetap ada", async () => {
    const { h } = await siapkanHutang("50000.00");
    await bayar(h.id, 20000);
    const lunas = await bayar(h.id, 30000);
    expect((await ambilHutang(h.id)).status).toBe("lunas");

    const hasil = await db.transaction((tx) =>
      batalkanPembayaranTx(tx, h.id, lunas!.pembayaran.id, "Salah input nominal", OWNER),
    );

    expect(hasil?.sisa).toBe("30000.00");
    const row = await ambilHutang(h.id);
    expect(row.status).toBe("belum_lunas");
    expect(row.tanggalLunas).toBeNull();

    const rows = await db.select().from(hutangPembayaran).where(eq(hutangPembayaran.hutangId, h.id));
    expect(rows).toHaveLength(2);
    const dibatalkan = rows.find((r) => r.id === lunas!.pembayaran.id)!;
    expect(dibatalkan.dibatalkanAt).not.toBeNull();
    expect(dibatalkan.dibatalkanOleh).toBe(OWNER);
    expect(dibatalkan.alasanBatal).toBe("Salah input nominal");
  });

  it("pembayaran yang sudah dibatalkan tidak bisa dibatalkan lagi, dan sisa bisa dibayar ulang", async () => {
    const { h } = await siapkanHutang("50000.00");
    const p = await bayar(h.id, 50000);
    await db.transaction((tx) => batalkanPembayaranTx(tx, h.id, p!.pembayaran.id, "Salah", OWNER));

    await expect(
      db.transaction((tx) => batalkanPembayaranTx(tx, h.id, p!.pembayaran.id, "Lagi", OWNER)),
    ).rejects.toBeInstanceOf(PembayaranSudahDibatalkanError);

    const ulang = await bayar(h.id, 50000);
    expect(ulang?.lunas).toBe(true);
  });

  it("mengembalikan null untuk pembayaran yang bukan milik hutang tersebut", async () => {
    const { h } = await siapkanHutang("50000.00");
    const hasil = await db.transaction((tx) =>
      batalkanPembayaranTx(tx, h.id, "00000000-0000-4000-8000-000000000000", "x", OWNER),
    );
    expect(hasil).toBeNull();
  });
});

describe("M6 hutang: aturan void", () => {
  beforeEach(async () => {
    await kosongkanDatabase();
  });

  it("kasir tidak bisa mengajukan void jika sudah ada pembayaran aktif", async () => {
    const { trx, h } = await siapkanHutang("50000.00");
    await expect(db.transaction((tx) => pastikanHutangBisaDiajukanVoidTx(tx, trx.id))).resolves.toBeUndefined();

    await bayar(h.id, 1000);
    await expect(db.transaction((tx) => pastikanHutangBisaDiajukanVoidTx(tx, trx.id))).rejects.toBeInstanceOf(
      HutangSudahAdaPembayaranError,
    );
  });

  it("pengajuan void kembali boleh jika semua pembayaran sudah dibatalkan owner", async () => {
    const { trx, h } = await siapkanHutang("50000.00");
    const p = await bayar(h.id, 1000);
    await db.transaction((tx) => batalkanPembayaranTx(tx, h.id, p!.pembayaran.id, "Salah", OWNER));
    await expect(db.transaction((tx) => pastikanHutangBisaDiajukanVoidTx(tx, trx.id))).resolves.toBeUndefined();
  });

  it("void owner tanpa pembayaran: baris hutang dihapus seperti sebelumnya", async () => {
    const { trx, h } = await siapkanHutang("50000.00");
    const hasil = await db.transaction((tx) => batalkanHutangSaatVoidTx(tx, trx.id, OWNER));

    expect(hasil.pembayaranDibatalkan).toBe(0);
    expect(await ambilHutang(h.id)).toBeUndefined();
  });

  it("void owner dengan pembayaran: pembayaran dibatalkan otomatis, jejak dan arsip hutang tetap ada", async () => {
    const { trx, h } = await siapkanHutang("50000.00");
    await bayar(h.id, 20000);
    await bayar(h.id, 30000);
    expect((await ambilHutang(h.id)).status).toBe("lunas");

    const hasil = await db.transaction((tx) => batalkanHutangSaatVoidTx(tx, trx.id, OWNER));

    expect(hasil.pembayaranDibatalkan).toBe(2);
    const row = await ambilHutang(h.id);
    expect(row.status).toBe("belum_lunas");
    expect(row.tanggalLunas).toBeNull();
    const rows = await db.select().from(hutangPembayaran).where(eq(hutangPembayaran.hutangId, h.id));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.dibatalkanAt !== null && r.dibatalkanOleh === OWNER)).toBe(true);
  });
});
