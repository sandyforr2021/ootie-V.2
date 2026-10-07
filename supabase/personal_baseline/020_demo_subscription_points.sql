-- OOTIE PERSONAL MIGRATION 020
-- Development Demo subscription and points integration.
-- No real payment provider, card data, billing webhook, or Production object.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('public.ootie_profiles') IS NULL
     OR to_regclass('public.ootie_profile_private') IS NULL
     OR to_regclass('public.ootie_point_transactions') IS NULL
     OR to_regclass('public.ootie_ai_generations') IS NULL THEN
    RAISE EXCEPTION '020 prerequisite missing';
  END IF;
  IF to_regclass('public.ootie_demo_subscriptions') IS NOT NULL THEN
    RAISE EXCEPTION '020 object collision: ootie_demo_subscriptions already exists';
  END IF;
END;
$$;

ALTER TABLE public.ootie_point_transactions
  DROP CONSTRAINT ootie_point_transactions_type_check,
  ADD CONSTRAINT ootie_point_transactions_type_check
  CHECK (type IN (
    'BIRTHDAY_BONUS',
    'AI_USAGE',
    'TRYON_USAGE',
    'MANUAL_ADJUSTMENT',
    'SUBSCRIPTION_GRANT',
    'CREDIT_PURCHASE',
    'PROMOTIONAL_REWARD'
  ));

ALTER TABLE public.ootie_ai_generations
  ADD COLUMN points_charged integer NOT NULL DEFAULT 0 CHECK (points_charged >= 0),
  ADD COLUMN point_transaction_id uuid REFERENCES public.ootie_point_transactions(id) ON DELETE SET NULL;

CREATE TABLE public.ootie_demo_subscriptions (
  profile_id uuid PRIMARY KEY REFERENCES public.ootie_profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PLUS', 'PRO')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
  monthly_points integer NOT NULL DEFAULT 10 CHECK (monthly_points >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Development seed runner uses the existing server-only service role. These
-- grants are intentionally confined to the isolated Demo migration and must
-- not be promoted to Production without replacing the seed workflow.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ootie_profiles,
  public.ootie_profile_private,
  public.ootie_clothing_items,
  public.ootie_ootd_posts,
  public.ootie_sos_posts,
  public.ootie_outfit_suggestions,
  public.ootie_notifications,
  public.ootie_post_likes,
  public.ootie_saved_posts,
  public.ootie_point_transactions,
  public.ootie_ai_generations,
  public.ootie_demo_subscriptions
TO service_role;

ALTER TABLE public.ootie_demo_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ootie_demo_subscriptions FROM anon, authenticated;
GRANT SELECT ON TABLE public.ootie_demo_subscriptions TO authenticated;

CREATE POLICY ootie_demo_subscriptions_select_own
ON public.ootie_demo_subscriptions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ootie_profiles AS p
    WHERE p.id = ootie_demo_subscriptions.profile_id
      AND p.user_id = (SELECT auth.uid())
  )
);

CREATE TRIGGER trg_touch_ootie_demo_subscriptions
BEFORE UPDATE ON public.ootie_demo_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.ootie_my_point_balance()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(sum(t.amount), 0)::integer
  FROM public.ootie_point_transactions AS t
  JOIN public.ootie_profiles AS p ON p.id = t.profile_id
  WHERE p.user_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.ootie_my_point_balance() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ootie_my_point_balance() TO authenticated;

