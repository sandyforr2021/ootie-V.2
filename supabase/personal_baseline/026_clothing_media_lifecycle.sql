-- OOTIE Personal canonical migration 026
-- Private original + processed clothing media lifecycle.

DO $$
BEGIN
  IF to_regclass('public.ootie_clothing_items') IS NULL
     OR to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION '026 prerequisite missing: clothing or Storage tables';
  END IF;
END
$$;

ALTER TABLE public.ootie_clothing_items
  ADD COLUMN IF NOT EXISTS photo_original_path text,
  ADD COLUMN IF NOT EXISTS photo_display_path text,
  ADD COLUMN IF NOT EXISTS photo_mime_type text,
  ADD COLUMN IF NOT EXISTS photo_width integer,
  ADD COLUMN IF NOT EXISTS photo_height integer,
  ADD COLUMN IF NOT EXISTS photo_file_size bigint,
  ADD COLUMN IF NOT EXISTS photo_processing_status text NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz;

ALTER TABLE public.ootie_clothing_items
  DROP CONSTRAINT IF EXISTS ootie_clothing_photo_paths,
  ADD CONSTRAINT ootie_clothing_photo_paths CHECK (
    (photo_original_path IS NULL OR photo_original_path LIKE 'closet/%')
    AND (photo_display_path IS NULL OR photo_display_path LIKE 'closet/%')
  ),
  DROP CONSTRAINT IF EXISTS ootie_clothing_photo_mime,
  ADD CONSTRAINT ootie_clothing_photo_mime CHECK (
    photo_mime_type IS NULL OR photo_mime_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  DROP CONSTRAINT IF EXISTS ootie_clothing_photo_dimensions,
  ADD CONSTRAINT ootie_clothing_photo_dimensions CHECK (
    (photo_width IS NULL OR photo_width >= 128)
    AND (photo_height IS NULL OR photo_height >= 128)
    AND (photo_file_size IS NULL OR photo_file_size > 0)
  ),
  DROP CONSTRAINT IF EXISTS ootie_clothing_photo_processing_status,
  ADD CONSTRAINT ootie_clothing_photo_processing_status CHECK (
    photo_processing_status IN ('LEGACY', 'READY', 'FAILED')
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ootie-closet-media',
  'ootie-closet-media',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS ootie_closet_media_owner_select ON storage.objects;
CREATE POLICY ootie_closet_media_owner_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ootie-closet-media'
  AND (storage.foldername(name))[1] = 'closet'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS ootie_closet_media_owner_insert ON storage.objects;
CREATE POLICY ootie_closet_media_owner_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ootie-closet-media'
  AND (storage.foldername(name))[1] = 'closet'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS ootie_closet_media_owner_update ON storage.objects;
CREATE POLICY ootie_closet_media_owner_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ootie-closet-media'
  AND (storage.foldername(name))[1] = 'closet'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'ootie-closet-media'
  AND (storage.foldername(name))[1] = 'closet'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS ootie_closet_media_owner_delete ON storage.objects;
CREATE POLICY ootie_closet_media_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ootie-closet-media'
  AND (storage.foldername(name))[1] = 'closet'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);

CREATE OR REPLACE FUNCTION public.ootie_prevent_referenced_clothing_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ootie_ootd_posts p,
         LATERAL jsonb_array_elements_text(COALESCE(p.item_ids, '[]'::jsonb)) tagged(item_id)
    WHERE tagged.item_id = OLD.id::text
  ) OR EXISTS (
    SELECT 1 FROM public.ootie_sos_posts s WHERE OLD.id = ANY (s.closet_item_ids)
  ) OR EXISTS (
    SELECT 1
    FROM public.ootie_outfit_suggestions suggestion,
         LATERAL jsonb_array_elements_text(COALESCE(suggestion.item_ids, '[]'::jsonb)) tagged(item_id)
    WHERE tagged.item_id = OLD.id::text
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'clothing item is still referenced by OOTD or SOS content';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ootie_clothing_delete_reference_guard ON public.ootie_clothing_items;
CREATE TRIGGER ootie_clothing_delete_reference_guard
BEFORE DELETE ON public.ootie_clothing_items
FOR EACH ROW EXECUTE FUNCTION public.ootie_prevent_referenced_clothing_delete();

REVOKE ALL ON FUNCTION public.ootie_prevent_referenced_clothing_delete() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ootie_prevent_referenced_clothing_delete() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ootie_clothing_items TO authenticated;

