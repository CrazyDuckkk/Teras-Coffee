import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function kosongkanDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : "";
  if (!databaseName.endsWith("_test")) {
    throw new Error("Tes database hanya boleh mengosongkan database dengan nama berakhiran _test.");
  }

  await db.execute(sql.raw(`
    TRUNCATE TABLE
      public.account,
      public.session,
      public.verification,
      public.hutang_pembayaran,
      public.pengajuan_void,
      public.hutang,
      public.detail_transaksi_bahan,
      public.detail_transaksi,
      public.transaksi,
      public.resep_menu,
      public.riwayat_harga_bahan,
      public.stock_masuk,
      public.tutup_kasir,
      public.menu,
      public.bahan_baku,
      public.pengaturan,
      public."user"
    RESTART IDENTITY CASCADE
  `));
}
