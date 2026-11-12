DO $$
BEGIN
  IF to_regrole('anon') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.penyesuaian_stok, public.penyesuaian_stok_detail FROM anon';
  END IF;
  IF to_regrole('authenticated') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.penyesuaian_stok, public.penyesuaian_stok_detail FROM authenticated';
  END IF;
END
$$;