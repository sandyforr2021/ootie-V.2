-- SUPABASE-BASELINE-BATCH-12 | FINAL READ-ONLY AFTER CHECK
-- Run only after the authorized 003-012 batch completes in OOTIE-sandy-dev.
-- This file contains SELECT statements only. It never creates, alters, deletes,
-- inserts, updates, resets, or calls an RPC.

-- 1. Tables: expected / actual / missing / unexpected.
WITH expected(object_name) AS (VALUES
  ('public.ootie_profiles'),
  ('public.ootie_clothing_items'),
  ('public.ootie_ootd_posts'),
  ('public.ootie_sos_posts'),
  ('public.ootie_outfit_suggestions'),
  ('public.ootie_notifications'),
  ('public.ootie_post_likes'),
  ('public.ootie_saved_posts'),
  ('public.ootie_bookmarks')
),
actual(object_name) AS (
  SELECT n.nspname || '.' || c.relname
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'ootie_%'
),
comparison AS (
  SELECT e.object_name AS expected_name, a.object_name AS actual_name
  FROM expected e FULL OUTER JOIN actual a USING (object_name)
)
SELECT
  'TABLES' AS object_group,
  (SELECT count(*) FROM expected) AS expected_object_count,
  (SELECT count(*) FROM actual) AS actual_object_count,
  COALESCE((SELECT string_agg(expected_name, ', ' ORDER BY expected_name) FROM comparison WHERE actual_name IS NULL), '') AS missing,
  COALESCE((SELECT string_agg(actual_name, ', ' ORDER BY actual_name) FROM comparison WHERE expected_name IS NULL), '') AS unexpected,
  CASE WHEN EXISTS (SELECT 1 FROM comparison WHERE expected_name IS NULL OR actual_name IS NULL) THEN 'MISMATCH' ELSE 'PASS' END AS status;

