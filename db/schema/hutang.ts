import { index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { transaksi } from "./transaksi";

export const statusHutangEnum = pgEnum("status_hutang", ["belum_lunas", "lunas"]);

export const hutang = pgTable(
  "hutang",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // restrict (bukan cascade) — void transaksi ber-hutang menghapus baris hutang secara
    // eksplisit lewat query (lihat voidTransaksi di lib/queries/transaksi.ts), bukan lewat FK cascade.
    transaksiId: uuid("transaksi_id")
      .notNull()
      .references(() => transaksi.id, { onDelete: "restrict" }),
    namaPelanggan: text("nama_pelanggan"),
    jumlah: numeric("jumlah", { precision: 12, scale: 2 }).notNull(),
    tanggalHutang: timestamp("tanggal_hutang", { withTimezone: true }).notNull().defaultNow(),
    status: statusHutangEnum("status").notNull().default("belum_lunas"),
    // Diisi saat ditandai lunas — tanggal ini (bukan tanggal_hutang) yang dipakai sebagai
    // tanggal pemasukan di modul Keuangan.
    tanggalLunas: timestamp("tanggal_lunas", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("hutang_transaksi_id_idx").on(table.transaksiId),
    index("hutang_status_idx").on(table.status),
  ]
);
