import { boolean, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const menu = pgTable(
  "menu",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nama: text("nama").notNull(),
    // Disimpan trim+lowercase (mis. "kopi susu"), ditampilkan title-case di UI lewat lib/format.ts
    kategori: text("kategori").notNull(),
    hargaJual: numeric("harga_jual", { precision: 12, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("menu_kategori_idx").on(table.kategori)]
);