-- 2. Columns: exact expected names and counts for all nine OOTIE tables.
WITH expected(table_name, column_name) AS (VALUES
  ('ootie_profiles','avatar_url'),('ootie_profiles','bio'),('ootie_profiles','created_at'),('ootie_profiles','hearts'),('ootie_profiles','helped'),('ootie_profiles','id'),('ootie_profiles','initials'),('ootie_profiles','likes'),('ootie_profiles','name'),('ootie_profiles','public_closet'),('ootie_profiles','user_id'),('ootie_profiles','username'),
  ('ootie_clothing_items','brand'),('ootie_clothing_items','category'),('ootie_clothing_items','color_hex'),('ootie_clothing_items','created_at'),('ootie_clothing_items','favorite'),('ootie_clothing_items','hidden'),('ootie_clothing_items','id'),('ootie_clothing_items','last_worn'),('ootie_clothing_items','name'),('ootie_clothing_items','name_zh'),('ootie_clothing_items','notes'),('ootie_clothing_items','owner_id'),('ootie_clothing_items','photo'),('ootie_clothing_items','price'),('ootie_clothing_items','primary_color'),('ootie_clothing_items','purchase_date'),('ootie_clothing_items','season'),('ootie_clothing_items','secondary_color'),('ootie_clothing_items','shape'),('ootie_clothing_items','style'),('ootie_clothing_items','wear_count'),
  ('ootie_ootd_posts','caption'),('ootie_ootd_posts','comments'),('ootie_ootd_posts','created_at'),('ootie_ootd_posts','hashtags'),('ootie_ootd_posts','id'),('ootie_ootd_posts','image'),('ootie_ootd_posts','item_ids'),('ootie_ootd_posts','likes'),('ootie_ootd_posts','user_id'),('ootie_ootd_posts','wearing'),
  ('ootie_sos_posts','closet_item_ids'),('ootie_sos_posts','closet_owner_id'),('ootie_sos_posts','created_at'),('ootie_sos_posts','details'),('ootie_sos_posts','id'),('ootie_sos_posts','liked_suggestion_ids'),('ootie_sos_posts','notes'),('ootie_sos_posts','occasion'),('ootie_sos_posts','picked_suggestion_id'),('ootie_sos_posts','status'),('ootie_sos_posts','title'),('ootie_sos_posts','user_id'),('ootie_sos_posts','vibes'),('ootie_sos_posts','weather'),('ootie_sos_posts','when_label'),
  ('ootie_outfit_suggestions','created_at'),('ootie_outfit_suggestions','hearts'),('ootie_outfit_suggestions','id'),('ootie_outfit_suggestions','item_ids'),('ootie_outfit_suggestions','message'),('ootie_outfit_suggestions','sos_id'),('ootie_outfit_suggestions','user_id'),
  ('ootie_notifications','created_at'),('ootie_notifications','id'),('ootie_notifications','meta'),('ootie_notifications','read'),('ootie_notifications','text'),('ootie_notifications','user_id'),
  ('ootie_post_likes','created_at'),('ootie_post_likes','id'),('ootie_post_likes','post_id'),('ootie_post_likes','user_id'),
  ('ootie_saved_posts','created_at'),('ootie_saved_posts','id'),('ootie_saved_posts','post_id'),('ootie_saved_posts','user_id'),
  ('ootie_bookmarks','brand'),('ootie_bookmarks','color'),('ootie_bookmarks','created_at'),('ootie_bookmarks','currency'),('ootie_bookmarks','description'),('ootie_bookmarks','id'),('ootie_bookmarks','image_storage_path'),('ootie_bookmarks','image_url'),('ootie_bookmarks','notes'),('ootie_bookmarks','owner_id'),('ootie_bookmarks','price'),('ootie_bookmarks','product_url'),('ootie_bookmarks','size'),('ootie_bookmarks','source_domain'),('ootie_bookmarks','title'),('ootie_bookmarks','updated_at'),('ootie_bookmarks','variant_name')
),
actual AS (
  SELECT c.relname AS table_name, a.attname AS column_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public' AND c.relname LIKE 'ootie_%' AND a.attnum > 0 AND NOT a.attisdropped
),
comparison AS (
  SELECT e.table_name AS expected_table, e.column_name AS expected_column,
         a.table_name AS actual_table, a.column_name AS actual_column
  FROM expected e FULL OUTER JOIN actual a
    ON a.table_name = e.table_name AND a.column_name = e.column_name
)
SELECT
  'COLUMNS' AS object_group,
  (SELECT count(*) FROM expected) AS expected_object_count,
  (SELECT count(*) FROM actual) AS actual_object_count,
  COALESCE((SELECT string_agg(expected_table || '.' || expected_column, ', ' ORDER BY expected_table, expected_column) FROM comparison WHERE actual_column IS NULL), '') AS missing,
  COALESCE((SELECT string_agg(actual_table || '.' || actual_column, ', ' ORDER BY actual_table, actual_column) FROM comparison WHERE expected_column IS NULL), '') AS unexpected,
  CASE WHEN EXISTS (SELECT 1 FROM comparison WHERE expected_column IS NULL OR actual_column IS NULL) THEN 'MISMATCH' ELSE 'PASS' END AS status;

-- 3. Column types, nullability, and defaults (review the complete result set).
SELECT
  n.nspname || '.' || c.relname || '.' || a.attname AS object_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
  NOT a.attnotnull AS is_nullable,
  pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relname LIKE 'ootie_%' AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

-- 4. Constraints: profiles plus all 003-008 table constraints.
WITH expected(constraint_name) AS (VALUES
  ('profiles_pkey'),('ootie_profiles_user_id_key'),('ootie_profiles_user_id_fkey'),
  ('ootie_clothing_items_pkey'),('ootie_clothing_items_owner_id_fkey'),
  ('ootie_ootd_posts_pkey'),('ootie_ootd_posts_user_id_fkey'),
  ('ootie_sos_posts_pkey'),('ootie_sos_posts_status_check'),('ootie_sos_posts_user_id_fkey'),('ootie_sos_posts_closet_owner_id_fkey'),
  ('ootie_outfit_suggestions_pkey'),('ootie_outfit_suggestions_sos_id_fkey'),('ootie_outfit_suggestions_user_id_fkey'),
  ('ootie_notifications_pkey'),('ootie_notifications_user_id_fkey'),
  ('ootie_post_likes_pkey'),('ootie_post_likes_post_id_fkey'),('ootie_post_likes_user_id_fkey'),
  ('ootie_saved_posts_pkey'),('ootie_saved_posts_post_id_fkey'),('ootie_saved_posts_user_id_fkey'),
  ('ootie_bookmarks_pkey'),('ootie_bookmarks_owner_id_fk')
),
actual AS (
  SELECT c.conname AS constraint_name
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname LIKE 'ootie_%'
     OR c.conname IN ('profiles_pkey','ootie_profiles_user_id_key','ootie_profiles_user_id_fkey')
),
comparison AS (
  SELECT e.constraint_name AS expected_name, a.constraint_name AS actual_name
  FROM expected e FULL OUTER JOIN actual a USING (constraint_name)
)
SELECT
  'CONSTRAINTS' AS object_group,
  (SELECT count(*) FROM expected) AS expected_object_count,
  (SELECT count(*) FROM actual) AS actual_object_count,
  COALESCE((SELECT string_agg(expected_name, ', ' ORDER BY expected_name) FROM comparison WHERE actual_name IS NULL), '') AS missing,
  COALESCE((SELECT string_agg(actual_name, ', ' ORDER BY actual_name) FROM comparison WHERE expected_name IS NULL), '') AS unexpected,
  CASE WHEN EXISTS (SELECT 1 FROM comparison WHERE expected_name IS NULL OR actual_name IS NULL) THEN 'MISMATCH' ELSE 'PASS' END AS status;

