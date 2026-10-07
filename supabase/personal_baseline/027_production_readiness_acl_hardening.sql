-- OOTIE Personal Baseline 027 - production-readiness ACL hardening.
-- Trigger-only SECURITY DEFINER functions must not be callable as public RPCs.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regprocedure('public.validate_ootie_saved_outfit_target()') IS NULL
     OR to_regprocedure('public.guard_ootie_ootd_item_ownership()') IS NULL THEN
    RAISE EXCEPTION '027 prerequisite missing: saved-outfit or OOTD trigger function';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_ootie_saved_outfit_target()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_ootie_ootd_item_ownership()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
