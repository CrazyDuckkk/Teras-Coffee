import { boolean, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bahanBaku } from "./bahan-baku";
import { user } from "./auth";

export const statusHargaStockMasukEnum = pgEnum("status_harga_stock_masuk", [
  "menunggu",
  "disetujui",
  "ditolak",
]);

export const sumberBayarStockMasukEnum = pgEnum("sumber_bayar_stock_masuk", [
  "kas_laci",
  "di_luar_laci",
]);

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
    dibayarDari: sumberBayarStockMasukEnum("dibayar_dari"),
    setelahTutup: boolean("setelah_tutup").notNull().default(false),
    statusHarga: statusHargaStockMasukEnum("status_harga").notNull().default("disetujui"),
    pelakuId: text("pelaku_id").references(() => user.id, { onDelete: "set null" }),
    konfirmasiHargaAt: timestamp("konfirmasi_harga_at", { withTimezone: true }),
    konfirmasiHargaOleh: text("konfirmasi_harga_oleh").references(() => user.id, { onDelete: "set null" }),
    dibatalkanAt: timestamp("dibatalkan_at", { withTimezone: true }),
    dibatalkanOleh: text("dibatalkan_oleh").references(() => user.id, { onDelete: "set null" }),
    alasanBatal: text("alasan_batal"),
  },
  (table) => [
    index("stock_masuk_tanggal_idx").on(table.tanggal),
    index("stock_masuk_bahan_baku_idx").on(table.bahanBakuId),
    index("stock_masuk_pelaku_id_idx").on(table.pelakuId),
    index("stock_masuk_status_harga_idx").on(table.statusHarga),
    index("stock_masuk_dibatalkan_at_idx").on(table.dibatalkanAt),
  ]
).enableRLS();
