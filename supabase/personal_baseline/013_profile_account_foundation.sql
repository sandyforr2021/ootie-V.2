-- OOTIE Personal Baseline 013 - Profile & Account Foundation
-- LOCAL REVIEWED DRAFT ONLY. REMOTE APPLY: NO.
-- Apply only after a separate remote catalog precheck confirms the canonical
-- 001-012 baseline and no 013 objects or columns already exist.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

-- Fail closed when a required 001-012 object is missing or a 013 table already
-- exists. The plain ALTER/CREATE statements below also reject column, function,
-- trigger, policy, constraint, and bucket collisions instead of silently
-- accepting an unknown definition.
DO $$
BEGIN
  IF to_regclass('public.ootie_profiles') IS NULL THEN
    RAISE EXCEPTION '013 prerequisite missing: public.ootie_profiles';
  END IF;
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION '013 prerequisite missing: public.set_updated_at()';
  END IF;
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION '013 prerequisite missing: Supabase Storage catalog';
  END IF;
  IF to_regclass('public.ootie_profile_private') IS NOT NULL
     OR to_regclass('public.ootie_point_transactions') IS NOT NULL THEN
    RAISE EXCEPTION '013 object collision: profile account table already exists';
  END IF;
END;
$$;

ALTER TABLE public.ootie_profiles
  ADD COLUMN display_name text,
  ADD COLUMN slogan text,
  ADD COLUMN display_name_changed_at timestamp with time zone,
  ADD COLUMN avatar_storage_path text;

ALTER TABLE public.ootie_profiles
  ADD CONSTRAINT ootie_profiles_display_name_length
    CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 30),
  ADD CONSTRAINT ootie_profiles_slogan_length
    CHECK (slogan IS NULL OR char_length(slogan) <= 120);

CREATE TABLE public.ootie_profile_private (
  profile_id uuid PRIMARY KEY
    REFERENCES public.ootie_profiles(id) ON DELETE CASCADE,
  full_name text,
  birth_date date,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ootie_profile_private_phone_length
    CHECK (phone IS NULL OR char_length(phone) <= 64)
);

CREATE TABLE public.ootie_point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL
    REFERENCES public.ootie_profiles(id) ON DELETE NO ACTION,
  amount integer NOT NULL,
  type text NOT NULL
    CONSTRAINT ootie_point_transactions_type_check
    CHECK (type IN (
      'BIRTHDAY_BONUS',
      'AI_USAGE',
      'TRYON_USAGE',
      'MANUAL_ADJUSTMENT'
    )),
  source_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ootie_point_transactions_profile_source_key_key
    UNIQUE (profile_id, source_key)
);

CREATE INDEX ootie_point_transactions_profile_id_idx
  ON public.ootie_point_transactions (profile_id);

-- Existing OOTIE profiles do not fire the future AFTER INSERT trigger. Create
-- exactly one empty private row for every existing profile before normal use.
INSERT INTO public.ootie_profile_private (profile_id)
SELECT p.id
FROM public.ootie_profiles AS p
ON CONFLICT (profile_id) DO NOTHING;

ALTER TABLE public.ootie_profile_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ootie_point_transactions ENABLE ROW LEVEL SECURITY;

-- Make table privileges explicit instead of relying on project default grants.
-- RLS below supplies the row-level owner boundary.
REVOKE ALL ON TABLE public.ootie_profile_private FROM anon, authenticated;
REVOKE ALL ON TABLE public.ootie_point_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ootie_profile_private TO authenticated;
GRANT SELECT ON TABLE public.ootie_point_transactions TO authenticated;

CREATE POLICY ootie_profile_private_select_own
ON public.ootie_profile_private
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ootie_profiles AS p
    WHERE p.id = ootie_profile_private.profile_id
      AND p.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY ootie_profile_private_insert_own
ON public.ootie_profile_private
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ootie_profiles AS p
    WHERE p.id = ootie_profile_private.profile_id
      AND p.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY ootie_profile_private_update_own
ON public.ootie_profile_private
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ootie_profiles AS p
    WHERE p.id = ootie_profile_private.profile_id
      AND p.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ootie_profiles AS p
    WHERE p.id = ootie_profile_private.profile_id
      AND p.user_id = (SELECT auth.uid())
  )
);

-- Point transactions are server-controlled ledger entries. Browser clients may
-- read only their own rows and receive no INSERT/UPDATE/DELETE policy.
CREATE POLICY ootie_point_transactions_select_own
ON public.ootie_point_transactions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ootie_profiles AS p
    WHERE p.id = ootie_point_transactions.profile_id
      AND p.user_id = (SELECT auth.uid())
  )
);

CREATE FUNCTION public.guard_ootie_display_name_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.display_name IS DISTINCT FROM NEW.display_name THEN
    IF OLD.display_name_changed_at IS NOT NULL
       AND current_timestamp < OLD.display_name_changed_at + interval '30 days' THEN
      RAISE EXCEPTION 'DISPLAY_NAME_COOLDOWN' USING ERRCODE = 'P0001';
    END IF;
    NEW.display_name_changed_at := current_timestamp;
  ELSE
    -- The cooldown timestamp is system-managed. A direct client update cannot
    -- clear or move it while keeping the same display name.
    NEW.display_name_changed_at := OLD.display_name_changed_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_ootie_display_name_change() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_ootie_display_name_change
BEFORE UPDATE OF display_name, display_name_changed_at ON public.ootie_profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_ootie_display_name_change();

CREATE FUNCTION public.validate_ootie_profile_private_birth_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL AND NEW.birth_date > current_date THEN
    RAISE EXCEPTION 'birth_date cannot be in the future' USING ERRCODE = '22007';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_ootie_profile_private_birth_date() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_validate_ootie_profile_private_birth_date
BEFORE INSERT OR UPDATE OF birth_date ON public.ootie_profile_private
FOR EACH ROW
EXECUTE FUNCTION public.validate_ootie_profile_private_birth_date();

CREATE FUNCTION public.provision_ootie_profile_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.ootie_profile_private (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_ootie_profile_private() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_provision_ootie_profile_private
AFTER INSERT ON public.ootie_profiles
FOR EACH ROW
EXECUTE FUNCTION public.provision_ootie_profile_private();

CREATE TRIGGER trg_touch_ootie_profile_private
BEFORE UPDATE ON public.ootie_profile_private
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Public bucket + public read matches the permanent public URL used by profile
-- rendering. Authenticated writes remain confined to avatars/{auth.uid()}/.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'ootie-profile-avatars',
  'ootie-profile-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
);

CREATE POLICY ootie_profile_avatars_owner_insert
ON storage.objects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ootie-profile-avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

CREATE POLICY ootie_profile_avatars_owner_update
ON storage.objects
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ootie-profile-avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'ootie-profile-avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

CREATE POLICY ootie_profile_avatars_owner_delete
ON storage.objects
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ootie-profile-avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

COMMIT;
