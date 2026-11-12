import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const periodeEksporLaporanEnum = pgEnum("periode_ekspor_laporan", [
  "mingguan",
  "bulanan",
]);

export const eksporLaporan = pgTable(
  "ekspor_laporan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periode: periodeEksporLaporanEnum("periode").notNull(),
    rentangMulai: timestamp("rentang_mulai", { withTimezone: true }).notNull(),
    rentangSampai: timestamp("rentang_sampai", { withTimezone: true }).notNull(),
    namaFile: text("nama_file").notNull(),
    dieksporOleh: text("diekspor_oleh").references(() => user.id, { onDelete: "set null" }),
    dieksporPada: timestamp("diekspor_pada", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ekspor_laporan_diekspor_pada_idx").on(table.dieksporPada.desc()),
    index("ekspor_laporan_rentang_mulai_idx").on(table.rentangMulai),
    check("ekspor_laporan_rentang_valid", sql`${table.rentangMulai} < ${table.rentangSampai}`),
  ],
).enableRLS();
