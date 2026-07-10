import { boolean, check, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const satuanEnum = pgEnum("satuan", ["gram", "ml", "pcs"]);

export const bahanBaku = pgTable(
  "bahan_baku",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nama: text("nama").notNull(),
    satuan: satuanEnum("satuan").notNull(),
    stokSaatIni: numeric("stok_saat_ini", { precision: 12, scale: 2 }).notNull().default("0"),
    batasMinimumStok: numeric("batas_minimum_stok", { precision: 12, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bahan_baku_nama_lower_idx").on(sql`lower(${table.nama})`),
    check("bahan_baku_stok_non_negative", sql`${table.stokSaatIni} >= 0`),
  ]
);
