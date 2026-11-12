import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { menu } from "./menu";
import { user } from "./auth";

export const statusPenutupanKasirEnum = pgEnum("status_penutupan_kasir", [
  "manual",
  "otomatis_belum_diverifikasi",
]);

export const tutupKasir = pgTable(
  "tutup_kasir",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tanggal: date("tanggal").notNull().unique(),
    totalPenjualan: numeric("total_penjualan", { precision: 12, scale: 2 }).notNull(),
    totalPengeluaran: numeric("total_pengeluaran", { precision: 12, scale: 2 }).notNull(),
    labaKotor: numeric("laba_kotor", { precision: 12, scale: 2 }).notNull(),
    menuTerlarisId: uuid("menu_terlaris_id").references(() => menu.id, { onDelete: "set null" }),
    pelakuId: text("pelaku_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    kasAwal: numeric("kas_awal", { precision: 12, scale: 2 }),
    kasFisik: numeric("kas_fisik", { precision: 12, scale: 2 }),
    qrisTerhitung: numeric("qris_terhitung", { precision: 12, scale: 2 }),
    kasDiharapkan: numeric("kas_diharapkan", { precision: 12, scale: 2 }),
    qrisSistem: numeric("qris_sistem", { precision: 12, scale: 2 }),
    selisihKas: numeric("selisih_kas", { precision: 12, scale: 2 }),
    selisihQris: numeric("selisih_qris", { precision: 12, scale: 2 }),
    catatan: text("catatan"),
    statusPenutupan: statusPenutupanKasirEnum("status_penutupan"),
  },
  (table) => [
    index("tutup_kasir_pelaku_id_idx").on(table.pelakuId),
    check(
      "tutup_kasir_rekonsiliasi_valid",
      sql`${table.statusPenutupan} is null
        or (${table.statusPenutupan} = 'manual'
          and ${table.kasAwal} is not null
          and ${table.kasFisik} is not null
          and ${table.qrisTerhitung} is not null
          and ${table.kasDiharapkan} is not null
          and ${table.qrisSistem} is not null
          and ${table.selisihKas} is not null
          and ${table.selisihQris} is not null)
        or (${table.statusPenutupan} = 'otomatis_belum_diverifikasi'
          and ${table.kasAwal} is not null
          and ${table.kasFisik} is null
          and ${table.qrisTerhitung} is null
          and ${table.kasDiharapkan} is not null
          and ${table.qrisSistem} is not null
          and ${table.selisihKas} is null
          and ${table.selisihQris} is null)`,
    ),
  ]
);
