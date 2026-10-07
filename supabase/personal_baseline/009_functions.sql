-- SUPABASE-MIGRATION-06 | EVIDENCE-BASED PERSONAL BASELINE | LOCAL DRAFT
-- Target intent: OOTIE-sandy-dev. No SQL in this package has been executed.
-- Three evidenced RPCs, two evidenced trigger functions and their 25 exported EXECUTE grants.
-- Read README.md and STATIC_VALIDATION_REPORT.md before any future execution.
-- Separate baseline: never combine with supabase/migrations/20260924_ootie_bookmarks.sql.

BEGIN;
SET LOCAL search_path = pg_catalog, public;

-- Readable DDL: TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv data record 39.
-- security_definer=f (invoker); function-level config/search_path=NULL.
-- CREATE only is intentional for a fresh baseline; body/signature remain unchanged.
-- PERSONAL_FIX: owner_id stores ootie_profiles.id, so auth.uid() resolves through user_id.
CREATE FUNCTION public.get_closet_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  with visible_items as (
    select primary_color, style, category, color_hex
    from public.ootie_clothing_items
    where owner_id = (
      select p.id
      from public.ootie_profiles p
      where p.user_id = (select auth.uid())
    )
      and coalesce(hidden, false) = false
  ),
  -- 1. 顏色統計 (先 Group BY 再轉 JSON)
  grouped_colors as (
    select 
      primary_color as color,
      coalesce(min(color_hex), '#D8D2C8') as color_hex,
      count(*) as item_count
    from visible_items
    where nullif(primary_color, '') is not null
    group by primary_color
  ),
  color_stats as (
    select jsonb_agg(jsonb_build_object(
      'color', color,
      'color_hex', color_hex,
      'count', item_count
    ) order by item_count desc) as value
    from grouped_colors
  ),
  -- 2. 風格統計 (先 Group BY 再轉 JSON)
  grouped_styles as (
    select 
      style,
      count(*) as item_count
    from visible_items
    where nullif(style, '') is not null
    group by style
  ),
  style_stats as (
    select jsonb_agg(jsonb_build_object(
      'style', style,
      'count', item_count
    ) order by item_count desc) as value
    from grouped_styles
  ),
  -- 3. 分類統計 (先 Group BY 再轉 JSON)
  grouped_categories as (
    select 
      category,
      count(*) as item_count
    from visible_items
    where nullif(category, '') is not null
    group by category
  ),
  category_stats as (
    select jsonb_agg(jsonb_build_object(
      'category', category,
      'count', item_count
    ) order by item_count desc) as value
    from grouped_categories
  )
  select jsonb_build_object(
    'colorStats', coalesce((select value from color_stats), '[]'::jsonb),
    'styleStats', coalesce((select value from style_stats), '[]'::jsonb),
    'categoryStats', coalesce((select value from category_stats), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.get_closet_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_closet_stats() TO authenticated, service_role;

-- Readable DDL: TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv data record 38.
-- security_definer=f (invoker); function-level config/search_path=NULL.
-- CREATE only is intentional for a fresh baseline.
-- PERSONAL_FIX: stats are scoped to the authenticated OOTIE profile; shared/public closet items must not pollute personal analytics.
CREATE FUNCTION public.get_brand_stats()
 RETURNS TABLE(brand text, item_count bigint, total_wear_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  with normalized_brands as (
    select
      lower(nullif(trim(brand), '')) as brand_key,
      nullif(trim(brand), '') as display_brand,
      coalesce(wear_count, 0)::bigint as wear_count
    from public.ootie_clothing_items
    where owner_id = (
      select p.id
      from public.ootie_profiles p
      where p.user_id = (select auth.uid())
    )
      and coalesce(hidden, false) = false
  )
  select
    coalesce(min(display_brand), '未分類') as brand,
    count(*)::bigint as item_count,
    sum(wear_count)::bigint as total_wear_count
  from normalized_brands
  group by brand_key
  order by item_count desc, total_wear_count desc
  limit 10;
$function$;

REVOKE ALL ON FUNCTION public.get_brand_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_brand_stats() TO authenticated, service_role;

-- Readable DDL: TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv data record 40.
-- security_definer=f (invoker); function-level config/search_path=NULL.
-- CREATE only is intentional for a fresh baseline.
-- PERSONAL_FIX: stats are scoped to the authenticated OOTIE profile.
-- PERSONAL_BASELINE_COMPATIBILITY_FIX: exported return contract is wear_count integer,
-- while the exported table column is bigint. Explicit cast is required for this SQL
-- function's declared return row; this is a documented deviation from the team body.
-- TODO / UNKNOWN: bigint values outside integer range would raise at call time.
CREATE FUNCTION public.get_disused_items()
 RETURNS TABLE(id uuid, name text, name_zh text, photo text, last_worn text, wear_count integer)
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  select id, name, name_zh, photo, last_worn, wear_count::integer
  from public.ootie_clothing_items
  where owner_id = (
      select p.id
      from public.ootie_profiles p
      where p.user_id = (select auth.uid())
    )
    and coalesce(hidden, false) = false
    and (
      (nullif(last_worn, '') is not null and last_worn::date < current_date - 30)
      or wear_count < 2
      or (nullif(last_worn, '') is null and coalesce(wear_count, 0) = 0)
    )
  order by last_worn is not null, last_worn asc nulls first, wear_count asc;
$function$;

REVOKE ALL ON FUNCTION public.get_disused_items() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_disused_items() TO authenticated, service_role;

-- Readable DDL: TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv data record 91.
-- security_definer=f (invoker); function-level config/search_path=NULL.
-- CREATE only is intentional for a fresh baseline; body/signature remain unchanged.
CREATE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;

-- Readable DDL: TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv data record 111.
-- security_definer=f (invoker); function-level config/search_path=NULL.
-- CREATE only is intentional for a fresh baseline; body/signature remain unchanged.
CREATE FUNCTION public.update_ootie_bookmarks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.update_ootie_bookmarks_updated_at() FROM PUBLIC, anon, authenticated, service_role;

-- FRONTEND_DEPENDENCY_MISSING: get_top_worn_items; get_cost_per_wear_ranking.
-- Neither function is created; legacy SQL is not a deployment source.
-- TODO / UNKNOWN: original function owner, default ACLs, effective caller search_path and table/schema grants.
-- service_role above is an exported SQL role name, not a credential; no key is loaded or used.
-- No guessed OWNER, REVOKE, role creation or table privilege is emitted.

COMMIT;