-- 5. Constraint definitions and FK delete actions.
SELECT
  n.nspname || '.' || t.relname || '.' || c.conname AS constraint_name,
  c.contype,
  pg_catalog.pg_get_constraintdef(c.oid, true) AS definition,
  CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS delete_action
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND (t.relname LIKE 'ootie_%' OR c.conname IN ('profiles_pkey','ootie_profiles_user_id_key','ootie_profiles_user_id_fkey'))
ORDER BY t.relname, c.conname;

-- 6. Indexes: nine PK indexes plus three explicit bookmark indexes.
WITH expected(index_name) AS (VALUES
  ('profiles_pkey'),('ootie_clothing_items_pkey'),('ootie_ootd_posts_pkey'),('ootie_sos_posts_pkey'),('ootie_outfit_suggestions_pkey'),('ootie_notifications_pkey'),('ootie_post_likes_pkey'),('ootie_saved_posts_pkey'),('ootie_bookmarks_pkey'),
  ('idx_ootie_bookmarks_owner_created_at'),('idx_ootie_bookmarks_owner_updated_at'),('idx_ootie_bookmarks_source_domain')
),
actual AS (
  SELECT i.relname AS index_name
  FROM pg_catalog.pg_class i
  JOIN pg_catalog.pg_namespace n ON n.oid = i.relnamespace
  WHERE n.nspname = 'public' AND (i.relname LIKE 'ootie_%' OR i.relname = 'profiles_pkey')
),
comparison AS (
  SELECT e.index_name AS expected_name, a.index_name AS actual_name
  FROM expected e FULL OUTER JOIN actual a USING (index_name)
)
SELECT
  'INDEXES' AS object_group,
  (SELECT count(*) FROM expected) AS expected_object_count,
  (SELECT count(*) FROM actual) AS actual_object_count,
  COALESCE((SELECT string_agg(expected_name, ', ' ORDER BY expected_name) FROM comparison WHERE actual_name IS NULL), '') AS missing,
  COALESCE((SELECT string_agg(actual_name, ', ' ORDER BY actual_name) FROM comparison WHERE expected_name IS NULL), '') AS unexpected,
  CASE WHEN EXISTS (SELECT 1 FROM comparison WHERE expected_name IS NULL OR actual_name IS NULL) THEN 'MISMATCH' ELSE 'PASS' END AS status;

-- 7. Functions: exact five evidenced signatures only.
WITH expected(object_name) AS (VALUES
  ('public.get_closet_stats()'),('public.get_brand_stats()'),('public.get_disused_items()'),('public.set_updated_at()'),('public.update_ootie_bookmarks_updated_at()')
),
actual(object_name) AS (
  SELECT n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')'
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('get_closet_stats','get_brand_stats','get_disused_items','set_updated_at','update_ootie_bookmarks_updated_at')
),
comparison AS (
  SELECT e.object_name AS expected_name, a.object_name AS actual_name
  FROM expected e FULL OUTER JOIN actual a USING (object_name)
)
SELECT
  'FUNCTIONS' AS object_group,
  (SELECT count(*) FROM expected) AS expected_object_count,
  (SELECT count(*) FROM actual) AS actual_object_count,
  COALESCE((SELECT string_agg(expected_name, ', ' ORDER BY expected_name) FROM comparison WHERE actual_name IS NULL), '') AS missing,
  COALESCE((SELECT string_agg(actual_name, ', ' ORDER BY actual_name) FROM comparison WHERE expected_name IS NULL), '') AS unexpected,
  CASE WHEN EXISTS (SELECT 1 FROM comparison WHERE expected_name IS NULL OR actual_name IS NULL) THEN 'MISMATCH' ELSE 'PASS' END AS status;

