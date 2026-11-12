import { describe, expect, it } from "vitest";
import { keputusanVoidSchema, voidReasonSchema } from "@/lib/validations/transaksi";

describe("alur void M5", () => {
  it("mewajibkan alasan void dan membatasi panjangnya", () => {
    expect(voidReasonSchema.safeParse({ alasan: "   " }).success).toBe(false);
    expect(voidReasonSchema.safeParse({ alasan: "x".repeat(501) }).success).toBe(false);

    const parsed = voidReasonSchema.safeParse({ alasan: "  Pesanan salah  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.alasan).toBe("Pesanan salah");
  });

  it("hanya menerima keputusan persetujuan atau penolakan yang dikenal", () => {
    expect(keputusanVoidSchema.safeParse({ keputusan: "setujui" }).success).toBe(true);
    expect(keputusanVoidSchema.safeParse({ keputusan: "tolak" }).success).toBe(true);
    expect(keputusanVoidSchema.safeParse({ keputusan: "hapus" }).success).toBe(false);
  });
});
