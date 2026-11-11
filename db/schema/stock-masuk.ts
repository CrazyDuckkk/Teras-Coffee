import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bahanBaku } from "./bahan-baku";
import { user } from "./auth";

export const stockMasuk = pgTable(
  "stock_masuk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tanggal: timestamp("tanggal", { withTimezone: true }).notNull().defaultNow(),
    bahanBakuId: uuid("bahan_baku_id")
      .notNull()
      .references(() => bahanBaku.id, { onDelete: "restrict" }),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull(),
    hargaBeli: numeric("harga_beli", { precision: 12, scale: 2 }).notNull(),
    totalPengeluaran: numeric("total_pengeluaran", { precision: 12, scale: 2 }).notNull(),
    pelakuId: text("pelaku_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("stock_masuk_tanggal_idx").on(table.tanggal),
    index("stock_masuk_bahan_baku_idx").on(table.bahanBakuId),
    index("stock_masuk_pelaku_id_idx").on(table.pelakuId),
  ]
);
