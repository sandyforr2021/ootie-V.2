-- SUPABASE-MIGRATION-06 | EVIDENCE-BASED PERSONAL BASELINE | LOCAL DRAFT
-- Target intent: OOTIE-sandy-dev. No SQL in this package has been executed.
-- Prerequisites only; no guessed extension namespace or platform object creation.
-- Read README.md and STATIC_VALIDATION_REPORT.md before any future execution.
-- Separate baseline: never combine with supabase/migrations/20260924_ootie_bookmarks.sql.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

-- Evidence: pg_stat_statements; version=1.11
-- Evidence: pgcrypto; version=1.3
-- Evidence: plpgsql; version=1.0
-- Evidence: supabase_vault; version=0.3.1
-- Evidence: uuid-ossp; version=1.1
-- Evidence: vector; version=0.8.2
-- TODO / UNKNOWN: extension namespaces and target platform defaults are not exported.
-- No CREATE EXTENSION is emitted. The six installed team extensions are not all OOTIE dependencies.
-- pgcrypto is named by existing repository SQL; plpgsql is used by the two trigger functions.
-- gen_random_uuid() availability is checked without claiming which extension owns it.
-- AUTH_PROFILE_CREATION = UNCONFIRMED. No auth.users trigger is created.
DO $prerequisites$
BEGIN
  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'BASELINE_PREREQUISITE_MISSING: gen_random_uuid()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_language WHERE lanname = 'plpgsql') THEN
    RAISE EXCEPTION 'BASELINE_PREREQUISITE_MISSING: plpgsql';
  END IF;
  IF to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR to_regprocedure('auth.role()') IS NULL
     OR to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'BASELINE_PREREQUISITE_MISSING: Supabase-managed Auth/Storage objects';
  END IF;
END;
$prerequisites$;

COMMIT;
