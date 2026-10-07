-- OOTIE PERSONAL MIGRATION 019
-- Scope: allow authenticated owners to read only their own public-bucket rows.
-- This is required by Supabase Storage for update/delete while keeping anonymous
-- and cross-user bucket listing denied.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL
     OR to_regclass('public.ootie_profiles') IS NULL THEN
    RAISE EXCEPTION '019 prerequisite missing: storage.objects or ootie_profiles';
  END IF;
END;
$$;

CREATE POLICY ootie_bookmark_images_owner_select
ON storage.objects AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  bucket_id = 'ootie-bookmarks-images'
  AND split_part(name, '/', 1) = 'bookmarks'
  AND split_part(name, '/', 2) = (
    SELECT p.id::text
    FROM public.ootie_profiles AS p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY ootie_profile_avatars_owner_select
ON storage.objects AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  bucket_id = 'ootie-profile-avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

CREATE POLICY ootie_ootd_images_owner_select
ON storage.objects AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  bucket_id = 'ootie-ootd-images'
  AND split_part(name, '/', 1) = 'ootd'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

COMMIT;
