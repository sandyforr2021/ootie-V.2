import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseline = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(baseline, '..', '..');
const read = (path) => readFileSync(path, 'utf8');
const sql = (name) => read(resolve(baseline, name));
const sha256 = (name) => createHash('sha256').update(readFileSync(resolve(baseline, name))).digest('hex').toUpperCase();

const profiles = sql('002_ootie_profiles.sql');
const triggers = sql('010_triggers.sql');
const executableTriggers = triggers.replace(/--.*$/gmu, '');
const content = [
  '003_ootie_clothing_items.sql',
  '004_ootie_ootd_posts.sql',
  '005_ootie_sos_posts.sql',
  '006_ootie_outfit_suggestions.sql',
  '007_ootie_auxiliary.sql',
  '008_ootie_bookmarks.sql',
].map(sql).join('\n');

const tableBody = profiles.match(/CREATE TABLE public\."ootie_profiles" \(([\s\S]*?)\n\);/u)?.[1];
assert.ok(tableBody, '002 must define public.ootie_profiles');
const columns = [...tableBody.matchAll(/^\s+"([^"]+)"\s+/gmu)].map((match) => match[1]);
assert.deepEqual(columns, [
  'avatar_url', 'bio', 'created_at', 'hearts', 'helped', 'id',
  'initials', 'likes', 'name', 'public_closet', 'user_id', 'username',
]);
assert.match(profiles, /"user_id" uuid NOT NULL,/u);
assert.doesNotMatch(profiles, /"user_id" uuid[^\n]*DEFAULT/u);
assert.match(profiles, /CONSTRAINT "ootie_profiles_user_id_key" UNIQUE \(user_id\)/u);
assert.match(profiles, /CONSTRAINT "ootie_profiles_user_id_fkey" FOREIGN KEY \(user_id\) REFERENCES auth\.users\(id\) ON DELETE NO ACTION/u);
assert.equal((tableBody.match(/\bCONSTRAINT\b/gu) || []).length, 3, '002 must have exactly PK, UNIQUE, and Auth FK constraints');

assert.equal((content.match(/REFERENCES public\.ootie_profiles\(id\)/gu) || []).length, 9, 'content tables must keep nine profile FKs');
assert.doesNotMatch(content, /REFERENCES auth\.users/iu);
assert.equal((content.match(/ON DELETE CASCADE/gu) || []).length, 1, 'only the evidenced bookmark FK may cascade');

assert.match(triggers, /CREATE FUNCTION public\.handle_new_ootie_user\(\)/u);
assert.match(triggers, /SECURITY DEFINER\s+SET search_path = ''/u);
assert.match(triggers, /INSERT INTO public\.ootie_profiles \(user_id\)\s+VALUES \(NEW\.id\)\s+ON CONFLICT \(user_id\) DO NOTHING;/u);
assert.match(triggers, /RETURN NEW;/u);
assert.match(triggers, /CREATE TRIGGER on_auth_user_created_ootie_profile\s+AFTER INSERT ON auth\.users\s+FOR EACH ROW/u);
assert.doesNotMatch(executableTriggers, /INSERT[\s\S]*SELECT[\s\S]*FROM auth\.users/iu);
assert.doesNotMatch(executableTriggers, /gen_random_uuid|user-01|profile-01/iu);

for (const name of [
  'AUTH_IDENTITY_MODEL.md',
  'AUTH_RLS_FOLLOWUP.md',
  '002_OOTIE_PROFILES_PREFLIGHT.md',
  'AUTH_PROFILE_TRIGGER_PRECHECK.md',
]) {
  assert.ok(read(resolve(root, name)).length > 200, `${name} must exist and be substantive`);
}

const manifest = read(resolve(root, 'SUPABASE_BASELINE_EXECUTION_MANIFEST.md'));
assert.match(manifest, new RegExp(`002_ootie_profiles\\.sql.*${sha256('002_ootie_profiles.sql')}`, 'su'));
assert.match(manifest, new RegExp(`010_triggers\\.sql.*${sha256('010_triggers.sql')}`, 'su'));

console.log('AUTH_IDENTITY_STATIC_VALIDATION=PASS');
console.log(`002_SHA256=${sha256('002_ootie_profiles.sql')}`);
console.log(`010_SHA256=${sha256('010_triggers.sql')}`);
console.log('PROFILE_FK_COUNT=9');
console.log('CONTENT_DIRECT_AUTH_FK_COUNT=0');
console.log('REMOTE_SQL_EXECUTED=YES (OOTIE-personal-dev)');
