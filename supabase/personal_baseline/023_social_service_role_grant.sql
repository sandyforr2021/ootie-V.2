-- OOTIE Personal Baseline 023 - Development social seed/smoke grant
-- Keeps the canonical Development seed and remote smoke workflow repeatable.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('public.ootie_profile_follows') IS NULL THEN
    RAISE EXCEPTION '023 prerequisite missing: ootie_profile_follows';
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.ootie_profile_follows
TO service_role;

COMMIT;
