CREATE TABLE "detail_transaksi_bahan" (
	"detail_transaksi_id" uuid NOT NULL,
	"bahan_baku_id" uuid NOT NULL,
	"qty_dipakai" numeric(12, 2) NOT NULL,
	CONSTRAINT "detail_transaksi_bahan_detail_transaksi_id_bahan_baku_id_pk" PRIMARY KEY("detail_transaksi_id","bahan_baku_id")
);
--> statement-breakpoint
ALTER TABLE "resep_menu" ADD COLUMN "hanya_bawa_pulang" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "detail_transaksi" ADD COLUMN "bawa_pulang" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "detail_transaksi_bahan" ADD CONSTRAINT "detail_transaksi_bahan_detail_transaksi_id_detail_transaksi_id_fk" FOREIGN KEY ("detail_transaksi_id") REFERENCES "public"."detail_transaksi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detail_transaksi_bahan" ADD CONSTRAINT "detail_transaksi_bahan_bahan_baku_id_bahan_baku_id_fk" FOREIGN KEY ("bahan_baku_id") REFERENCES "public"."bahan_baku"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "detail_transaksi_bahan" ("detail_transaksi_id", "bahan_baku_id", "qty_dipakai")
SELECT
  detail."id",
  resep."bahan_baku_id",
  SUM(resep."takaran" * detail."qty")::numeric(12, 2)
FROM "detail_transaksi" AS detail
INNER JOIN "resep_menu" AS resep ON resep."menu_id" = detail."menu_id"
WHERE resep."hanya_bawa_pulang" = false
GROUP BY detail."id", resep."bahan_baku_id";