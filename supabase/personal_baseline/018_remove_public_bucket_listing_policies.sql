-- OOTIE PERSONAL MIGRATION 018
-- Scope: remove legacy Data API listing policies from public media buckets.
-- Public object URLs continue to work because the buckets remain public.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION '018 prerequisite missing: storage.objects';
  END IF;
END;
$$;

DROP POLICY IF EXISTS ootie_bookmark_images_public_select ON storage.objects;
DROP POLICY IF EXISTS ootie_profile_avatars_public_select ON storage.objects;
DROP POLICY IF EXISTS ootie_ootd_images_public_select ON storage.objects;

COMMIT;
