import { buildDemoQualityReport } from './demoSeedContract.mjs';
import { auditOotdClosetConsistency, canonicalItemIdsForPost } from './ootdClosetConsistency.mjs';

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const baseUrl = required('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const demoUserId = required('OOTIE_DEMO_USER_ID');
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const read = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  if (!response.ok) throw new Error(`Audit query failed (${response.status}) for ${path}`);
  return response.json();
};

const profiles = await read(`/rest/v1/ootie_profiles?select=id&user_id=eq.${encodeURIComponent(demoUserId)}&limit=1`);
if (!profiles[0]?.id) throw new Error('Demo profile not found');
const profileId = profiles[0].id;
const [mainClothingItems, clothingItems, posts, publicProfiles] = await Promise.all([
  read(`/rest/v1/ootie_clothing_items?select=id,brand,photo&owner_id=eq.${profileId}`),
  read('/rest/v1/ootie_clothing_items?select=id,owner_id,name,name_zh,brand,category,primary_color,photo'),
  read('/rest/v1/ootie_ootd_posts?select=id,user_id,image,caption,item_ids,wearing,hashtags&order=created_at.desc'),
  read('/rest/v1/ootie_profiles?select=id,public_closet')
]);

const quality = buildDemoQualityReport({ clothingItems: mainClothingItems, posts });
if (quality.duplicatePostCount || quality.duplicateExactOutfitCombinationCount) {
  throw new Error(`Remote Demo quality contract failed: ${JSON.stringify(quality)}`);
}
const profilePublic = new Map(publicProfiles.map((profile) => [String(profile.id), profile.public_closet === true]));
const consistency = auditOotdClosetConsistency({ posts, clothingItems, profilePublic });
const canonicalMismatchCount = consistency.details.filter((row, index) => (
  JSON.stringify(row.itemIds) !== JSON.stringify(canonicalItemIdsForPost(index))
)).length;

console.log(JSON.stringify({ ok: consistency.counts.C === 0 && canonicalMismatchCount === 0, profileId, quality, consistency, canonicalMismatchCount }, null, 2));
if (consistency.counts.C || canonicalMismatchCount) {
  process.exitCode = 1;
}
