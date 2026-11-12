-- Custom SQL migration file, put your code below! --
DO $$
BEGIN
  IF to_regrole('anon') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.bahan_baku, public.riwayat_harga_bahan, public.stock_masuk FROM anon';
  END IF;
  IF to_regrole('authenticated') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.bahan_baku, public.riwayat_harga_bahan, public.stock_masuk FROM authenticated';
  END IF;
END
$$;