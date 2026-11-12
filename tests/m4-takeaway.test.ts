import { describe, expect, it } from "vitest";
import {
  aggregateConsumptionSnapshots,
  calculateRecipeHpp,
  getRecipeConsumptionSnapshots,
  getRequiredIngredients,
} from "@/lib/transaction-recipes";
import { menuInputSchema } from "@/lib/validations/menu";
import { transaksiCreateSchema } from "@/lib/validations/transaksi";

const menuId = "10000000-0000-4000-8000-000000000001";
const secondMenuId = "10000000-0000-4000-8000-000000000002";
const bahanKopi = "20000000-0000-4000-8000-000000000001";
const bahanKemasan = "20000000-0000-4000-8000-000000000002";

const recipes = [
  { menuId, bahanBakuId: bahanKopi, takaran: "18", hanyaBawaPulang: false },
  { menuId, bahanBakuId: bahanKemasan, takaran: "1", hanyaBawaPulang: true },
  { menuId: secondMenuId, bahanBakuId: bahanKopi, takaran: "12", hanyaBawaPulang: false },
  { menuId: secondMenuId, bahanBakuId: bahanKemasan, takaran: "2", hanyaBawaPulang: true },
];

describe("M4 bawa pulang dan kemasan", () => {
  it("menghitung satu item makan di tempat tanpa bahan khusus bawa pulang", () => {
    const item = { menuId, qty: 1, bawaPulang: false };
    const prices = new Map([
      [bahanKopi, 100],
      [bahanKemasan, 500],
    ]);

    expect(getRequiredIngredients([item], recipes)).toEqual([{ bahanBakuId: bahanKopi, qtyDipakai: 18 }]);
    expect(calculateRecipeHpp(menuId, recipes, prices, false)).toBe(1800);
    expect(calculateRecipeHpp(menuId, recipes, prices, true)).toBe(2300);
  });

  it("mengagregasi campuran item makan di tempat dan bawa pulang", () => {
    const required = getRequiredIngredients(
      [
        { menuId, qty: 2, bawaPulang: false },
        { menuId: secondMenuId, qty: 3, bawaPulang: true },
      ],
      recipes
    );

    expect(required).toEqual([
      { bahanBakuId: bahanKopi, qtyDipakai: 72 },
      { bahanBakuId: bahanKemasan, qtyDipakai: 6 },
    ]);
  });

  it("mengembalikan stok dari snapshot pemakaian meskipun resep berubah setelah transaksi", () => {
    const snapshots = getRecipeConsumptionSnapshots({ menuId, qty: 3, bawaPulang: true }, recipes);
    const currentRecipes = [
      { menuId, bahanBakuId: bahanKopi, takaran: "30", hanyaBawaPulang: false },
      { menuId, bahanBakuId: bahanKemasan, takaran: "4", hanyaBawaPulang: true },
    ];
    const voidRestoration = aggregateConsumptionSnapshots(
      snapshots.map((snapshot) => ({ ...snapshot, qtyDipakai: snapshot.qtyDipakai.toFixed(2) }))
    );

    expect(voidRestoration).toEqual([
      { bahanBakuId: bahanKopi, qtyDipakai: 54 },
      { bahanBakuId: bahanKemasan, qtyDipakai: 3 },
    ]);
    expect(getRequiredIngredients([{ menuId, qty: 3, bawaPulang: true }], currentRecipes)).not.toEqual(voidRestoration);
  });

  it("menerima dan menyimpan pilihan bawa pulang, dengan default makan di tempat", () => {
    const input = {
      items: [{ menuId, qty: 1 }],
      metodeBayar: "tunai",
    };
    const parsed = transaksiCreateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.items[0].bawaPulang).toBe(false);

    const menuInput = menuInputSchema.safeParse({
      nama: "Kopi Susu",
      kategori: "kopi",
      hargaJual: 20000,
      resep: [{ bahanBakuId: bahanKemasan, takaran: 1 }],
    });
    expect(menuInput.success).toBe(true);
    if (menuInput.success) expect(menuInput.data.resep[0].hanyaBawaPulang).toBe(false);
  });
});