CREATE FUNCTION public.ootie_demo_subscribe(p_plan text, p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_points integer;
  v_inserted integer := 0;
  v_balance integer;
BEGIN
  IF p_plan NOT IN ('FREE', 'PLUS', 'PRO') OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'OOTIE_DEMO_SUBSCRIPTION_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT p.id INTO v_profile_id FROM public.ootie_profiles AS p
  WHERE p.user_id = (SELECT auth.uid());
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'OOTIE_PROFILE_REQUIRED' USING ERRCODE = 'P0001'; END IF;

  v_points := CASE p_plan WHEN 'FREE' THEN 10 WHEN 'PLUS' THEN 50 ELSE 120 END;
  INSERT INTO public.ootie_demo_subscriptions (profile_id, plan, status, monthly_points)
  VALUES (v_profile_id, p_plan, 'ACTIVE', v_points)
  ON CONFLICT (profile_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'ACTIVE', monthly_points = EXCLUDED.monthly_points;

  INSERT INTO public.ootie_point_transactions (profile_id, amount, type, source_key, metadata)
  VALUES (
    v_profile_id, v_points, 'SUBSCRIPTION_GRANT',
    'demo-subscription:' || p_operation_id::text,
    jsonb_build_object('plan', p_plan, 'demo', true, 'operationId', p_operation_id)
  ) ON CONFLICT (profile_id, source_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  SELECT COALESCE(sum(amount), 0)::integer INTO v_balance
  FROM public.ootie_point_transactions WHERE profile_id = v_profile_id;
  RETURN jsonb_build_object('plan', p_plan, 'status', 'ACTIVE', 'granted', v_inserted = 1, 'balance', v_balance, 'demo', true);
END;
$$;

CREATE FUNCTION public.ootie_demo_cancel_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_profile_id uuid;
BEGIN
  SELECT p.id INTO v_profile_id FROM public.ootie_profiles AS p WHERE p.user_id = (SELECT auth.uid());
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'OOTIE_PROFILE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.ootie_demo_subscriptions SET status = 'CANCELLED' WHERE profile_id = v_profile_id;
  RETURN jsonb_build_object('status', 'CANCELLED', 'demo', true);
END;
$$;

CREATE FUNCTION public.ootie_demo_purchase_credits(p_pack text, p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_points integer;
  v_inserted integer := 0;
  v_balance integer;
BEGIN
  IF p_pack NOT IN ('STARTER', 'STYLE', 'STUDIO') OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'OOTIE_DEMO_CREDIT_PACK_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT p.id INTO v_profile_id FROM public.ootie_profiles AS p WHERE p.user_id = (SELECT auth.uid());
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'OOTIE_PROFILE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  v_points := CASE p_pack WHEN 'STARTER' THEN 20 WHEN 'STYLE' THEN 60 ELSE 150 END;
  INSERT INTO public.ootie_point_transactions (profile_id, amount, type, source_key, metadata)
  VALUES (
    v_profile_id, v_points, 'CREDIT_PURCHASE',
    'demo-credit:' || p_operation_id::text,
    jsonb_build_object('pack', p_pack, 'demo', true, 'operationId', p_operation_id)
  ) ON CONFLICT (profile_id, source_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  SELECT COALESCE(sum(amount), 0)::integer INTO v_balance
  FROM public.ootie_point_transactions WHERE profile_id = v_profile_id;
  RETURN jsonb_build_object('pack', p_pack, 'granted', v_inserted = 1, 'balance', v_balance, 'demo', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ootie_demo_subscribe(text,uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.ootie_demo_cancel_subscription() FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.ootie_demo_purchase_credits(text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ootie_demo_subscribe(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ootie_demo_cancel_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ootie_demo_purchase_credits(text,uuid) TO authenticated;

CREATE FUNCTION public.grant_ootie_birthday_points(p_user_id uuid, p_award_year integer, p_amount integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_birth_date date;
  v_inserted integer := 0;
BEGIN
  IF p_award_year < 2020 OR p_award_year > 2200 OR p_amount < 1 THEN
    RAISE EXCEPTION 'OOTIE_BIRTHDAY_GRANT_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT p.id, pp.birth_date INTO v_profile_id, v_birth_date
  FROM public.ootie_profiles AS p
  JOIN public.ootie_profile_private AS pp ON pp.profile_id = p.id
  WHERE p.user_id = p_user_id;
  IF v_profile_id IS NULL OR v_birth_date IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'BIRTH_DATE_REQUIRED');
  END IF;
  INSERT INTO public.ootie_point_transactions (profile_id, amount, type, source_key, metadata)
  VALUES (
    v_profile_id, p_amount, 'BIRTHDAY_BONUS', 'birthday:' || p_award_year::text,
    jsonb_build_object('label', '生日點數', 'awardYear', p_award_year)
  ) ON CONFLICT (profile_id, source_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object('granted', v_inserted = 1, 'sourceKey', 'birthday:' || p_award_year::text);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ootie_birthday_points(uuid,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ootie_birthday_points(uuid,integer,integer) TO service_role;

CREATE FUNCTION public.claim_ootie_ai_generation_with_points(
  p_generation_id uuid,
  p_user_id uuid,
  p_generation_type text,
  p_provider text,
  p_model text,
  p_source_item_ids uuid[],
  p_daily_limit integer,
  p_quota_timezone text,
  p_points_cost integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_status text;
  v_quota_used integer := 0;
  v_local_day date;
  v_profile_id uuid;
  v_balance integer := 0;
BEGIN
  IF p_generation_type NOT IN ('styling', 'single_try_on', 'outfit_preview')
     OR p_provider <> 'google_cloud' OR p_daily_limit < 1 OR p_points_cost < 0
     OR p_model IS NULL OR btrim(p_model) = '' THEN
    RAISE EXCEPTION 'OOTIE_AI_INVALID_CLAIM' USING ERRCODE = '22023';
  END IF;
  v_local_day := pg_catalog.timezone(p_quota_timezone, pg_catalog.now())::date;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_quota_timezone || ':' || v_local_day::text, 0));
  SELECT generation.status INTO v_existing_status
  FROM public.ootie_ai_generations AS generation
  WHERE generation.id = p_generation_id AND generation.user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'DUPLICATE', 'status', v_existing_status);
  END IF;
  IF p_generation_type IN ('single_try_on', 'outfit_preview') THEN
    SELECT p.id INTO v_profile_id FROM public.ootie_profiles AS p WHERE p.user_id = p_user_id;
    SELECT COALESCE(sum(t.amount), 0)::integer INTO v_balance
    FROM public.ootie_point_transactions AS t WHERE t.profile_id = v_profile_id;
    IF v_balance < p_points_cost THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'INSUFFICIENT_POINTS', 'balance', v_balance, 'required', p_points_cost);
    END IF;
    SELECT count(*)::integer INTO v_quota_used
    FROM public.ootie_ai_generations AS generation
    WHERE generation.user_id = p_user_id
      AND generation.generation_type IN ('single_try_on', 'outfit_preview')
      AND pg_catalog.timezone(p_quota_timezone, generation.created_at)::date = v_local_day;
    IF v_quota_used >= p_daily_limit THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'QUOTA_EXCEEDED', 'quotaUsed', v_quota_used, 'quotaLimit', p_daily_limit);
    END IF;
  END IF;
  INSERT INTO public.ootie_ai_generations (id,user_id,generation_type,provider,model,status,source_item_ids)
  VALUES (p_generation_id,p_user_id,p_generation_type,p_provider,p_model,'pending',COALESCE(p_source_item_ids,'{}'::uuid[]));
  RETURN jsonb_build_object('claimed', true, 'status', 'pending', 'quotaUsed', v_quota_used + CASE WHEN p_generation_type IN ('single_try_on','outfit_preview') THEN 1 ELSE 0 END, 'quotaLimit', p_daily_limit, 'pointBalance', v_balance);
END;
$$;

CREATE FUNCTION public.debit_ootie_ai_points(p_generation_id uuid, p_user_id uuid, p_points_cost integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_type text;
  v_status text;
  v_balance integer;
  v_transaction_id uuid;
BEGIN
  IF p_points_cost < 0 THEN RAISE EXCEPTION 'OOTIE_AI_POINTS_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT p.id INTO v_profile_id FROM public.ootie_profiles AS p WHERE p.user_id = p_user_id;
  SELECT g.generation_type, g.status INTO v_type, v_status
  FROM public.ootie_ai_generations AS g WHERE g.id = p_generation_id AND g.user_id = p_user_id FOR UPDATE;
  IF v_profile_id IS NULL OR v_type NOT IN ('single_try_on','outfit_preview') OR v_status NOT IN ('pending','processing') THEN
    RAISE EXCEPTION 'OOTIE_AI_POINTS_GENERATION_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT id INTO v_transaction_id FROM public.ootie_point_transactions
  WHERE profile_id = v_profile_id AND source_key = 'ai-generation:' || p_generation_id::text;
  IF v_transaction_id IS NOT NULL THEN
    RETURN jsonb_build_object('debited', false, 'reason', 'DUPLICATE', 'transactionId', v_transaction_id);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('points:' || v_profile_id::text, 0));
  SELECT COALESCE(sum(amount), 0)::integer INTO v_balance FROM public.ootie_point_transactions WHERE profile_id = v_profile_id;
  IF v_balance < p_points_cost THEN
    RETURN jsonb_build_object('debited', false, 'reason', 'INSUFFICIENT_POINTS', 'balance', v_balance, 'required', p_points_cost);
  END IF;
  INSERT INTO public.ootie_point_transactions (profile_id,amount,type,source_key,metadata)
  VALUES (v_profile_id,-p_points_cost,CASE WHEN v_type='single_try_on' THEN 'TRYON_USAGE' ELSE 'AI_USAGE' END,'ai-generation:' || p_generation_id::text,jsonb_build_object('generationId',p_generation_id,'generationType',v_type))
  RETURNING id INTO v_transaction_id;
  UPDATE public.ootie_ai_generations SET points_charged=p_points_cost, point_transaction_id=v_transaction_id WHERE id=p_generation_id;
  RETURN jsonb_build_object('debited', true, 'transactionId', v_transaction_id, 'balance', v_balance-p_points_cost);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ootie_ai_generation_with_points(uuid,uuid,text,text,text,uuid[],integer,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debit_ootie_ai_points(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ootie_ai_generation_with_points(uuid,uuid,text,text,text,uuid[],integer,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_ootie_ai_points(uuid,uuid,integer) TO service_role;

COMMIT;
