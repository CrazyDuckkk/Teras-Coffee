import { describe, expect, it } from "vitest";
import { getNavItemsForRole } from "@/components/layout/nav-items";
import { roleCanAccess } from "@/lib/roles";
import { cashierCreateSchema } from "@/lib/validations/kasir";

describe("otorisasi M1", () => {
  it("membatasi menu kasir tepat ke empat modul operasional", () => {
    expect(getNavItemsForRole("cashier").map((item) => item.label)).toEqual([
      "Transaksi",
      "Hutang",
      "Stok Bahan",
      "Tutup Kasir",
    ]);
  });

  it("memberikan navigasi owner tanpa membagikan menu owner kepada kasir", () => {
    const ownerNav = getNavItemsForRole("owner").map((item) => item.label);
    const cashierNav = getNavItemsForRole("cashier").map((item) => item.label);

    expect(ownerNav).toContain("Dashboard");
    expect(ownerNav).toContain("Keuangan");
    expect(ownerNav).toContain("Pengaturan");
    expect(cashierNav).not.toContain("Dashboard");
    expect(cashierNav).not.toContain("Keuangan");
    expect(cashierNav).not.toContain("Pengaturan");
  });

  it("menolak akses cashier ke peran owner-only", () => {
    expect(roleCanAccess("cashier", ["owner"])).toBe(false);
    expect(roleCanAccess("owner", ["owner"])).toBe(true);
    expect(roleCanAccess("cashier", ["owner", "cashier"])).toBe(true);
  });

  it("menormalisasi email dan tidak menerima role dari input pembuatan kasir", () => {
    const parsed = cashierCreateSchema.parse({
      name: "Kasir",
      email: "  KASIR@TERAS.COFFEE ",
      password: "password-awal-aman",
      role: "owner",
      isActive: true,
    });

    expect(parsed.email).toBe("kasir@teras.coffee");
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("isActive");
  });

  it("menolak password kasir yang terlalu pendek", () => {
    expect(
      cashierCreateSchema.safeParse({
        name: "Kasir",
        email: "kasir@teras.coffee",
        password: "pendek",
      }).success,
    ).toBe(false);
  });
});
