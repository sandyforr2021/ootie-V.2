import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDemoQualityReport, DEMO_TARGET_COUNTS, demoUuid, validateDemoSeedSummary } from '../scripts/demoSeedContract.mjs';
import { OOTD_TEMPLATE_MAP, auditOotdClosetConsistency, buildSocialItems, canonicalItemIdsForPost } from '../scripts/ootdClosetConsistency.mjs';

test('demo seed IDs are stable UUIDs across reruns', () => {
  assert.equal(demoUuid('profile-0'), demoUuid('profile-0'));
  assert.match(demoUuid('profile-0'), /^[0-9a-f-]{36}$/);
  assert.notEqual(demoUuid('profile-0'), demoUuid('profile-1'));
});

test('demo social counts satisfy presentation density targets', () => {
  assert.equal(validateDemoSeedSummary(DEMO_TARGET_COUNTS), true);
  assert.equal(validateDemoSeedSummary({ ...DEMO_TARGET_COUNTS, mainClosetItems: 8 }), false);
});

test('demo quality report detects repeated posts and exact combinations', () => {
  const report = buildDemoQualityReport({
    clothingItems: [{ id: 'a', brand: 'COS', photo: '/a.webp' }, { id: 'b', brand: 'GU', photo: '/b.webp' }],
    posts: [
      { id: 'p1', image: '/1.webp', caption: '通勤｜一', item_ids: ['a', 'b'] },
      { id: 'p1', image: '/2.webp', caption: '約會｜二', item_ids: ['b', 'a'] }
    ]
  });
  assert.equal(report.duplicatePostCount, 1);
  assert.equal(report.duplicateExactOutfitCombinationCount, 1);
  assert.equal(report.uniqueClothingImages, 2);
});

test('OOTD canonical mappings are stable, unique per outfit, and contain 2 to 5 items', () => {
  const combinations = OOTD_TEMPLATE_MAP.map((_, index) => canonicalItemIdsForPost(index));
  assert.equal(combinations.length, 36);
  assert.equal(new Set(combinations.map((ids) => [...ids].sort().join('|'))).size, 36);
  combinations.forEach((ids) => {
    assert.ok(ids.length >= 2 && ids.length <= 5);
    assert.equal(new Set(ids).size, ids.length);
  });
});

test('social closets contain every author-owned item used by the canonical OOTD mapping', () => {
  const profileIds = Array.from({ length: 12 }, (_, index) => demoUuid(`profile-${index}`));
  const mainItems = Array.from({ length: 42 }, (_, index) => ({
    id: demoUuid(`main-item-${index}`), owner_id: profileIds[0], category: 'Tops', primary_color: 'White'
  }));
  const socialItems = buildSocialItems({ mainItems, profileIds });
  const everyItem = new Map([...mainItems, ...socialItems].map((item) => [item.id, item]));
  OOTD_TEMPLATE_MAP.forEach((_, postIndex) => {
    canonicalItemIdsForPost(postIndex).forEach((id) => {
      assert.equal(everyItem.get(id)?.owner_id, profileIds[postIndex % profileIds.length]);
    });
  });
});

test('consistency audit rejects missing and cross-owner references', () => {
  const postId = demoUuid('ootd-0');
  const ownerId = demoUuid('profile-0');
  const report = auditOotdClosetConsistency({
    posts: [{ id: postId, user_id: ownerId, item_ids: ['missing'], caption: '上班通勤｜測試' }],
    clothingItems: [],
    profilePublic: new Map([[ownerId, true]])
  });
  assert.equal(report.details[0].classification, 'C');
  assert.match(report.details[0].reasons.join(' '), /referenced item missing/);
});

test('seed reruns merge social likes by their natural uniqueness contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'scripts/seed-demo-data.mjs'), 'utf8');
  assert.match(source, /upsert\('ootie_post_likes', likes, 'post_id,user_id'\)/);
  assert.match(source, /upsert\('ootie_saved_outfits', savedOutfits, 'profile_id,target_type,target_id'\)/);
});
