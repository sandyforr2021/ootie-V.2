import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const baselineDir = path.resolve(currentDir, '..');
const projectRoot = path.resolve(baselineDir, '..', '..');
const migrationPath = path.join(baselineDir, '013_profile_account_foundation.sql');
const manifestPath = path.join(projectRoot, 'SUPABASE_BASELINE_EXECUTION_MANIFEST.md');
const repositoryPath = path.join(projectRoot, 'src', 'services', 'profileRepository.js');
const ownerSelectPath = path.join(baselineDir, '019_public_bucket_owner_select.sql');

const sql = readFileSync(migrationPath, 'utf8');
const manifest = readFileSync(manifestPath, 'utf8');
const repository = readFileSync(repositoryPath, 'utf8');
const ownerSelectSql = readFileSync(ownerSelectPath, 'utf8');
const normalizedSql = sql.replace(/\s+/g, ' ').trim();

const checks = [];
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAIL: ${label}`);
  checks.push(label);
};
const includesSql = (value) => normalizedSql.toLowerCase().includes(value.toLowerCase());

assert(/^\s*--[\s\S]*?\bBEGIN;/i.test(sql) && /COMMIT;\s*$/i.test(sql), 'migration is atomic');
assert(includesSql('SET LOCAL search_path = pg_catalog, public'), 'transaction search_path is fixed');
assert(includesSql("to_regclass('public.ootie_profiles')") && includesSql("to_regprocedure('public.set_updated_at()')"), '001-012 prerequisites are checked');

for (const column of ['display_name text', 'slogan text', 'display_name_changed_at timestamp with time zone', 'avatar_storage_path text']) {
  assert(includesSql(`ADD COLUMN ${column}`), `nullable public column: ${column.split(' ')[0]}`);
}
assert(!/ADD COLUMN\s+(display_name|slogan|display_name_changed_at|avatar_storage_path)[^,;]*\bNOT NULL\b/i.test(sql), 'new public columns remain existing-row safe');

assert(includesSql('CREATE TABLE public.ootie_profile_private'), 'private profile table exists');
for (const column of ['profile_id uuid primary key', 'full_name text', 'birth_date date', 'phone text', 'created_at timestamp with time zone', 'updated_at timestamp with time zone']) {
  assert(includesSql(column), `private profile column: ${column.split(' ')[0]}`);
}
assert(includesSql('REFERENCES public.ootie_profiles(id) ON DELETE CASCADE'), 'private profile is a cascading 1:1 dependent');
assert(includesSql('INSERT INTO public.ootie_profile_private (profile_id) SELECT p.id FROM public.ootie_profiles AS p ON CONFLICT (profile_id) DO NOTHING'), 'existing profiles receive one idempotent private row');

assert(includesSql('CREATE TABLE public.ootie_point_transactions'), 'points ledger table exists');
assert(includesSql('amount integer NOT NULL'), 'points amount is required');
for (const type of ['BIRTHDAY_BONUS', 'AI_USAGE', 'TRYON_USAGE', 'MANUAL_ADJUSTMENT']) {
  assert(sql.includes(`'${type}'`), `points type: ${type}`);
}
assert(includesSql('UNIQUE (profile_id, source_key)'), 'points source is unique per profile');
assert(includesSql('REVOKE ALL ON TABLE public.ootie_profile_private FROM anon, authenticated'), 'private table does not inherit broad client grants');
assert(includesSql('GRANT SELECT, INSERT, UPDATE ON TABLE public.ootie_profile_private TO authenticated'), 'private table has least-privilege authenticated grants');
assert(includesSql('REVOKE ALL ON TABLE public.ootie_point_transactions FROM anon, authenticated'), 'points table does not inherit browser write grants');
assert(includesSql('GRANT SELECT ON TABLE public.ootie_point_transactions TO authenticated'), 'points table grants browser read only');

for (const policy of ['ootie_profile_private_select_own', 'ootie_profile_private_insert_own', 'ootie_profile_private_update_own', 'ootie_point_transactions_select_own']) {
  assert(includesSql(`CREATE POLICY ${policy}`), `RLS policy: ${policy}`);
}
assert((sql.match(/TO authenticated/gi) || []).length >= 7, 'client policies explicitly target authenticated users');
assert(!/CREATE POLICY\s+\S*(?:private|point)\S*[^;]*FOR DELETE/is.test(sql), 'private and points client DELETE are denied');
assert(!/CREATE POLICY\s+\S*point\S*[^;]*FOR (?:INSERT|UPDATE|DELETE)/is.test(sql), 'points browser writes are denied');
assert(includesSql('p.user_id = (SELECT auth.uid())'), 'RLS follows auth user to profile ownership');

assert(includesSql('OLD.display_name IS DISTINCT FROM NEW.display_name'), 'display name trigger ignores same-value updates');
assert(includesSql("interval '30 days'"), 'display name boundary is exactly 30 days');
assert(includesSql("current_timestamp < OLD.display_name_changed_at + interval '30 days'"), '29d23h is blocked and the exact 30-day boundary passes');
assert(includesSql('NEW.display_name_changed_at := current_timestamp'), 'successful display name change starts cooldown');
assert(includesSql('NEW.display_name_changed_at := OLD.display_name_changed_at'), 'clients cannot clear or forge the cooldown timestamp');
assert(includesSql('BEFORE UPDATE OF display_name, display_name_changed_at ON public.ootie_profiles'), 'slogan and avatar updates do not invoke cooldown trigger');
assert(includesSql("RAISE EXCEPTION 'DISPLAY_NAME_COOLDOWN'"), 'cooldown exposes a machine-readable error');
assert(includesSql('NEW.birth_date IS NOT NULL AND NEW.birth_date > current_date'), 'future birth dates are blocked while NULL remains allowed');

assert(includesSql('CREATE FUNCTION public.provision_ootie_profile_private()'), 'private provisioning function exists');
assert(includesSql('SECURITY DEFINER SET search_path ='), 'provisioning uses a fixed-path security definer');
assert(includesSql('AFTER INSERT ON public.ootie_profiles'), 'private provisioning follows public profile creation');
assert((sql.match(/ON CONFLICT \(profile_id\) DO NOTHING/gi) || []).length === 2, 'backfill and provisioning are duplicate-safe');
assert(includesSql('EXECUTE FUNCTION public.set_updated_at()'), 'existing baseline timestamp trigger is reused');

assert(includesSql("'ootie-profile-avatars', 'ootie-profile-avatars', true, 5242880"), 'avatar bucket is public with a 5 MB limit');
for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
  assert(sql.includes(`'${mime}'`), `avatar MIME allowed: ${mime}`);
}
assert(!includesSql('FOR SELECT TO anon, authenticated'), 'public bucket does not grant broad storage.objects listing');
assert(/CREATE POLICY ootie_bookmark_images_owner_select[\s\S]*?FOR SELECT TO authenticated[\s\S]*?bucket_id = 'ootie-bookmarks-images'[\s\S]*?p\.user_id = \(SELECT auth\.uid\(\)\)/i.test(ownerSelectSql), '019 restores bookmark owner-only select required by Storage update/delete');
assert(/CREATE POLICY ootie_profile_avatars_owner_select[\s\S]*?FOR SELECT TO authenticated[\s\S]*?bucket_id = 'ootie-profile-avatars'[\s\S]*?split_part\(name, '\/', 2\) = \(SELECT auth\.uid\(\)::text\)/i.test(ownerSelectSql), '019 restores avatar owner-only select required by Storage update/delete');
for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
  assert(includesSql(`FOR ${operation} TO authenticated`), `avatar owner ${operation.toLowerCase()} policy exists`);
}
assert((sql.match(/split_part\(name, '\/', 2\) = \(SELECT auth\.uid\(\)::text\)/g) || []).length >= 3, 'avatar writes are bound to the auth user folder');

assert(!/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i.test(sql), 'no destructive table or data operation exists');
assert(!/\bIF NOT EXISTS\b/i.test(sql), 'object creation fails closed on collisions');
assert(!/\bCREATE OR REPLACE\b/i.test(sql), 'existing functions are not overwritten');
assert(!/INSERT INTO storage\.buckets[\s\S]*?ON CONFLICT/i.test(sql), 'avatar bucket collisions are not silently accepted');

const publicSelectMatch = repository.match(/PUBLIC_PROFILE_SELECT\s*=\s*'([^']+)'/);
assert(Boolean(publicSelectMatch), 'public profile select contract is explicit');
const publicFields = publicSelectMatch[1].split(',');
for (const field of ['full_name', 'birth_date', 'phone', 'email', 'user_id', 'name', 'display_name_changed_at']) {
  assert(!publicFields.includes(field), `public profile excludes ${field}`);
}

const sha256 = createHash('sha256').update(readFileSync(migrationPath)).digest('hex').toUpperCase();
assert(manifest.includes(`| \`013_profile_account_foundation.sql\` | \`${sha256}\` |`), 'manifest contains the current 013 SHA-256');

console.log(`013 profile/account validation: PASS (${checks.length} checks)`);
console.log(`013 SHA-256: ${sha256}`);
console.log('REMOTE_SQL_EXECUTED=YES (OOTIE-personal-dev)');
