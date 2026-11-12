import { boolean, numeric, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { menu } from "./menu";
import { bahanBaku } from "./bahan-baku";

export const resepMenu = pgTable(
  "resep_menu",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menu.id, { onDelete: "cascade" }),
    bahanBakuId: uuid("bahan_baku_id")
      .notNull()
      .references(() => bahanBaku.id, { onDelete: "restrict" }),
    takaran: numeric("takaran", { precision: 12, scale: 2 }).notNull(),
    hanyaBawaPulang: boolean("hanya_bawa_pulang").notNull().default(false),
  },
  (table) => [uniqueIndex("resep_menu_menu_bahan_idx").on(table.menuId, table.bahanBakuId)]
);
