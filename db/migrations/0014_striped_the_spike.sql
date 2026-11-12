CREATE TYPE "public"."status_penutupan_kasir" AS ENUM('manual', 'otomatis_belum_diverifikasi');--> statement-breakpoint
ALTER TABLE "transaksi" ADD COLUMN "setelah_tutup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD COLUMN "setelah_tutup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "kas_awal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "kas_fisik" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "qris_terhitung" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "kas_diharapkan" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "qris_sistem" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "selisih_kas" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "selisih_qris" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "catatan" text;--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD COLUMN "status_penutupan" "status_penutupan_kasir";--> statement-breakpoint
ALTER TABLE "hutang_pembayaran" ADD COLUMN "setelah_tutup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD CONSTRAINT "tutup_kasir_rekonsiliasi_valid" CHECK ("tutup_kasir"."status_penutupan" is null
        or ("tutup_kasir"."status_penutupan" = 'manual'
          and "tutup_kasir"."kas_awal" is not null
          and "tutup_kasir"."kas_fisik" is not null
          and "tutup_kasir"."qris_terhitung" is not null
          and "tutup_kasir"."kas_diharapkan" is not null
          and "tutup_kasir"."qris_sistem" is not null
          and "tutup_kasir"."selisih_kas" is not null
          and "tutup_kasir"."selisih_qris" is not null)
        or ("tutup_kasir"."status_penutupan" = 'otomatis_belum_diverifikasi'
          and "tutup_kasir"."kas_awal" is not null
          and "tutup_kasir"."kas_fisik" is null
          and "tutup_kasir"."qris_terhitung" is null
          and "tutup_kasir"."kas_diharapkan" is not null
          and "tutup_kasir"."qris_sistem" is not null
          and "tutup_kasir"."selisih_kas" is null
          and "tutup_kasir"."selisih_qris" is null));