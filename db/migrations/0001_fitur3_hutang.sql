CREATE TYPE "public"."metode_bayar" AS ENUM('tunai', 'hutang');--> statement-breakpoint
CREATE TYPE "public"."status_hutang" AS ENUM('belum_lunas', 'lunas');--> statement-breakpoint
CREATE TABLE "hutang" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaksi_id" uuid NOT NULL,
	"nama_pelanggan" text,
	"jumlah" numeric(12, 2) NOT NULL,
	"tanggal_hutang" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "status_hutang" DEFAULT 'belum_lunas' NOT NULL,
	"tanggal_lunas" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaksi" ADD COLUMN "metode_bayar" "metode_bayar" DEFAULT 'tunai' NOT NULL;--> statement-breakpoint
ALTER TABLE "hutang" ADD CONSTRAINT "hutang_transaksi_id_transaksi_id_fk" FOREIGN KEY ("transaksi_id") REFERENCES "public"."transaksi"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hutang_transaksi_id_idx" ON "hutang" USING btree ("transaksi_id");--> statement-breakpoint
CREATE INDEX "hutang_status_idx" ON "hutang" USING btree ("status");