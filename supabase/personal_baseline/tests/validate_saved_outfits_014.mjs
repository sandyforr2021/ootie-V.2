import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const migrationPath = resolve(root, 'supabase/personal_baseline/014_saved_outfits_metrics.sql');
const manifestPath = resolve(root, 'SUPABASE_BASELINE_EXECUTION_MANIFEST.md');
const sql = readFileSync(migrationPath, 'utf8');
const manifest = readFileSync(manifestPath, 'utf8');
const ootdSchema = readFileSync(resolve(root, 'supabase/personal_baseline/004_ootie_ootd_posts.sql'), 'utf8');
const sosSchema = readFileSync(resolve(root, 'supabase/personal_baseline/005_ootie_sos_posts.sql'), 'utf8');
const legacySaveSchema = readFileSync(resolve(root, 'supabase/personal_baseline/007_ootie_auxiliary.sql'), 'utf8');
const hash = createHash('sha256').update(sql).digest('hex').toUpperCase();

const requireMatch = (pattern, message) => {
  if (!pattern.test(sql)) throw new Error(`014 validation failed: ${message}`);
};
const rejectMatch = (pattern, message) => {
  if (pattern.test(sql)) throw new Error(`014 validation failed: ${message}`);
};

requireMatch(/BEGIN;[\s\S]*COMMIT;\s*$/i, 'migration must be one transaction');
requireMatch(/SET LOCAL search_path = pg_catalog, public;/i, 'migration must pin its transaction search path');
requireMatch(/to_regclass\('public\.ootie_profiles'\)/i, 'profile prerequisite missing');
requireMatch(/to_regclass\('public\.ootie_saved_posts'\)/i, 'legacy saved-post prerequisite missing');
requireMatch(/to_regclass\('public\.ootie_ootd_posts'\)/i, 'OOTD prerequisite missing');
requireMatch(/to_regclass\('public\.ootie_sos_posts'\)/i, 'SOS prerequisite missing');
requireMatch(/CREATE TABLE public\.ootie_saved_outfits/i, 'saved-outfits table missing');
requireMatch(/profile_id uuid NOT NULL REFERENCES public\.ootie_profiles\(id\) ON DELETE CASCADE/i, 'profile FK/cascade missing');
requireMatch(/target_type text NOT NULL CHECK \(target_type IN \('OOTD', 'SOS'\)\)/i, 'target type check missing');
requireMatch(/target_id uuid NOT NULL/i, 'uuid target ID missing');
requireMatch(/created_at timestamptz NOT NULL DEFAULT now\(\)/i, 'created timestamp contract missing');
requireMatch(/UNIQUE \(profile_id, target_type, target_id\)/i, 'duplicate constraint missing');
requireMatch(/CREATE INDEX ootie_saved_outfits_profile_created_idx[\s\S]*\(profile_id, created_at DESC\)/i, 'profile collection index missing');
requireMatch(/CREATE FUNCTION public\.validate_ootie_saved_outfit_target\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/i, 'safe target validator function missing');
requireMatch(/FROM public\.ootie_ootd_posts AS ootd_post/i, 'OOTD target validation missing');
requireMatch(/FROM public\.ootie_sos_posts AS sos_post/i, 'SOS target validation missing');
requireMatch(/OOTIE_SAVED_OUTFIT_TARGET_NOT_FOUND/i, 'invalid target must fail at database boundary');
requireMatch(/CREATE TRIGGER trg_validate_ootie_saved_outfit_target[\s\S]*BEFORE INSERT OR UPDATE OF target_type, target_id/i, 'target validation trigger missing');
requireMatch(/INSERT INTO public\.ootie_saved_outfits[\s\S]*SELECT saved_post\.user_id, 'OOTD', saved_post\.post_id, COALESCE\(saved_post\.created_at, now\(\)\)[\s\S]*FROM public\.ootie_saved_posts AS saved_post[\s\S]*JOIN public\.ootie_ootd_posts AS ootd_post[\s\S]*ON CONFLICT \(profile_id, target_type, target_id\) DO NOTHING/i, 'safe legacy OOTD backfill missing');
requireMatch(/ENABLE ROW LEVEL SECURITY/i, 'RLS missing');
requireMatch(/REVOKE ALL ON TABLE public\.ootie_saved_outfits FROM anon, authenticated/i, 'explicit privilege revoke missing');
requireMatch(/GRANT SELECT, INSERT, DELETE ON TABLE public\.ootie_saved_outfits TO authenticated/i, 'minimal authenticated grants missing');
requireMatch(/FOR SELECT TO authenticated/i, 'owner SELECT policy missing');
requireMatch(/FOR INSERT TO authenticated/i, 'owner INSERT policy missing');
requireMatch(/FOR DELETE TO authenticated/i, 'owner DELETE policy missing');
requireMatch(/p\.user_id = \(SELECT auth\.uid\(\)\)/i, 'profile bridge ownership check missing');
rejectMatch(/FOR UPDATE TO authenticated/i, 'client UPDATE must not be granted');
rejectMatch(/CREATE POLICY[\s\S]*TO anon/i, 'anon policy must not be created');
rejectMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM public\.ootie_saved_posts/i, 'destructive legacy bookmark operation found');
rejectMatch(/CREATE TABLE public\.ootie_bookmarks|ALTER TABLE public\.ootie_bookmarks|DROP TABLE public\.ootie_bookmarks/i, 'product/brand bookmarks must remain separate');

if (!/public\."ootie_ootd_posts"[\s\S]*"id" uuid NOT NULL/i.test(ootdSchema)) {
  throw new Error('014 validation failed: OOTD target ID is not the expected uuid contract');
}
if (!/public\."ootie_sos_posts"[\s\S]*"id" uuid NOT NULL/i.test(sosSchema)) {
  throw new Error('014 validation failed: SOS target ID is not the expected uuid contract');
}
if (!/public\."ootie_saved_posts"[\s\S]*"created_at" timestamp with time zone,[\s\S]*"id" uuid NOT NULL[\s\S]*"post_id" uuid NOT NULL,[\s\S]*"user_id" uuid NOT NULL/i.test(legacySaveSchema)) {
  throw new Error('014 validation failed: legacy saved-post source columns differ from the backfill contract');
}

const manifestHash = manifest.match(/\| `014_saved_outfits_metrics\.sql` \| `?([A-F0-9]{64})`? \|/i)?.[1]?.toUpperCase();
if (manifestHash !== hash) {
  throw new Error(`014 validation failed: manifest hash mismatch (expected ${hash}, found ${manifestHash || 'missing'})`);
}

console.log(`014 saved outfits migration validation passed (${hash})`);
