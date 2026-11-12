import { boolean, check, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { hutang } from "./hutang";
import { user } from "./auth";

// Tidak ada "transfer": spesifikasi v2 hanya mengenal tunai dan QRIS.
export const metodePembayaranHutangEnum = pgEnum("metode_pembayaran_hutang", ["tunai", "qris"]);

/**
 * Satu baris = satu kali pembayaran hutang (boleh sebagian). Pembayaran tidak pernah dihapus:
 * pembatalan oleh owner hanya mengisi kolom dibatalkan_* supaya jejaknya tetap ada.
 * Pembayaran aktif = dibatalkan_at IS NULL.
 */
export const hutangPembayaran = pgTable(
  "hutang_pembayaran",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hutangId: uuid("hutang_id")
      .notNull()
      .references(() => hutang.id, { onDelete: "restrict" }),
    jumlah: numeric("jumlah", { precision: 12, scale: 2 }).notNull(),
    metode: metodePembayaranHutangEnum("metode").notNull(),
    setelahTutup: boolean("setelah_tutup").notNull().default(false),
    dibayarAt: timestamp("dibayar_at", { withTimezone: true }).notNull().defaultNow(),
    // Nullable: pembayaran hasil backfill data lama tidak punya pelaku.
    pelakuId: text("pelaku_id").references(() => user.id, { onDelete: "set null" }),
    dibatalkanAt: timestamp("dibatalkan_at", { withTimezone: true }),
    dibatalkanOleh: text("dibatalkan_oleh").references(() => user.id, { onDelete: "set null" }),
    alasanBatal: text("alasan_batal"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("hutang_pembayaran_hutang_id_idx").on(table.hutangId),
    index("hutang_pembayaran_dibayar_at_idx").on(table.dibayarAt),
    check("hutang_pembayaran_jumlah_positif", sql`${table.jumlah} > 0`),
    check(
      "hutang_pembayaran_batal_lengkap",
      sql`(${table.dibatalkanAt} IS NULL) = (${table.alasanBatal} IS NULL)`,
    ),
  ],
).enableRLS();
