CREATE TABLE "pengaturan" (
	"kunci" text PRIMARY KEY NOT NULL,
	"nilai" text NOT NULL,
	"diperbarui_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diperbarui_oleh_id" text
);
--> statement-breakpoint
ALTER TABLE "transaksi" ADD COLUMN "pelaku_id" text;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "pelaku_id" text;--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "pelaku_id" text;--> statement-breakpoint
ALTER TABLE "pengaturan" ADD CONSTRAINT "pengaturan_diperbarui_oleh_id_user_id_fk" FOREIGN KEY ("diperbarui_oleh_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_pelaku_id_user_id_fk" FOREIGN KEY ("pelaku_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD CONSTRAINT "stock_masuk_pelaku_id_user_id_fk" FOREIGN KEY ("pelaku_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD CONSTRAINT "tutup_kasir_pelaku_id_user_id_fk" FOREIGN KEY ("pelaku_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaksi_pelaku_id_idx" ON "transaksi" USING btree ("pelaku_id");--> statement-breakpoint
CREATE INDEX "stock_masuk_pelaku_id_idx" ON "stock_masuk" USING btree ("pelaku_id");--> statement-breakpoint
CREATE INDEX "tutup_kasir_pelaku_id_idx" ON "tutup_kasir" USING btree ("pelaku_id");