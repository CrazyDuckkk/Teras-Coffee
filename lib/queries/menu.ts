import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bahanBaku, menu, resepMenu, riwayatHargaBahan } from "@/db/schema";
import type { MenuInput } from "@/lib/validations/menu";

export interface MenuWithHpp {
  id: string;
  nama: string;
  kategori: string;
  hargaJual: string;
  isActive: boolean;
  hpp: number;
  untung: number;
  jumlahBahan: number;
}

function hargaAktifSubquery() {
  return db
    .selectDistinctOn([riwayatHargaBahan.bahanBakuId], {
      bahanBakuId: riwayatHargaBahan.bahanBakuId,
      hargaPerSatuan: riwayatHargaBahan.hargaPerSatuan,
    })
    .from(riwayatHargaBahan)
    .orderBy(riwayatHargaBahan.bahanBakuId, desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .as("harga_aktif");
}

/** HPP dihitung live dari SUM(takaran x harga_per_satuan terbaru) per bahan di resep — bukan dari snapshot transaksi. */
export async function listMenu(includeInactive = false): Promise<MenuWithHpp[]> {
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
      takaran: resepMenu.takaran,
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

  const hppMap = new Map<string, number>();
  const countMap = new Map<string, number>();
  for (const r of resepRows) {
    const cost = Number(r.takaran) * Number(r.hargaPerSatuan ?? 0);
    hppMap.set(r.menuId, (hppMap.get(r.menuId) ?? 0) + cost);
    countMap.set(r.menuId, (countMap.get(r.menuId) ?? 0) + 1);
  }

  return menus.map((m) => {
    const hpp = hppMap.get(m.id) ?? 0;
    return {
      ...m,
      hpp,
      untung: Number(m.hargaJual) - hpp,
      jumlahBahan: countMap.get(m.id) ?? 0,
    };
  });
}

export async function getMenuWithResep(id: string) {
  const [row] = await db.select().from(menu).where(eq(menu.id, id)).limit(1);
  if (!row) return null;

  const resep = await db
    .select({
      id: resepMenu.id,
      bahanBakuId: resepMenu.bahanBakuId,
      takaran: resepMenu.takaran,
      bahanNama: bahanBaku.nama,
      satuan: bahanBaku.satuan,
    })
    .from(resepMenu)
    .innerJoin(bahanBaku, eq(bahanBaku.id, resepMenu.bahanBakuId))
    .where(eq(resepMenu.menuId, id));

  return { ...row, resep };
}

export async function createMenu(input: MenuInput) {
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
      }))
    );

    return row;
  });
}

export async function updateMenu(id: string, input: MenuInput) {
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
      }))
    );

    return row;
  });
}

export async function deactivateMenu(id: string) {
  const [row] = await db
    .update(menu)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(menu.id, id))
    .returning();
  return row ?? null;
}
