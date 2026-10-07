-- OOTIE PERSONAL MIGRATION 015 | LOCAL DRAFT ONLY
-- Scope: OOTD image storage, tagged-item ownership validation, and dependent
-- delete behavior. Do not apply without a separate review and remote precheck.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('public.ootie_profiles') IS NULL
     OR to_regclass('public.ootie_clothing_items') IS NULL
     OR to_regclass('public.ootie_ootd_posts') IS NULL
     OR to_regclass('public.ootie_post_likes') IS NULL
     OR to_regclass('public.ootie_saved_posts') IS NULL
     OR to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION '015 prerequisite missing: profile, clothing, OOTD, interaction, or Storage object';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ootie_ootd_posts'
      AND column_name = 'image_storage_path'
  )
     OR to_regprocedure('public.guard_ootie_ootd_item_ownership()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ootie-ootd-images') THEN
    RAISE EXCEPTION '015 object collision: OOTD storage column, ownership guard, or bucket already exists';
  END IF;
END;
$$;

ALTER TABLE public.ootie_ootd_posts
  ADD COLUMN image_storage_path text,
  ADD CONSTRAINT ootie_ootd_posts_item_ids_array
    CHECK (item_ids IS NULL OR jsonb_typeof(item_ids) = 'array') NOT VALID;

-- item_ids is the established multi-item contract. Every new or changed tag
-- must be a UUID owned by the same profile that owns the OOTD post.
CREATE FUNCTION public.guard_ootie_ootd_item_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item_id_text text;
BEGIN
  IF NEW.item_ids IS NULL THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.item_ids) <> 'array' THEN
    RAISE EXCEPTION 'OOTIE_OOTD_ITEM_IDS_INVALID'
      USING ERRCODE = '23514';
  END IF;

  FOR item_id_text IN SELECT jsonb_array_elements_text(NEW.item_ids)
  LOOP
    IF item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'OOTIE_OOTD_ITEM_ID_INVALID'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.ootie_clothing_items AS clothing_item
      WHERE clothing_item.id = item_id_text::uuid
        AND clothing_item.owner_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'OOTIE_OOTD_ITEM_NOT_OWNED'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_ootie_ootd_item_ownership() FROM PUBLIC;

CREATE TRIGGER trg_guard_ootie_ootd_item_ownership
BEFORE INSERT OR UPDATE OF user_id, item_ids
ON public.ootie_ootd_posts
FOR EACH ROW
EXECUTE FUNCTION public.guard_ootie_ootd_item_ownership();

-- Likes should disappear with their post. The legacy saved-post table is no
-- longer a runtime truth after 014; cascading it prevents the legacy FK from
-- blocking an owner delete. 014 saved-outfit references intentionally remain.
ALTER TABLE public.ootie_post_likes
  DROP CONSTRAINT ootie_post_likes_post_id_fkey,
  ADD CONSTRAINT ootie_post_likes_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES public.ootie_ootd_posts(id) ON DELETE CASCADE;

ALTER TABLE public.ootie_saved_posts
  DROP CONSTRAINT ootie_saved_posts_post_id_fkey,
  ADD CONSTRAINT ootie_saved_posts_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES public.ootie_ootd_posts(id) ON DELETE CASCADE;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ootie-ootd-images',
  'ootie-ootd-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
);

CREATE POLICY ootie_ootd_images_owner_insert
ON storage.objects AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ootie-ootd-images'
  AND split_part(name, '/', 1) = 'ootd'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

CREATE POLICY ootie_ootd_images_owner_update
ON storage.objects AS PERMISSIVE
FOR UPDATE TO authenticated
USING (
  bucket_id = 'ootie-ootd-images'
  AND split_part(name, '/', 1) = 'ootd'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'ootie-ootd-images'
  AND split_part(name, '/', 1) = 'ootd'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

CREATE POLICY ootie_ootd_images_owner_delete
ON storage.objects AS PERMISSIVE
FOR DELETE TO authenticated
USING (
  bucket_id = 'ootie-ootd-images'
  AND split_part(name, '/', 1) = 'ootd'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

COMMIT;
