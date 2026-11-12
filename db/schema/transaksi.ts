import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const statusTransaksiEnum = pgEnum("status_transaksi", ["aktif", "menunggu_void", "void"]);
export const metodeBayarEnum = pgEnum("metode_bayar", ["tunai", "qris", "hutang"]);

export const transaksi = pgTable(
  "transaksi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tanggal: timestamp("tanggal", { withTimezone: true }).notNull().defaultNow(),
    totalPemasukan: numeric("total_pemasukan", { precision: 12, scale: 2 }).notNull(),
    status: statusTransaksiEnum("status").notNull().default("aktif"),
    // Transaksi lama (sebelum fitur Hutang) semua tunai — default 'tunai' aman untuk retrofit.
    metodeBayar: metodeBayarEnum("metode_bayar").notNull().default("tunai"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    pelakuId: text("pelaku_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transaksi_tanggal_idx").on(table.tanggal),
    index("transaksi_status_idx").on(table.status),
    index("transaksi_pelaku_id_idx").on(table.pelakuId),
  ]
);
