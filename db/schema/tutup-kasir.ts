import { date, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { menu } from "./menu";

export const tutupKasir = pgTable("tutup_kasir", {
  id: uuid("id").primaryKey().defaultRandom(),
  tanggal: date("tanggal").notNull().unique(),
  totalPenjualan: numeric("total_penjualan", { precision: 12, scale: 2 }).notNull(),
  totalPengeluaran: numeric("total_pengeluaran", { precision: 12, scale: 2 }).notNull(),
  labaKotor: numeric("laba_kotor", { precision: 12, scale: 2 }).notNull(),
  menuTerlarisId: uuid("menu_terlaris_id").references(() => menu.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