-- 8. Function security/config and the profile bridge in get_closet_stats().
SELECT
  n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS function_name,
  p.prosecdef AS security_definer,
  p.proconfig AS config,
  CASE
    WHEN p.proname = 'get_closet_stats'
     AND pg_catalog.pg_get_functiondef(p.oid) ~ $$p\.user_id\s*=\s*auth\.uid\(\)$$
     AND pg_catalog.pg_get_functiondef(p.oid) !~ $$owner_id\s*=\s*auth\.uid\(\)$$ THEN 'PASS'
    WHEN p.proname <> 'get_closet_stats' AND p.prosecdef = false THEN 'PASS'
    ELSE 'MISMATCH'
  END AS status
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('get_closet_stats','get_brand_stats','get_disused_items','set_updated_at','update_ootie_bookmarks_updated_at')
ORDER BY p.proname;

-- 9. Triggers: one new-user trigger and two bookmark update triggers.
WITH expected(trigger_name) AS (VALUES
  ('on_auth_user_created_ootie_profile'),('ootie_bookmarks_set_updated_at'),('set_ootie_bookmarks_updated_at')
),
actual AS (
  SELECT t.tgname AS trigger_name
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal AND ((n.nspname = 'auth' AND c.relname = 'users') OR (n.nspname = 'public' AND c.relname = 'ootie_bookmarks'))
),
comparison AS (
  SELECT e.trigger_name AS expected_name, a.trigger_name AS actual_name
  FROM expected e FULL OUTER JOIN actual a USING (trigger_name)
)
SELECT
  'TRIGGERS' AS object_group,
  (SELECT count(*) FROM expected) AS expected_object_count,
  (SELECT count(*) FROM actual) AS actual_object_count,
  COALESCE((SELECT string_agg(expected_name, ', ' ORDER BY expected_name) FROM comparison WHERE actual_name IS NULL), '') AS missing,
  COALESCE((SELECT string_agg(actual_name, ', ' ORDER BY actual_name) FROM comparison WHERE expected_name IS NULL), '') AS unexpected,
  CASE WHEN EXISTS (SELECT 1 FROM comparison WHERE expected_name IS NULL OR actual_name IS NULL) THEN 'MISMATCH' ELSE 'PASS' END AS status;

SELECT
  n.nspname || '.' || c.relname || '.' || t.tgname AS trigger_name,
  pg_catalog.pg_get_triggerdef(t.oid, true) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND ((n.nspname = 'auth' AND c.relname = 'users') OR (n.nspname = 'public' AND c.relname = 'ootie_bookmarks'))
ORDER BY trigger_name;

-- 10. RLS state: all public OOTIE tables and storage.objects are enabled, not forced.
SELECT
  n.nspname || '.' || c.relname AS object_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE WHEN c.relrowsecurity AND NOT c.relforcerowsecurity THEN 'PASS' ELSE 'MISMATCH' END AS status
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname LIKE 'ootie_%') OR (n.nspname = 'storage' AND c.relname = 'objects')
ORDER BY object_name;

