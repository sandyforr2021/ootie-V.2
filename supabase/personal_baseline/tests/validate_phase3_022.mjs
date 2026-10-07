import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const file = path.resolve('supabase/personal_baseline/022_social_remote_product_import_weather.sql');
const sql = fs.readFileSync(file, 'utf8');
const grantSql = fs.readFileSync(path.resolve('supabase/personal_baseline/023_social_service_role_grant.sql'), 'utf8');
const securitySql = fs.readFileSync(path.resolve('supabase/personal_baseline/024_restrict_rls_auto_enable.sql'), 'utf8');
const indexSql = fs.readFileSync(path.resolve('supabase/personal_baseline/025_index_phase3_foreign_keys.sql'), 'utf8');

for (const fragment of [
  'CREATE TABLE public.ootie_profile_follows',
  'CONSTRAINT ootie_profile_follows_distinct_profiles',
  'CONSTRAINT ootie_profile_follows_unique_pair',
  'ALTER TABLE public.ootie_profile_follows ENABLE ROW LEVEL SECURITY',
  'CREATE POLICY ootie_profile_follows_owner_insert',
  'CREATE POLICY ootie_profile_follows_owner_delete',
  'CREATE UNIQUE INDEX ootie_notifications_event_dedupe_idx',
  'CREATE SCHEMA IF NOT EXISTS private',
  'SECURITY DEFINER',
  'REVOKE ALL ON FUNCTION private.create_ootie_social_notification()',
  'ADD COLUMN source_url text',
  'ADD COLUMN weather_city text'
]) assert.ok(sql.includes(fragment), `missing ${fragment}`);

assert.ok(!sql.includes('auth.role()'), 'deprecated auth.role() must not be used');
assert.ok(!/GRANT\s+INSERT[^;]+ootie_notifications\s+TO\s+authenticated/is.test(sql), 'browser must not insert notifications');
console.log('022 phase 3 social/product/weather validation passed');
assert.match(grantSql, /GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]*ootie_profile_follows[\s\S]*TO service_role/i);
console.log('023 social service role grant validation passed');
assert.match(securitySql, /REVOKE ALL ON FUNCTION public\.rls_auto_enable\(\) FROM PUBLIC, anon, authenticated/i);
assert.match(securitySql, /GRANT EXECUTE ON FUNCTION public\.rls_auto_enable\(\) TO service_role/i);
console.log('024 RLS helper execution boundary validation passed');
assert.match(indexSql, /ootie_ai_generations_point_transaction_idx[\s\S]*point_transaction_id/i);
assert.match(indexSql, /ootie_notifications_actor_profile_idx[\s\S]*actor_profile_id/i);
console.log('025 Phase 3 foreign-key index validation passed');
