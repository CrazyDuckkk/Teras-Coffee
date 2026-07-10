CREATE TYPE "public"."satuan" AS ENUM('gram', 'ml', 'pcs');--> statement-breakpoint
CREATE TYPE "public"."status_transaksi" AS ENUM('aktif', 'void');--> statement-breakpoint
CREATE TABLE "bahan_baku" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"satuan" "satuan" NOT NULL,
	"stok_saat_ini" numeric(12, 2) DEFAULT '0' NOT NULL,
	"batas_minimum_stok" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bahan_baku_stok_non_negative" CHECK ("bahan_baku"."stok_saat_ini" >= 0)
);
--> statement-breakpoint
CREATE TABLE "riwayat_harga_bahan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bahan_baku_id" uuid NOT NULL,
	"harga_per_satuan" numeric(12, 2) NOT NULL,
	"berlaku_sejak" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"kategori" text NOT NULL,
	"harga_jual" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resep_menu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"bahan_baku_id" uuid NOT NULL,
	"takaran" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaksi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tanggal" timestamp with time zone DEFAULT now() NOT NULL,
	"total_pemasukan" numeric(12, 2) NOT NULL,
	"status" "status_transaksi" DEFAULT 'aktif' NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detail_transaksi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaksi_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"harga_jual_saat_itu" numeric(12, 2) NOT NULL,
	"hpp_saat_itu" numeric(12, 2) NOT NULL,
	CONSTRAINT "detail_transaksi_qty_positive" CHECK ("detail_transaksi"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_masuk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tanggal" timestamp with time zone DEFAULT now() NOT NULL,
	"bahan_baku_id" uuid NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"harga_beli" numeric(12, 2) NOT NULL,
	"total_pengeluaran" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutup_kasir" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tanggal" date NOT NULL,
	"total_penjualan" numeric(12, 2) NOT NULL,
	"total_pengeluaran" numeric(12, 2) NOT NULL,
	"laba_kotor" numeric(12, 2) NOT NULL,
	"menu_terlaris_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutup_kasir_tanggal_unique" UNIQUE("tanggal")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "riwayat_harga_bahan" ADD CONSTRAINT "riwayat_harga_bahan_bahan_baku_id_bahan_baku_id_fk" FOREIGN KEY ("bahan_baku_id") REFERENCES "public"."bahan_baku"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resep_menu" ADD CONSTRAINT "resep_menu_menu_id_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menu"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resep_menu" ADD CONSTRAINT "resep_menu_bahan_baku_id_bahan_baku_id_fk" FOREIGN KEY ("bahan_baku_id") REFERENCES "public"."bahan_baku"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_transaksi_id_transaksi_id_fk" FOREIGN KEY ("transaksi_id") REFERENCES "public"."transaksi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_menu_id_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menu"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_masuk" ADD CONSTRAINT "stock_masuk_bahan_baku_id_bahan_baku_id_fk" FOREIGN KEY ("bahan_baku_id") REFERENCES "public"."bahan_baku"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutup_kasir" ADD CONSTRAINT "tutup_kasir_menu_terlaris_id_menu_id_fk" FOREIGN KEY ("menu_terlaris_id") REFERENCES "public"."menu"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bahan_baku_nama_lower_idx" ON "bahan_baku" USING btree (lower("nama"));--> statement-breakpoint
CREATE INDEX "riwayat_harga_bahan_bahan_baku_berlaku_idx" ON "riwayat_harga_bahan" USING btree ("bahan_baku_id","berlaku_sejak" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "menu_kategori_idx" ON "menu" USING btree ("kategori");--> statement-breakpoint
CREATE UNIQUE INDEX "resep_menu_menu_bahan_idx" ON "resep_menu" USING btree ("menu_id","bahan_baku_id");--> statement-breakpoint
CREATE INDEX "transaksi_tanggal_idx" ON "transaksi" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "transaksi_status_idx" ON "transaksi" USING btree ("status");--> statement-breakpoint
CREATE INDEX "detail_transaksi_transaksi_idx" ON "detail_transaksi" USING btree ("transaksi_id");--> statement-breakpoint
CREATE INDEX "detail_transaksi_menu_idx" ON "detail_transaksi" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "stock_masuk_tanggal_idx" ON "stock_masuk" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "stock_masuk_bahan_baku_idx" ON "stock_masuk" USING btree ("bahan_baku_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");