-- 11. RLS policy name inventory: 33 public policies plus 4 Storage policies.
WITH expected(schemaname, tablename, policyname) AS (VALUES
  ('public','ootie_profiles','ootie_profiles_public_select'),('public','ootie_profiles','ootie_profiles_self_insert'),('public','ootie_profiles','ootie_profiles_self_update'),('public','ootie_profiles','ootie_profiles_self_delete'),
  ('public','ootie_clothing_items','ootie_clothing_public_select'),('public','ootie_clothing_items','ootie_clothing_owner_insert'),('public','ootie_clothing_items','ootie_clothing_owner_update'),('public','ootie_clothing_items','ootie_clothing_owner_delete'),
  ('public','ootie_ootd_posts','ootie_ootd_public_select'),('public','ootie_ootd_posts','ootie_ootd_owner_insert'),('public','ootie_ootd_posts','ootie_ootd_owner_update'),('public','ootie_ootd_posts','ootie_ootd_owner_delete'),
  ('public','ootie_sos_posts','ootie_sos_public_select'),('public','ootie_sos_posts','ootie_sos_owner_insert'),('public','ootie_sos_posts','ootie_sos_owner_update'),('public','ootie_sos_posts','ootie_sos_owner_delete'),
  ('public','ootie_outfit_suggestions','ootie_suggestions_public_select'),('public','ootie_outfit_suggestions','ootie_suggestions_owner_insert'),('public','ootie_outfit_suggestions','ootie_suggestions_owner_update'),('public','ootie_outfit_suggestions','ootie_suggestions_owner_delete'),
  ('public','ootie_notifications','ootie_notifications_recipient_select'),('public','ootie_notifications','ootie_notifications_recipient_update'),('public','ootie_notifications','ootie_notifications_recipient_delete'),
  ('public','ootie_post_likes','ootie_post_likes_public_select'),('public','ootie_post_likes','ootie_post_likes_owner_insert'),('public','ootie_post_likes','ootie_post_likes_owner_delete'),
  ('public','ootie_saved_posts','ootie_saved_posts_public_select'),('public','ootie_saved_posts','ootie_saved_posts_owner_insert'),('public','ootie_saved_posts','ootie_saved_posts_owner_delete'),
  ('public','ootie_bookmarks','ootie_bookmarks_owner_select'),('public','ootie_bookmarks','ootie_bookmarks_owner_insert'),('public','ootie_bookmarks','ootie_bookmarks_owner_update'),('public','ootie_bookmarks','ootie_bookmarks_owner_delete'),
  ('storage','objects','ootie_bookmark_images_public_select'),('storage','objects','ootie_bookmark_images_owner_insert'),('storage','objects','ootie_bookmark_images_owner_update'),('storage','objects','ootie_bookmark_images_owner_delete')
),
actual AS (
  SELECT schemaname, tablename, policyname
  FROM pg_catalog.pg_policies
  WHERE (schemaname = 'public' AND tablename LIKE 'ootie_%') OR (schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'ootie_%')
),
comparison AS (
  SELECT e.schemaname AS expected_schema, e.tablename AS expected_table, e.policyname AS expected_name,
         a.schemaname AS actual_schema, a.tablename AS actual_table, a.policyname AS actual_name
  FROM expected e FULL OUTER JOIN actual a
    ON a.schemaname = e.schemaname AND a.tablename = e.tablename AND a.policyname = e.policyname
)
SELECT
  'RLS_POLICIES' AS object_group,
  (SELECT count(*) FROM expected) AS expected_object_count,
  (SELECT count(*) FROM actual) AS actual_object_count,
  COALESCE((SELECT string_agg(expected_schema || '.' || expected_table || '.' || expected_name, ', ' ORDER BY expected_name) FROM comparison WHERE actual_name IS NULL), '') AS missing,
  COALESCE((SELECT string_agg(actual_schema || '.' || actual_table || '.' || actual_name, ', ' ORDER BY actual_name) FROM comparison WHERE expected_name IS NULL), '') AS unexpected,
  CASE WHEN EXISTS (SELECT 1 FROM comparison WHERE expected_name IS NULL OR actual_name IS NULL) THEN 'MISMATCH' ELSE 'PASS' END AS status;

-- 12. Policy command, roles, and security semantics.
SELECT
  schemaname || '.' || tablename || '.' || policyname AS policy_name,
  cmd,
  roles,
  qual,
  with_check,
  CASE
    WHEN policyname LIKE '%owner%' AND (coalesce(qual, '') ~ 'auth\.uid\(\)\s*=\s*(owner_id|user_id)' OR coalesce(with_check, '') ~ 'auth\.uid\(\)\s*=\s*(owner_id|user_id)') THEN 'MISMATCH'
    WHEN schemaname = 'storage' AND policyname LIKE '%owner%' AND (coalesce(qual, '') !~ 'split_part' OR coalesce(with_check, '') !~ 'split_part') THEN 'MISMATCH'
    ELSE 'PASS'
  END AS status
FROM pg_catalog.pg_policies
WHERE (schemaname = 'public' AND tablename LIKE 'ootie_%') OR (schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'ootie_%')
ORDER BY schemaname, tablename, policyname;

