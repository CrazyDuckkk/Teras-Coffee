import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bahanBaku } from "./bahan-baku";
import { menu } from "./menu";
import { user } from "./auth";

export const jenisPenyesuaianStokEnum = pgEnum("jenis_penyesuaian_stok", [
  "menu_tumpah",
  "menu_gagal",
  "kalibrasi",
  "tes_rasa",
  "rusak",
  "kedaluwarsa",
  "opname",
]);

export const penyesuaianStok = pgTable(
  "penyesuaian_stok",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jenis: jenisPenyesuaianStokEnum("jenis").notNull(),
    alasan: text("alasan").notNull(),
    menuId: uuid("menu_id").references(() => menu.id, { onDelete: "restrict" }),
    bawaPulang: boolean("bawa_pulang"),
    pelakuId: text("pelaku_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("penyesuaian_stok_created_at_idx").on(table.createdAt.desc()),
    index("penyesuaian_stok_menu_id_idx").on(table.menuId),
    index("penyesuaian_stok_pelaku_id_idx").on(table.pelakuId),
    check("penyesuaian_stok_alasan_nonempty", sql`length(trim(${table.alasan})) >= 3`),
    check(
      "penyesuaian_stok_menu_fields_check",
      sql`(
        ${table.jenis} in ('menu_tumpah', 'menu_gagal')
        and ${table.menuId} is not null
        and ${table.bawaPulang} is not null
      ) or (
        ${table.jenis} not in ('menu_tumpah', 'menu_gagal')
        and ${table.menuId} is null
        and ${table.bawaPulang} is null
      )`
    ),
  ]
).enableRLS();

export const penyesuaianStokDetail = pgTable(
  "penyesuaian_stok_detail",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penyesuaianStokId: uuid("penyesuaian_stok_id")
      .notNull()
      .references(() => penyesuaianStok.id, { onDelete: "restrict" }),
    bahanBakuId: uuid("bahan_baku_id")
      .notNull()
      .references(() => bahanBaku.id, { onDelete: "restrict" }),
    perubahanQty: numeric("perubahan_qty", { precision: 12, scale: 2 }).notNull(),
    stokSebelum: numeric("stok_sebelum", { precision: 12, scale: 2 }).notNull(),
    stokSesudah: numeric("stok_sesudah", { precision: 12, scale: 2 }).notNull(),
    hargaPerSatuan: numeric("harga_per_satuan", { precision: 12, scale: 2 }),
    nilaiSusut: numeric("nilai_susut", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (table) => [
    uniqueIndex("penyesuaian_stok_detail_parent_bahan_idx").on(table.penyesuaianStokId, table.bahanBakuId),
    index("penyesuaian_stok_detail_bahan_id_idx").on(table.bahanBakuId),
    check("penyesuaian_stok_detail_perubahan_nonzero", sql`${table.perubahanQty} <> 0`),
    check("penyesuaian_stok_detail_stok_nonnegative", sql`${table.stokSebelum} >= 0 and ${table.stokSesudah} >= 0`),
    check("penyesuaian_stok_detail_stok_delta_check", sql`${table.stokSesudah} - ${table.stokSebelum} = ${table.perubahanQty}`),
    check("penyesuaian_stok_detail_nilai_nonnegative", sql`${table.nilaiSusut} >= 0`),
  ]
).enableRLS();
