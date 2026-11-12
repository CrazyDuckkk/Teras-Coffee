import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { transaksi } from "./transaksi";
import { user } from "./auth";

export const statusPengajuanVoidEnum = pgEnum("status_pengajuan_void", [
  "menunggu",
  "disetujui",
  "ditolak",
]);

export const pengajuanVoid = pgTable(
  "pengajuan_void",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transaksiId: uuid("transaksi_id")
      .notNull()
      .references(() => transaksi.id, { onDelete: "restrict" }),
    alasan: text("alasan").notNull(),
    diajukanOleh: text("diajukan_oleh").references(() => user.id, { onDelete: "set null" }),
    diajukanAt: timestamp("diajukan_at", { withTimezone: true }).notNull().defaultNow(),
    status: statusPengajuanVoidEnum("status").notNull().default("menunggu"),
    diputuskanOleh: text("diputuskan_oleh").references(() => user.id, { onDelete: "set null" }),
    diputuskanAt: timestamp("diputuskan_at", { withTimezone: true }),
  },
  (table) => [
    index("pengajuan_void_status_idx").on(table.status),
    index("pengajuan_void_transaksi_id_idx").on(table.transaksiId),
    uniqueIndex("pengajuan_void_satu_menunggu_per_transaksi_idx")
      .on(table.transaksiId)
      .where(sql`${table.status} = 'menunggu'`),
  ]
).enableRLS();
