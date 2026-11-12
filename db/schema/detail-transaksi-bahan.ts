import { numeric, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { bahanBaku } from "./bahan-baku";
import { detailTransaksi } from "./detail-transaksi";

export const detailTransaksiBahan = pgTable(
  "detail_transaksi_bahan",
  {
    detailTransaksiId: uuid("detail_transaksi_id")
      .notNull()
      .references(() => detailTransaksi.id, { onDelete: "cascade" }),
    bahanBakuId: uuid("bahan_baku_id")
      .notNull()
      .references(() => bahanBaku.id, { onDelete: "restrict" }),
    qtyDipakai: numeric("qty_dipakai", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.detailTransaksiId, table.bahanBakuId] })]
);
