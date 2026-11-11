import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const pengaturan = pgTable("pengaturan", {
  kunci: text("kunci").primaryKey(),
  nilai: text("nilai").notNull(),
  diperbaruiPada: timestamp("diperbarui_pada", { withTimezone: true }).notNull().defaultNow(),
  diperbaruiOlehId: text("diperbarui_oleh_id").references(() => user.id, { onDelete: "set null" }),
});
