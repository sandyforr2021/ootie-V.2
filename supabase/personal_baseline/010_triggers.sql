-- SUPABASE-MIGRATION-06 | EVIDENCE-BASED PERSONAL BASELINE | LOCAL DRAFT
-- Target intent: OOTIE-sandy-dev. No SQL in this package has been executed.
-- Both evidenced BEFORE UPDATE bookmark triggers are retained.
-- SUPABASE-AUTH-IDENTITY-09 adds prospective OOTIE profile provisioning for new Auth users only.
-- Read README.md and STATIC_VALIDATION_REPORT.md before any future execution.
-- Separate baseline: never combine with supabase/migrations/20260924_ootie_bookmarks.sql.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

CREATE FUNCTION public.handle_new_ootie_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.ootie_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_ootie_user() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER on_auth_user_created_ootie_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_ootie_user();

-- No bulk INSERT ... SELECT from auth.users is present. Existing unrelated Auth users are untouched.
-- No Supabase-managed Storage trigger is recreated.

CREATE TRIGGER ootie_bookmarks_set_updated_at BEFORE UPDATE ON public.ootie_bookmarks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_ootie_bookmarks_updated_at BEFORE UPDATE ON public.ootie_bookmarks FOR EACH ROW EXECUTE FUNCTION public.update_ootie_bookmarks_updated_at();

COMMIT;
