import { boolean, check, index, integer, numeric, pgTable, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { transaksi } from "./transaksi";
import { menu } from "./menu";

export const detailTransaksi = pgTable(
  "detail_transaksi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transaksiId: uuid("transaksi_id")
      .notNull()
      .references(() => transaksi.id, { onDelete: "cascade" }),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menu.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull(),
    // Snapshot — JANGAN dihitung ulang dari tabel menu/riwayat_harga_bahan saat menampilkan riwayat transaksi lama
    hargaJualSaatItu: numeric("harga_jual_saat_itu", { precision: 12, scale: 2 }).notNull(),
    hppSaatItu: numeric("hpp_saat_itu", { precision: 12, scale: 2 }).notNull(),
    bawaPulang: boolean("bawa_pulang").notNull().default(false),
  },
  (table) => [
    index("detail_transaksi_transaksi_idx").on(table.transaksiId),
    index("detail_transaksi_menu_idx").on(table.menuId),
    check("detail_transaksi_qty_positive", sql`${table.qty} > 0`),
  ]
);
