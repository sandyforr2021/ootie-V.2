import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const path = resolve(root, 'supabase/personal_baseline/015_ootd_publish_foundation.sql');
const manifestPath = resolve(root, 'SUPABASE_BASELINE_EXECUTION_MANIFEST.md');
const sql = readFileSync(path, 'utf8');
const ownerSelectSql = readFileSync(resolve(root, 'supabase/personal_baseline/019_public_bucket_owner_select.sql'), 'utf8');
const manifest = readFileSync(manifestPath, 'utf8');
const hash = createHash('sha256').update(sql).digest('hex').toUpperCase();

assert.match(sql, /BEGIN;[\s\S]*COMMIT;\s*$/i);
assert.match(sql, /ADD COLUMN image_storage_path text/i);
assert.match(sql, /CHECK \(item_ids IS NULL OR jsonb_typeof\(item_ids\) = 'array'\) NOT VALID/i);
assert.match(sql, /CREATE FUNCTION public\.guard_ootie_ootd_item_ownership\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/i);
assert.match(sql, /clothing_item\.owner_id = NEW\.user_id/i);
assert.match(sql, /OOTIE_OOTD_ITEM_NOT_OWNED/i);
assert.match(sql, /CREATE TRIGGER trg_guard_ootie_ootd_item_ownership/i);
assert.match(sql, /ootie_post_likes_post_id_fkey[\s\S]*ON DELETE CASCADE/i);
assert.match(sql, /ootie_saved_posts_post_id_fkey[\s\S]*ON DELETE CASCADE/i);
assert.match(sql, /'ootie-ootd-images'[\s\S]*10485760[\s\S]*image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp/i);
assert.match(sql, /split_part\(name, '\/', 1\) = 'ootd'[\s\S]*split_part\(name, '\/', 2\) = \(SELECT auth\.uid\(\)::text\)/i);
assert.match(ownerSelectSql, /CREATE POLICY ootie_ootd_images_owner_select[\s\S]*?FOR SELECT TO authenticated[\s\S]*?bucket_id = 'ootie-ootd-images'[\s\S]*?split_part\(name, '\/', 2\) = \(SELECT auth\.uid\(\)::text\)/i);
assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM public\.ootie_saved_outfits/i);

const manifestHash = manifest.match(/\| `015_ootd_publish_foundation\.sql` \| `?([A-F0-9]{64})`? \|/i)?.[1]?.toUpperCase();
assert.equal(manifestHash, hash, '015 manifest hash must match migration');

console.log(`015 OOTD publish migration validation passed (${hash})`);
