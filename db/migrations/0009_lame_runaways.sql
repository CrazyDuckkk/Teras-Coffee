CREATE TYPE "public"."status_harga_stock_masuk" AS ENUM('menunggu', 'disetujui', 'ditolak');--> statement-breakpoint
CREATE TYPE "public"."sumber_bayar_stock_masuk" AS ENUM('kas_laci', 'di_luar_laci');--> statement-breakpoint
ALTER TABLE "riwayat_harga_bahan" ADD COLUMN "stock_masuk_id" uuid;--> statement-breakpoint
ALTER TABLE "riwayat_harga_bahan" ADD COLUMN "dibatalkan_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "dibayar_dari" "sumber_bayar_stock_masuk";--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "status_harga" "status_harga_stock_masuk" DEFAULT 'disetujui' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "konfirmasi_harga_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "konfirmasi_harga_oleh" text;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "dibatalkan_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "dibatalkan_oleh" text;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "alasan_batal" text;--> statement-breakpoint
ALTER TABLE "riwayat_harga_bahan" ADD CONSTRAINT "riwayat_harga_bahan_stock_masuk_id_stock_masuk_id_fk" FOREIGN KEY ("stock_masuk_id") REFERENCES "public"."stock_masuk"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD CONSTRAINT "stock_masuk_konfirmasi_harga_oleh_user_id_fk" FOREIGN KEY ("konfirmasi_harga_oleh") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD CONSTRAINT "stock_masuk_dibatalkan_oleh_user_id_fk" FOREIGN KEY ("dibatalkan_oleh") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "riwayat_harga_bahan_stock_masuk_id_idx" ON "riwayat_harga_bahan" USING btree ("stock_masuk_id");--> statement-breakpoint
CREATE INDEX "stock_masuk_status_harga_idx" ON "stock_masuk" USING btree ("status_harga");--> statement-breakpoint
CREATE INDEX "stock_masuk_dibatalkan_at_idx" ON "stock_masuk" USING btree ("dibatalkan_at");