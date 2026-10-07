-- OOTIE PERSONAL MIGRATION 014 | LOCAL DRAFT ONLY
-- Scope: private OOTD/SOS saved-outfit references. Do not apply without its
-- separate remote catalog precheck and hash gate.
-- `ootie_bookmarks` remains the existing product/brand-bookmark table.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

-- Fail closed if the established baseline is incomplete or any 014 object
-- already exists with an unknown definition. Plain CREATE statements below
-- deliberately reject all other collisions.
DO $$
BEGIN
  IF to_regclass('public.ootie_profiles') IS NULL
     OR to_regclass('public.ootie_saved_posts') IS NULL
     OR to_regclass('public.ootie_ootd_posts') IS NULL
     OR to_regclass('public.ootie_sos_posts') IS NULL THEN
    RAISE EXCEPTION '014 prerequisite missing: profile, legacy save, OOTD, or SOS table';
  END IF;

  IF to_regclass('public.ootie_saved_outfits') IS NOT NULL
     OR to_regprocedure('public.validate_ootie_saved_outfit_target()') IS NOT NULL THEN
    RAISE EXCEPTION '014 object collision: saved outfits table or target validator already exists';
  END IF;
END;
$$;

CREATE TABLE public.ootie_saved_outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.ootie_profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('OOTD', 'SOS')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ootie_saved_outfits_profile_target_key UNIQUE (profile_id, target_type, target_id)
);

CREATE INDEX ootie_saved_outfits_profile_created_idx
  ON public.ootie_saved_outfits (profile_id, created_at DESC);

-- A polymorphic target cannot use one ordinary FK. This trigger rejects an
-- invalid OOTD/SOS reference at the database boundary while deliberately not
-- cascading target deletes: saved history is retained and rendered unavailable.
CREATE FUNCTION public.validate_ootie_saved_outfit_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.target_type = 'OOTD' THEN
    PERFORM 1
    FROM public.ootie_ootd_posts AS ootd_post
    WHERE ootd_post.id = NEW.target_id;
  ELSIF NEW.target_type = 'SOS' THEN
    PERFORM 1
    FROM public.ootie_sos_posts AS sos_post
    WHERE sos_post.id = NEW.target_id;
  ELSE
    RAISE EXCEPTION 'OOTIE_SAVED_OUTFIT_INVALID_TARGET_TYPE'
      USING ERRCODE = '23514';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OOTIE_SAVED_OUTFIT_TARGET_NOT_FOUND'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_ootie_saved_outfit_target() FROM PUBLIC;

CREATE TRIGGER trg_validate_ootie_saved_outfit_target
BEFORE INSERT OR UPDATE OF target_type, target_id
ON public.ootie_saved_outfits
FOR EACH ROW
EXECUTE FUNCTION public.validate_ootie_saved_outfit_target();

-- Preserve every valid legacy OOTD save, including its original timestamp when
-- present. A legacy NULL timestamp receives this migration's timestamp because
-- the new record is intentionally NOT NULL. The INNER JOIN avoids admitting a
-- corrupted/orphaned legacy reference; the source row remains untouched.
INSERT INTO public.ootie_saved_outfits (profile_id, target_type, target_id, created_at)
SELECT saved_post.user_id, 'OOTD', saved_post.post_id, COALESCE(saved_post.created_at, now())
FROM public.ootie_saved_posts AS saved_post
JOIN public.ootie_ootd_posts AS ootd_post
  ON ootd_post.id = saved_post.post_id
ON CONFLICT (profile_id, target_type, target_id) DO NOTHING;

COMMENT ON TABLE public.ootie_saved_outfits IS
  'Private per-profile OOTD and SOS saves. Deleted targets retain their reference so the UI can render unavailable saved content.';

ALTER TABLE public.ootie_saved_outfits ENABLE ROW LEVEL SECURITY;

-- Make table privileges explicit. RLS below restricts every browser operation
-- to the profile mapped from auth.uid(); client UPDATE and anon access are not granted.
REVOKE ALL ON TABLE public.ootie_saved_outfits FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ootie_saved_outfits TO authenticated;

CREATE POLICY "saved outfits select own"
  ON public.ootie_saved_outfits
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT p.id FROM public.ootie_profiles AS p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY "saved outfits insert own"
  ON public.ootie_saved_outfits
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT p.id FROM public.ootie_profiles AS p WHERE p.user_id = (SELECT auth.uid())));

CREATE POLICY "saved outfits delete own"
  ON public.ootie_saved_outfits
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT p.id FROM public.ootie_profiles AS p WHERE p.user_id = (SELECT auth.uid())));

COMMIT;
