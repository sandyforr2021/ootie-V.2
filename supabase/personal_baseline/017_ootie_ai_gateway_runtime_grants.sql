-- OOTIE PERSONAL MIGRATION 017
-- Scope: least-privilege Data API grants required by the Cloud Run AI Gateway.
-- The service role bypasses RLS but still needs explicit table privileges.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('public.ootie_profiles') IS NULL
     OR to_regclass('public.ootie_clothing_items') IS NULL
     OR to_regclass('public.ootie_ai_generations') IS NULL
     OR to_regprocedure('public.claim_ootie_ai_generation(uuid,uuid,text,text,text,uuid[],integer,text)') IS NULL THEN
    RAISE EXCEPTION '017 prerequisite missing: profiles, clothing, AI ledger, or claim function';
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON TABLE
  public.ootie_profiles,
  public.ootie_clothing_items,
  public.ootie_ai_generations
TO service_role;

GRANT UPDATE ON TABLE public.ootie_ai_generations TO service_role;

COMMIT;
