import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { detailTransaksi, hutang, menu } from "@/db/schema";
import { requireRole } from "@/lib/auth-guard";

export class HutangSudahLunasError extends Error {
  constructor() {
    super("Hutang ini sudah lunas.");
    this.name = "HutangSudahLunasError";
  }
}

export type StatusHutang = "belum_lunas" | "lunas";

export async function listHutang(status?: StatusHutang) {
  await requireRole("owner", "cashier");
  return db
    .select()
    .from(hutang)
    .where(status ? eq(hutang.status, status) : undefined)
    .orderBy(desc(hutang.tanggalHutang));
}

/** Detail hutang + item transaksi terkait (dipakai popup detail di halaman Hutang). */
export async function getHutangDetail(id: string) {
  await requireRole("owner", "cashier");
  const [row] = await db.select().from(hutang).where(eq(hutang.id, id)).limit(1);
  if (!row) return null;

  const items = await db
    .select({
      menuId: detailTransaksi.menuId,
      qty: detailTransaksi.qty,
      bawaPulang: detailTransaksi.bawaPulang,
      hargaJualSaatItu: detailTransaksi.hargaJualSaatItu,
      menuNama: menu.nama,
    })
    .from(detailTransaksi)
    .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
    .where(eq(detailTransaksi.transaksiId, row.transaksiId));

  return { ...row, items };
}

/**
 * Tandai hutang lunas — set status + tanggal_lunas. Keuangan tidak punya tabel
 * terpisah (live view dari transaksi+stock_masuk+hutang), jadi "insert entri pemasukan"
 * di sini cukup lewat update ini — getKeuangan() otomatis mengikutkan baris ini
 * (dengan tanggal_lunas sebagai tanggal pemasukan) sejak titik ini.
 */
export async function tandaiLunas(id: string) {
  await requireRole("owner", "cashier");
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(hutang).where(eq(hutang.id, id)).for("update");
    if (!row) return null;
    if (row.status === "lunas") throw new HutangSudahLunasError();

    const [updated] = await tx
      .update(hutang)
      .set({ status: "lunas", tanggalLunas: new Date() })
      .where(eq(hutang.id, id))
      .returning();
    return updated;
  });
}
