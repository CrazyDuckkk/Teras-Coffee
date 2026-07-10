import { index, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { bahanBaku } from "./bahan-baku";

export const riwayatHargaBahan = pgTable(
  "riwayat_harga_bahan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bahanBakuId: uuid("bahan_baku_id")
      .notNull()
      .references(() => bahanBaku.id, { onDelete: "restrict" }),
    hargaPerSatuan: numeric("harga_per_satuan", { precision: 12, scale: 2 }).notNull(),
    berlakuSejak: timestamp("berlaku_sejak", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("riwayat_harga_bahan_bahan_baku_berlaku_idx").on(table.bahanBakuId, table.berlakuSejak.desc())]
);
