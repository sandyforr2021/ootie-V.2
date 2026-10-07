-- SUPABASE-BASELINE-BATCH-12 | PERSONAL STORAGE BASELINE
-- Target intent: OOTIE-sandy-dev. No SQL in this package has been executed.
-- Bucket and public-read behavior follow the team evidence. Write policies are
-- a PERSONAL_FIX: the previous authenticated-only checks did not bind an
-- object path to its profile owner.
-- Read README.md and STATIC_VALIDATION_REPORT.md before any future execution.
-- Separate baseline: never combine with supabase/migrations/20260924_ootie_bookmarks.sql.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

-- Bucket name/public/limit fields: STORAGE_BUCKET snapshot record.
-- Bucket ID is evidenced by policy bucket_id literals and src/services/supabase.js.
-- NULL file_size_limit / allowed_mime_types are exported values, not invented restrictions.
-- No ON CONFLICT UPDATE: an existing bucket requires review before using this blank-project baseline.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ootie-bookmarks-images', 'ootie-bookmarks-images', true, NULL, NULL);

-- The bucket itself is public for direct object URLs. No broad SELECT policy is
-- created because listing every object in the bucket is not part of the product.

-- The active frontend upload path is bookmarks/<profile-id>/<filename>.
-- Every write checks both the bucket and the profile folder. A user can never
-- write, update, or delete another profile's object by changing the path.
CREATE POLICY ootie_bookmark_images_owner_insert
  ON storage.objects AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ootie-bookmarks-images'
    AND split_part(name, '/', 1) = 'bookmarks'
    AND split_part(name, '/', 2) = (
      SELECT p.id::text FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ootie_bookmark_images_owner_update
  ON storage.objects AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ootie-bookmarks-images'
    AND split_part(name, '/', 1) = 'bookmarks'
    AND split_part(name, '/', 2) = (
      SELECT p.id::text FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'ootie-bookmarks-images'
    AND split_part(name, '/', 1) = 'bookmarks'
    AND split_part(name, '/', 2) = (
      SELECT p.id::text FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ootie_bookmark_images_owner_delete
  ON storage.objects AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ootie-bookmarks-images'
    AND split_part(name, '/', 1) = 'bookmarks'
    AND split_part(name, '/', 2) = (
      SELECT p.id::text FROM public.ootie_profiles p WHERE p.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
