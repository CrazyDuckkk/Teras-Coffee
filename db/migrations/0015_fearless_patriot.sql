CREATE TYPE "public"."periode_ekspor_laporan" AS ENUM('mingguan', 'bulanan');--> statement-breakpoint
CREATE TABLE "ekspor_laporan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periode" "periode_ekspor_laporan" NOT NULL,
	"rentang_mulai" timestamp with time zone NOT NULL,
	"rentang_sampai" timestamp with time zone NOT NULL,
	"nama_file" text NOT NULL,
	"diekspor_oleh" text,
	"diekspor_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ekspor_laporan_rentang_valid" CHECK ("ekspor_laporan"."rentang_mulai" < "ekspor_laporan"."rentang_sampai")
);
--> statement-breakpoint
ALTER TABLE "ekspor_laporan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ekspor_laporan" ADD CONSTRAINT "ekspor_laporan_diekspor_oleh_user_id_fk" FOREIGN KEY ("diekspor_oleh") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ekspor_laporan_diekspor_pada_idx" ON "ekspor_laporan" USING btree ("diekspor_pada" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ekspor_laporan_rentang_mulai_idx" ON "ekspor_laporan" USING btree ("rentang_mulai");