import { createClient } from '@supabase/supabase-js';
import { classifyOrphanMedia } from './orphanMediaAuditContract.mjs';

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const destructive = process.argv.includes('--delete');
const thresholdHours = Math.max(24, Number(process.env.OOTIE_ORPHAN_MIN_AGE_HOURS || 168));
if (destructive && process.env.OOTIE_MEDIA_CLEANUP_CONFIRM !== 'DELETE_ORPHANS') {
  throw new Error('Destructive cleanup requires OOTIE_MEDIA_CLEANUP_CONFIRM=DELETE_ORPHANS');
}

const client = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false }
});
const bucket = client.storage.from('ootie-closet-media');

const { data: items, error: itemError } = await client
  .from('ootie_clothing_items')
  .select('id,owner_id,photo_original_path,photo_display_path,ootie_profiles!inner(user_id)');
if (itemError) throw itemError;

const itemOwners = new Map();
const referenced = new Set();
for (const item of items || []) {
  const userId = item.ootie_profiles?.user_id;
  if (!userId) continue;
  itemOwners.set(`${userId}/${item.id}`, item);
  if (item.photo_original_path) referenced.add(item.photo_original_path);
  if (item.photo_display_path) referenced.add(item.photo_display_path);
}

const listFolder = async (prefix) => {
  const { data, error } = await bucket.list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  return data || [];
};

const objects = [];
for (const user of await listFolder('closet')) {
  if (!user.name || user.id) continue;
  for (const item of await listFolder(`closet/${user.name}`)) {
    if (!item.name || item.id) continue;
    for (const operation of await listFolder(`closet/${user.name}/${item.name}`)) {
      if (!operation.name || operation.id) continue;
      for (const file of await listFolder(`closet/${user.name}/${item.name}/${operation.name}`)) {
        if (!file.id || !/^(original|display)\.(jpg|jpeg|png|webp)$/i.test(file.name || '')) continue;
        objects.push({
          path: `closet/${user.name}/${item.name}/${operation.name}/${file.name}`,
          userId: user.name,
          itemId: item.name,
          createdAt: file.created_at || file.updated_at
        });
      }
    }
  }
}

const now = Date.now();
const report = classifyOrphanMedia({
  objects,
  existingItemKeys: new Set(itemOwners.keys()),
  referencedPaths: referenced,
  thresholdHours,
  now
});
const candidates = report.filter((row) => row.candidate);

console.log(JSON.stringify({
  mode: destructive ? 'DELETE' : 'DRY_RUN',
  bucket: 'ootie-closet-media',
  thresholdHours,
  objectCount: report.length,
  currentReferenceCount: report.filter((row) => row.isCurrent).length,
  retainedOriginalHistoryCount: report.filter((row) => row.retainedOriginal && !row.isCurrent).length,
  orphanCandidateCount: candidates.length,
  candidates
}, null, 2));

if (destructive && candidates.length) {
  const { error } = await bucket.remove(candidates.map((row) => row.path));
  if (error) throw error;
  console.log(`Deleted ${candidates.length} confirmed orphan object(s).`);
}
