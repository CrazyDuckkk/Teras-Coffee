CREATE TYPE "public"."status_pengajuan_void" AS ENUM('menunggu', 'disetujui', 'ditolak');--> statement-breakpoint
ALTER TYPE "public"."status_transaksi" ADD VALUE 'menunggu_void' BEFORE 'void';--> statement-breakpoint
CREATE TABLE "pengajuan_void" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaksi_id" uuid NOT NULL,
	"alasan" text NOT NULL,
	"diajukan_oleh" text,
	"diajukan_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "status_pengajuan_void" DEFAULT 'menunggu' NOT NULL,
	"diputuskan_oleh" text,
	"diputuskan_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "transaksi" ADD COLUMN "voided_by" text;--> statement-breakpoint
ALTER TABLE "transaksi" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "pengajuan_void" ADD CONSTRAINT "pengajuan_void_transaksi_id_transaksi_id_fk" FOREIGN KEY ("transaksi_id") REFERENCES "public"."transaksi"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengajuan_void" ADD CONSTRAINT "pengajuan_void_diajukan_oleh_user_id_fk" FOREIGN KEY ("diajukan_oleh") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengajuan_void" ADD CONSTRAINT "pengajuan_void_diputuskan_oleh_user_id_fk" FOREIGN KEY ("diputuskan_oleh") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pengajuan_void_status_idx" ON "pengajuan_void" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pengajuan_void_transaksi_id_idx" ON "pengajuan_void" USING btree ("transaksi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pengajuan_void_satu_menunggu_per_transaksi_idx" ON "pengajuan_void" USING btree ("transaksi_id") WHERE "pengajuan_void"."status" = 'menunggu';--> statement-breakpoint
ALTER TABLE "transaksi" ADD CONSTRAINT "transaksi_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public"."pengajuan_void" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."pengajuan_void" FROM anon, authenticated;