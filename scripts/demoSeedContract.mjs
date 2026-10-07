import { createHash } from 'node:crypto';

export const DEMO_TARGET_COUNTS = Object.freeze({
  profiles: 12,
  mainClosetItems: 42,
  ootdPosts: 36,
  savedOutfits: 8,
  sosPosts: 12,
  suggestions: 18
});

export const demoUuid = (label) => {
  const bytes = Buffer.from(createHash('sha256').update(`ootie-demo:${label}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const validateDemoSeedSummary = (summary) => (
  summary.profiles >= 10
  && summary.mainClosetItems >= 30
  && summary.mainClosetItems <= 50
  && summary.ootdPosts >= 30
  && summary.savedOutfits >= 8
  && summary.sosPosts >= 10
  && summary.suggestions >= 10
);

export const buildDemoQualityReport = ({ clothingItems = [], posts = [] }) => {
  const postIds = posts.map((post) => String(post.id));
  const imageValues = (rows, key) => rows.map((row) => String(row[key] || '')).filter(Boolean);
  const combinationKeys = posts.map((post) => [...new Set((post.item_ids || []).map(String))].sort().join('|'));
  const itemUse = new Map();
  posts.forEach((post) => (post.item_ids || []).forEach((id) => itemUse.set(String(id), (itemUse.get(String(id)) || 0) + 1)));
  const mostReused = [...itemUse.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const scenarioDistribution = posts.reduce((result, post) => {
    const scenario = String(post.caption || '').split('｜')[0] || '未分類';
    result[scenario] = (result[scenario] || 0) + 1;
    return result;
  }, {});
  const brandDistribution = clothingItems.reduce((result, item) => {
    const brand = item.brand || '未標示';
    result[brand] = (result[brand] || 0) + 1;
    return result;
  }, {});
  return {
    totalClothingItems: clothingItems.length,
    uniqueClothingImages: new Set(imageValues(clothingItems, 'photo')).size,
    totalOotdPosts: posts.length,
    uniqueOotdPostIds: new Set(postIds).size,
    uniqueOotdImages: new Set(imageValues(posts, 'image')).size,
    uniqueOutfitCombinations: new Set(combinationKeys).size,
    mostFrequentlyReusedClothingItem: { id: mostReused[0], uses: mostReused[1] },
    duplicatePostCount: postIds.length - new Set(postIds).size,
    duplicateExactOutfitCombinationCount: combinationKeys.length - new Set(combinationKeys).size,
    scenarioDistribution,
    brandDistribution
  };
};
