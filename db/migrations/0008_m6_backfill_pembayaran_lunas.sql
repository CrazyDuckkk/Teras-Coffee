-- M6: hak akses tabel baru (selaras dengan pengajuan_void di 0006) + backfill data lama.
DO $$
BEGIN
  IF to_regrole('anon') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.hutang_pembayaran FROM anon';
  END IF;
  IF to_regrole('authenticated') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.hutang_pembayaran FROM authenticated';
  END IF;
END
$$;
--> statement-breakpoint
-- Hutang lunas lama belum punya pembayaran. Model baru menghitung uang masuk dari pembayaran,
-- jadi tiap hutang lunas lama diberi SATU pembayaran penuh pada tanggal lunasnya (tunai, tanpa
-- pelaku). Hutang belum lunas lama tidak diberi pembayaran: sisanya = jumlah hutang.
-- NOT EXISTS membuat skrip ini aman dijalankan ulang.
INSERT INTO "hutang_pembayaran" ("hutang_id", "jumlah", "metode", "dibayar_at", "pelaku_id")
SELECT h."id", h."jumlah", 'tunai', COALESCE(h."tanggal_lunas", h."tanggal_hutang"), NULL
FROM "hutang" h
WHERE h."status" = 'lunas'
  AND NOT EXISTS (SELECT 1 FROM "hutang_pembayaran" p WHERE p."hutang_id" = h."id");
