-- OOTIE PERSONAL MIGRATION 021
-- Development-only seed runner access for canonical saved outfits.
-- Do not promote this service-role seed grant to Production unchanged.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('public.ootie_saved_outfits') IS NULL THEN
    RAISE EXCEPTION '021 prerequisite missing: ootie_saved_outfits';
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.ootie_saved_outfits
TO service_role;

COMMIT;
