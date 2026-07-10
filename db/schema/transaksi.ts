import { index, numeric, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const statusTransaksiEnum = pgEnum("status_transaksi", ["aktif", "void"]);

export const transaksi = pgTable(
  "transaksi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tanggal: timestamp("tanggal", { withTimezone: true }).notNull().defaultNow(),
    totalPemasukan: numeric("total_pemasukan", { precision: 12, scale: 2 }).notNull(),
    status: statusTransaksiEnum("status").notNull().default("aktif"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transaksi_tanggal_idx").on(table.tanggal), index("transaksi_status_idx").on(table.status)]
);
