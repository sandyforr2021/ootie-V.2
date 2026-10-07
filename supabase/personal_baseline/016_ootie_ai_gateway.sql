-- OOTIE PERSONAL MIGRATION 016
-- Scope: private AI media, server-owned AI usage ledger, quota/idempotency claim.
-- Applied to the isolated OOTIE-personal-dev project on 2026-09-30.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('public.ootie_profiles') IS NULL
     OR to_regclass('public.ootie_clothing_items') IS NULL
     OR to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION '016 prerequisite missing: profile, clothing, or Storage object';
  END IF;

  IF to_regclass('public.ootie_ai_generations') IS NOT NULL
     OR to_regprocedure('public.claim_ootie_ai_generation(uuid,uuid,text,text,text,uuid[],integer,text)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ootie-ai-private') THEN
    RAISE EXCEPTION '016 object collision: AI ledger, claim function, or private bucket already exists';
  END IF;
END;
$$;

CREATE TABLE public.ootie_ai_generations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type text NOT NULL
    CHECK (generation_type IN ('styling', 'single_try_on', 'outfit_preview')),
  provider text NOT NULL CHECK (provider = 'google_cloud'),
  model text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'rejected')),
  source_item_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  person_image_path text,
  result_path text CHECK (result_path IS NULL OR result_path !~* '^data:'),
  result_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(result_metadata) = 'object')
    CHECK (result_metadata::text !~* 'data:image'),
  estimated_cost_usd numeric(12, 6)
    CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  saved_at timestamptz,
  error_code text
);

CREATE INDEX ootie_ai_generations_user_created_idx
  ON public.ootie_ai_generations (user_id, created_at DESC);

CREATE INDEX ootie_ai_generations_daily_image_quota_idx
  ON public.ootie_ai_generations (user_id, generation_type, created_at)
  WHERE generation_type IN ('single_try_on', 'outfit_preview');

COMMENT ON TABLE public.ootie_ai_generations IS
  'Server-owned OOTIE AI usage ledger. Stores private Storage paths and metadata only; never generated image Base64 or credentials.';

ALTER TABLE public.ootie_ai_generations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ootie_ai_generations FROM anon, authenticated;
GRANT SELECT ON TABLE public.ootie_ai_generations TO authenticated;

CREATE POLICY "AI generations select own"
  ON public.ootie_ai_generations
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ootie-ai-private',
  'ootie-ai-private',
  false,
  7340032,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
);

-- Gateway uploads with the server-only service role. Browsers receive read-only
-- access to their own private paths and can never make an object public.
CREATE POLICY ootie_ai_private_owner_select
ON storage.objects AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  bucket_id = 'ootie-ai-private'
  AND split_part(name, '/', 1) IN ('person', 'ai-generated')
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

CREATE FUNCTION public.claim_ootie_ai_generation(
  p_generation_id uuid,
  p_user_id uuid,
  p_generation_type text,
  p_provider text,
  p_model text,
  p_source_item_ids uuid[],
  p_daily_limit integer,
  p_quota_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_status text;
  quota_used integer := 0;
  local_day date;
BEGIN
  IF p_generation_type NOT IN ('styling', 'single_try_on', 'outfit_preview')
     OR p_provider <> 'google_cloud'
     OR p_daily_limit < 1
     OR p_model IS NULL
     OR btrim(p_model) = '' THEN
    RAISE EXCEPTION 'OOTIE_AI_INVALID_CLAIM'
      USING ERRCODE = '22023';
  END IF;

  local_day := pg_catalog.timezone(p_quota_timezone, pg_catalog.now())::date;

  -- Serialize claims for one user/day so concurrent clicks cannot cross quota.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_quota_timezone || ':' || local_day::text, 0)
  );

  SELECT generation.status
    INTO existing_status
  FROM public.ootie_ai_generations AS generation
  WHERE generation.id = p_generation_id
    AND generation.user_id = p_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'DUPLICATE',
      'status', existing_status
    );
  END IF;

  IF p_generation_type IN ('single_try_on', 'outfit_preview') THEN
    SELECT count(*)::integer
      INTO quota_used
    FROM public.ootie_ai_generations AS generation
    WHERE generation.user_id = p_user_id
      AND generation.generation_type IN ('single_try_on', 'outfit_preview')
      AND pg_catalog.timezone(p_quota_timezone, generation.created_at)::date = local_day;

    IF quota_used >= p_daily_limit THEN
      RETURN jsonb_build_object(
        'claimed', false,
        'reason', 'QUOTA_EXCEEDED',
        'quotaUsed', quota_used,
        'quotaLimit', p_daily_limit
      );
    END IF;
  END IF;

  INSERT INTO public.ootie_ai_generations (
    id,
    user_id,
    generation_type,
    provider,
    model,
    status,
    source_item_ids
  ) VALUES (
    p_generation_id,
    p_user_id,
    p_generation_type,
    p_provider,
    p_model,
    'pending',
    COALESCE(p_source_item_ids, '{}'::uuid[])
  );

  RETURN jsonb_build_object(
    'claimed', true,
    'status', 'pending',
    'quotaUsed', quota_used + CASE WHEN p_generation_type IN ('single_try_on', 'outfit_preview') THEN 1 ELSE 0 END,
    'quotaLimit', p_daily_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ootie_ai_generation(uuid,uuid,text,text,text,uuid[],integer,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ootie_ai_generation(uuid,uuid,text,text,text,uuid[],integer,text)
  TO service_role;

COMMIT;