-- 13. Storage bucket and path ownership.
SELECT
  'STORAGE_BUCKET' AS object_group,
  1 AS expected_object_count,
  count(*) FILTER (WHERE id = 'ootie-bookmarks-images' AND name = 'ootie-bookmarks-images') AS actual_object_count,
  CASE WHEN count(*) FILTER (WHERE id = 'ootie-bookmarks-images' AND name = 'ootie-bookmarks-images') = 0 THEN 'ootie-bookmarks-images' ELSE '' END AS missing,
  '' AS unexpected,
  CASE WHEN count(*) FILTER (WHERE id = 'ootie-bookmarks-images' AND name = 'ootie-bookmarks-images') = 1 THEN 'PASS' ELSE 'MISMATCH' END AS status
FROM storage.buckets
WHERE id = 'ootie-bookmarks-images' OR name = 'ootie-bookmarks-images';

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'ootie-bookmarks-images' OR name = 'ootie-bookmarks-images';

-- 14. Identity chain and identity-column contract.
WITH checks(check_name, passed) AS (
  SELECT 'auth.users.id exists as uuid primary key', EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_constraint c ON c.conrelid = a.attrelid AND c.contype = 'p' AND c.conkey = ARRAY[a.attnum]::smallint[]
    WHERE a.attrelid = to_regclass('auth.users') AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype
  )
  UNION ALL
  SELECT 'ootie_profiles.user_id bridges auth.users.id', EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class r ON r.oid = c.confrelid JOIN pg_catalog.pg_namespace rn ON rn.oid = r.relnamespace
    WHERE c.conrelid = to_regclass('public.ootie_profiles') AND c.conname = 'ootie_profiles_user_id_fkey' AND rn.nspname = 'auth' AND r.relname = 'users' AND c.confdeltype = 'a'
  )
  UNION ALL
  SELECT 'ootie_profiles.user_id is unique and required', EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid = to_regclass('public.ootie_profiles') AND a.attname = 'user_id' AND a.atttypid = 'uuid'::regtype AND a.attnotnull
  ) AND EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = to_regclass('public.ootie_profiles') AND c.contype = 'u' AND cardinality(c.conkey) = 1 AND a.attname = 'user_id'
  )
  UNION ALL
  SELECT 'content has no direct auth.users foreign key', NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid = c.conrelid JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_catalog.pg_class r ON r.oid = c.confrelid JOIN pg_catalog.pg_namespace rn ON rn.oid = r.relnamespace
    WHERE n.nspname = 'public' AND t.relname LIKE 'ootie_%' AND c.contype = 'f' AND rn.nspname = 'auth' AND r.relname = 'users'
  )
)
SELECT 'IDENTITY_CHAIN' AS object_group, check_name, passed, CASE WHEN passed THEN 'PASS' ELSE 'MISMATCH' END AS status
FROM checks;

WITH identity_columns(table_name, column_name) AS (VALUES
  ('ootie_clothing_items','owner_id'),('ootie_ootd_posts','user_id'),('ootie_sos_posts','user_id'),('ootie_sos_posts','closet_owner_id'),('ootie_outfit_suggestions','user_id'),('ootie_notifications','user_id'),('ootie_post_likes','user_id'),('ootie_saved_posts','user_id'),('ootie_bookmarks','owner_id')
)
SELECT
  i.table_name || '.' || i.column_name AS object_name,
  a.atttypid = 'uuid'::regtype AS is_uuid,
  a.attnotnull AS is_not_null,
  d.oid IS NULL AS has_no_default,
  CASE WHEN a.atttypid = 'uuid'::regtype AND a.attnotnull AND d.oid IS NULL THEN 'PASS' ELSE 'MISMATCH' END AS status
FROM identity_columns i
LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = to_regclass('public.' || i.table_name) AND a.attname = i.column_name AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
ORDER BY i.table_name, i.column_name;

-- 15. Row counts must be zero for a newly-created empty baseline.
SELECT 'SEED_ROWS' AS object_group, table_name,
       (xpath('/row/count/text()', query_to_xml(format('SELECT count(*) FROM public.%I', table_name), false, true, ''))[1]::text)::bigint AS row_count,
       CASE WHEN (xpath('/row/count/text()', query_to_xml(format('SELECT count(*) FROM public.%I', table_name), false, true, ''))[1]::text)::bigint = 0 THEN 'PASS' ELSE 'MISMATCH' END AS status
FROM (VALUES ('ootie_profiles'),('ootie_clothing_items'),('ootie_ootd_posts'),('ootie_sos_posts'),('ootie_outfit_suggestions'),('ootie_notifications'),('ootie_post_likes'),('ootie_saved_posts'),('ootie_bookmarks')) AS t(table_name);
