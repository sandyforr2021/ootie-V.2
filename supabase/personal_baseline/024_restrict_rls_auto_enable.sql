-- OOTIE Personal Development baseline
-- Keep the project-level RLS helper out of the exposed API execution surface.
-- The helper is not an application RPC and should only be callable by the
-- privileged service role when it exists in the target project.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
  END IF;
END;
$$;

COMMIT;
