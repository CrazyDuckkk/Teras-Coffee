import { describe, expect, it } from "vitest";
import { transaksiCreateSchema } from "@/lib/validations/transaksi";

const validItem = { menuId: "10000000-0000-4000-8000-000000000001", qty: 1 };

describe("validasi transaksi M3", () => {
  it.each(["tunai", "qris"] as const)("menerima pembayaran %s tanpa nama pelanggan", (metodeBayar) => {
    expect(transaksiCreateSchema.safeParse({ items: [validItem], metodeBayar }).success).toBe(true);
  });

  it("mewajibkan nama pelanggan untuk transaksi hutang", () => {
    expect(transaksiCreateSchema.safeParse({ items: [validItem], metodeBayar: "hutang" }).success).toBe(false);
    expect(
      transaksiCreateSchema.safeParse({
        items: [validItem],
        metodeBayar: "hutang",
        namaPelanggan: "   ",
      }).success,
    ).toBe(false);
  });

  it("memangkas spasi nama pelanggan transaksi hutang", () => {
    const result = transaksiCreateSchema.safeParse({
      items: [validItem],
      metodeBayar: "hutang",
      namaPelanggan: "  Budi  ",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.namaPelanggan).toBe("Budi");
  });

  it("menolak metode transfer yang tidak termasuk spesifikasi", () => {
    expect(
      transaksiCreateSchema.safeParse({
        items: [validItem],
        metodeBayar: "transfer",
      }).success,
    ).toBe(false);
  });
});
