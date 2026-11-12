CREATE TYPE "public"."metode_pembayaran_hutang" AS ENUM('tunai', 'qris');--> statement-breakpoint
CREATE TABLE "hutang_pembayaran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hutang_id" uuid NOT NULL,
	"jumlah" numeric(12, 2) NOT NULL,
	"metode" "metode_pembayaran_hutang" NOT NULL,
	"dibayar_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pelaku_id" text,
	"dibatalkan_at" timestamp with time zone,
	"dibatalkan_oleh" text,
	"alasan_batal" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hutang_pembayaran_jumlah_positif" CHECK ("hutang_pembayaran"."jumlah" > 0),
	CONSTRAINT "hutang_pembayaran_batal_lengkap" CHECK (("hutang_pembayaran"."dibatalkan_at" IS NULL) = ("hutang_pembayaran"."alasan_batal" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "hutang_pembayaran" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hutang_pembayaran" ADD CONSTRAINT "hutang_pembayaran_hutang_id_hutang_id_fk" FOREIGN KEY ("hutang_id") REFERENCES "public"."hutang"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hutang_pembayaran" ADD CONSTRAINT "hutang_pembayaran_pelaku_id_user_id_fk" FOREIGN KEY ("pelaku_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hutang_pembayaran" ADD CONSTRAINT "hutang_pembayaran_dibatalkan_oleh_user_id_fk" FOREIGN KEY ("dibatalkan_oleh") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hutang_pembayaran_hutang_id_idx" ON "hutang_pembayaran" USING btree ("hutang_id");--> statement-breakpoint
CREATE INDEX "hutang_pembayaran_dibayar_at_idx" ON "hutang_pembayaran" USING btree ("dibayar_at");