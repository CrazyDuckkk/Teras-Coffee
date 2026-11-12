import { desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, menu, resepMenu, riwayatHargaBahan } from "@/db/schema";
import type { MenuInput } from "@/lib/validations/menu";
import { requireRole } from "@/lib/auth-guard";
import { calculateRecipeHpp } from "@/lib/transaction-recipes";

export interface MenuWithHpp {
  id: string;
  nama: string;
  kategori: string;
  hargaJual: string;
  isActive: boolean;
  hppMakanDiTempat: number;
  hppBawaPulang: number;
  untungMakanDiTempat: number;
  untungBawaPulang: number;
  jumlahBahan: number;
}

function hargaAktifSubquery() {
  return db
    .selectDistinctOn([riwayatHargaBahan.bahanBakuId], {
      bahanBakuId: riwayatHargaBahan.bahanBakuId,
      hargaPerSatuan: riwayatHargaBahan.hargaPerSatuan,
    })
    .from(riwayatHargaBahan)
    .where(isNull(riwayatHargaBahan.dibatalkanAt))
    .orderBy(riwayatHargaBahan.bahanBakuId, desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .as("harga_aktif");
}

/** HPP dihitung live dari SUM(takaran x harga_per_satuan terbaru) per bahan di resep — bukan dari snapshot transaksi. */
export async function listMenu(includeInactive = false): Promise<MenuWithHpp[]> {
  await requireRole("owner");
  const menus = await db
    .select()
    .from(menu)
    .where(includeInactive ? undefined : eq(menu.isActive, true))
    .orderBy(menu.kategori, menu.nama);

  if (menus.length === 0) return [];

  const hargaAktif = hargaAktifSubquery();
  const resepRows = await db
    .select({
      menuId: resepMenu.menuId,
      bahanBakuId: resepMenu.bahanBakuId,
      takaran: resepMenu.takaran,
      hanyaBawaPulang: resepMenu.hanyaBawaPulang,
      hargaPerSatuan: hargaAktif.hargaPerSatuan,
    })
    .from(resepMenu)
    .leftJoin(hargaAktif, eq(hargaAktif.bahanBakuId, resepMenu.bahanBakuId))
    .where(
      inArray(
        resepMenu.menuId,
        menus.map((m) => m.id)
      )
    );

  const countMap = new Map<string, number>();
  const prices = new Map(resepRows.map((recipe) => [recipe.bahanBakuId, recipe.hargaPerSatuan ?? 0]));
  for (const r of resepRows) {
    countMap.set(r.menuId, (countMap.get(r.menuId) ?? 0) + 1);
  }

  return menus.map((m) => {
    const hppMakanDiTempat = calculateRecipeHpp(m.id, resepRows, prices, false);
    const hppBawaPulang = calculateRecipeHpp(m.id, resepRows, prices, true);
    return {
      ...m,
      hppMakanDiTempat,
      hppBawaPulang,
      untungMakanDiTempat: Number(m.hargaJual) - hppMakanDiTempat,
      untungBawaPulang: Number(m.hargaJual) - hppBawaPulang,
      jumlahBahan: countMap.get(m.id) ?? 0,
    };
  });
}

/** Detail menu + resep, tiap baris resep disertai harga per satuan aktif untuk breakdown kontribusi HPP di popup. */
export async function getMenuWithResep(id: string) {
  await requireRole("owner");
  const [row] = await db.select().from(menu).where(eq(menu.id, id)).limit(1);
  if (!row) return null;

  const hargaAktif = hargaAktifSubquery();
  const resep = await db
    .select({
      id: resepMenu.id,
      bahanBakuId: resepMenu.bahanBakuId,
      takaran: resepMenu.takaran,
      hanyaBawaPulang: resepMenu.hanyaBawaPulang,
      bahanNama: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      hargaPerSatuan: hargaAktif.hargaPerSatuan,
    })
    .from(resepMenu)
    .innerJoin(bahanBaku, eq(bahanBaku.id, resepMenu.bahanBakuId))
    .leftJoin(hargaAktif, eq(hargaAktif.bahanBakuId, resepMenu.bahanBakuId))
    .where(eq(resepMenu.menuId, id));

  return { ...row, resep };
}

export async function createMenu(input: MenuInput) {
  await requireRole("owner");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(menu)
      .values({
        nama: input.nama,
        kategori: input.kategori,
        hargaJual: String(input.hargaJual),
      })
      .returning();

    await tx.insert(resepMenu).values(
      input.resep.map((r) => ({
        menuId: row.id,
        bahanBakuId: r.bahanBakuId,
        takaran: String(r.takaran),
        hanyaBawaPulang: r.hanyaBawaPulang,
      }))
    );

    return row;
  });
}

export async function updateMenu(id: string, input: MenuInput) {
  await requireRole("owner");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(menu)
      .set({
        nama: input.nama,
        kategori: input.kategori,
        hargaJual: String(input.hargaJual),
        updatedAt: new Date(),
      })
      .where(eq(menu.id, id))
      .returning();

    if (!row) return null;

    await tx.delete(resepMenu).where(eq(resepMenu.menuId, id));
    await tx.insert(resepMenu).values(
      input.resep.map((r) => ({
        menuId: id,
        bahanBakuId: r.bahanBakuId,
        takaran: String(r.takaran),
        hanyaBawaPulang: r.hanyaBawaPulang,
      }))
    );

    return row;
  });
}

export async function deactivateMenu(id: string) {
  await requireRole("owner");
  const [row] = await db
    .update(menu)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(menu.id, id))
    .returning();
  return row ?? null;
}

/** Mengaktifkan kembali menu yang sebelumnya dinonaktifkan. */
export async function reactivateMenu(id: string) {
  await requireRole("owner");
  const [row] = await db
    .update(menu)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(menu.id, id))
    .returning();
  return row ?? null;
}
