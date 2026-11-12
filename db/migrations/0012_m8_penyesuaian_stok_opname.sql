CREATE TYPE "public"."jenis_penyesuaian_stok" AS ENUM('menu_tumpah', 'menu_gagal', 'kalibrasi', 'tes_rasa', 'rusak', 'kedaluwarsa', 'opname');--> statement-breakpoint
CREATE TABLE "penyesuaian_stok" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jenis" "jenis_penyesuaian_stok" NOT NULL,
	"alasan" text NOT NULL,
	"menu_id" uuid,
	"bawa_pulang" boolean,
	"pelaku_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "penyesuaian_stok_alasan_nonempty" CHECK (length(trim("penyesuaian_stok"."alasan")) >= 3),
	CONSTRAINT "penyesuaian_stok_menu_fields_check" CHECK ((
        "penyesuaian_stok"."jenis" in ('menu_tumpah', 'menu_gagal')
        and "penyesuaian_stok"."menu_id" is not null
        and "penyesuaian_stok"."bawa_pulang" is not null
      ) or (
        "penyesuaian_stok"."jenis" not in ('menu_tumpah', 'menu_gagal')
        and "penyesuaian_stok"."menu_id" is null
        and "penyesuaian_stok"."bawa_pulang" is null
      ))
);
--> statement-breakpoint
ALTER TABLE "penyesuaian_stok" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "penyesuaian_stok_detail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"penyesuaian_stok_id" uuid NOT NULL,
	"bahan_baku_id" uuid NOT NULL,
	"perubahan_qty" numeric(12, 2) NOT NULL,
	"stok_sebelum" numeric(12, 2) NOT NULL,
	"stok_sesudah" numeric(12, 2) NOT NULL,
	"harga_per_satuan" numeric(12, 2),
	"nilai_susut" numeric(12, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "penyesuaian_stok_detail_perubahan_nonzero" CHECK ("penyesuaian_stok_detail"."perubahan_qty" <> 0),
	CONSTRAINT "penyesuaian_stok_detail_stok_nonnegative" CHECK ("penyesuaian_stok_detail"."stok_sebelum" >= 0 and "penyesuaian_stok_detail"."stok_sesudah" >= 0),
	CONSTRAINT "penyesuaian_stok_detail_stok_delta_check" CHECK ("penyesuaian_stok_detail"."stok_sesudah" - "penyesuaian_stok_detail"."stok_sebelum" = "penyesuaian_stok_detail"."perubahan_qty"),
	CONSTRAINT "penyesuaian_stok_detail_nilai_nonnegative" CHECK ("penyesuaian_stok_detail"."nilai_susut" >= 0)
);
--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok" ADD CONSTRAINT "penyesuaian_stok_menu_id_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menu"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok" ADD CONSTRAINT "penyesuaian_stok_pelaku_id_user_id_fk" FOREIGN KEY ("pelaku_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD CONSTRAINT "penyesuaian_stok_detail_penyesuaian_stok_id_penyesuaian_stok_id_fk" FOREIGN KEY ("penyesuaian_stok_id") REFERENCES "public"."penyesuaian_stok"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD CONSTRAINT "penyesuaian_stok_detail_bahan_baku_id_bahan_baku_id_fk" FOREIGN KEY ("bahan_baku_id") REFERENCES "public"."bahan_baku"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "penyesuaian_stok_created_at_idx" ON "penyesuaian_stok" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "penyesuaian_stok_menu_id_idx" ON "penyesuaian_stok" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "penyesuaian_stok_pelaku_id_idx" ON "penyesuaian_stok" USING btree ("pelaku_id");--> statement-breakpoint
CREATE UNIQUE INDEX "penyesuaian_stok_detail_parent_bahan_idx" ON "penyesuaian_stok_detail" USING btree ("penyesuaian_stok_id","bahan_baku_id");--> statement-breakpoint
CREATE INDEX "penyesuaian_stok_detail_bahan_id_idx" ON "penyesuaian_stok_detail" USING btree ("bahan_baku_id");