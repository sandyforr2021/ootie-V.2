import { demoUuid } from './demoSeedContract.mjs';

// Human-reviewed visual contract for public/demo/ootd/01.webp..36.webp.
// Template numbers are 1-based positions in garmentCatalog. They are the
// single deterministic source used by the seed and the remote audit.
export const OOTD_TEMPLATE_MAP = Object.freeze([
  [5, 1, 13, 18, 20], [8, 20, 38], [2, 12, 16, 20], [30, 13, 18],
  [8, 20, 39], [5, 1, 13, 18], [5, 13, 19, 20], [9, 40],
  [35, 30, 13, 19], [2, 29, 12, 40, 20], [30, 14, 18, 27], [30, 13, 18],
  [5, 11, 19, 20], [30, 13, 17], [2, 11, 40, 41], [5, 1, 13, 18],
  [8, 25, 39, 20], [3, 14, 40], [34, 12, 40], [32, 36, 17],
  [5, 1, 14, 39], [5, 30, 13, 18], [33, 30, 12, 20], [30, 13, 18, 27],
  [8, 25, 26, 39], [35, 1, 14, 40], [5, 1, 13, 19], [9, 23, 40],
  [7, 32, 13, 28, 19], [5, 29, 36, 19], [6, 1, 13, 18], [3, 14, 41],
  [33, 13, 18], [2, 29, 12, 27], [9, 2, 41], [5, 30, 13, 18]
]);

const rules = (requiredCategories, colors) => ({ requiredCategories, colors });

export const OOTD_VISUAL_RULES = Object.freeze([
  rules(['Jackets', 'Shirts', 'Trousers'], ['Black', 'Gray', 'White']),
  rules(['Dresses'], ['Red', 'Black']),
  rules(['Knitwear', 'Jeans', 'Sneakers'], ['White', 'Beige', 'Pink', 'Blue']),
  rules(['Tops', 'Trousers'], ['Black', 'Navy', 'Gray']),
  rules(['Dresses'], ['Black']),
  rules(['Jackets', 'Shirts', 'Trousers'], ['Gray', 'White', 'Black']),
  rules(['Jackets', 'Trousers', 'Boots'], ['Black', 'Gray', 'Brown']),
  rules(['Dresses'], ['White', 'Lavender']),
  rules(['Jackets', 'Tops', 'Trousers'], ['Brown', 'Green', 'Black', 'Gray', 'Navy']),
  rules(['Knitwear', 'Tops', 'Jeans'], ['White', 'Beige', 'Pink', 'Blue']),
  rules(['Tops', 'Trousers'], ['Black', 'Navy', 'White', 'Beige']),
  rules(['Tops', 'Trousers'], ['Black', 'Navy', 'Gray']),
  rules(['Jackets', 'Skirts'], ['Brown', 'Beige', 'Black', 'White']),
  rules(['Tops', 'Trousers'], ['Black', 'Navy', 'Gray']),
  rules(['Knitwear', 'Skirts'], ['Pink', 'White']),
  rules(['Jackets', 'Shirts', 'Trousers'], ['Gray', 'White', 'Black']),
  rules(['Dresses'], ['Black']),
  rules(['Knitwear', 'Trousers'], ['Brown', 'Yellow', 'Beige', 'White']),
  rules(['Jackets', 'Jeans'], ['Blue', 'White']),
  rules(['Knitwear', 'Shorts', 'Sneakers'], ['Gray', 'Black', 'White']),
  rules(['Jackets', 'Shirts', 'Trousers'], ['Beige', 'Gray', 'White']),
  rules(['Jackets', 'Tops', 'Trousers'], ['Black', 'Gray', 'Navy']),
  rules(['Knitwear', 'Tops', 'Jeans'], ['Navy', 'Black', 'Blue']),
  rules(['Tops', 'Trousers'], ['Black', 'Navy', 'Gray']),
  rules(['Dresses'], ['Black']),
  rules(['Jackets', 'Shirts', 'Trousers'], ['Green', 'White', 'Beige']),
  rules(['Jackets', 'Shirts', 'Trousers'], ['Black', 'Gray', 'White']),
  rules(['Dresses'], ['White', 'Lavender']),
  rules(['Coats', 'Knitwear', 'Trousers'], ['Gray', 'White', 'Black', 'Lavender', 'Brown']),
  rules(['Jackets', 'Tops', 'Shorts'], ['Black', 'White']),
  rules(['Coats', 'Shirts', 'Trousers'], ['Beige', 'White', 'Black', 'Gray']),
  rules(['Knitwear', 'Trousers'], ['White', 'Yellow', 'Beige']),
  rules(['Knitwear', 'Trousers'], ['Black', 'Navy', 'Gray']),
  rules(['Knitwear', 'Tops', 'Jeans'], ['Pink', 'White', 'Blue', 'Black']),
  rules(['Dresses', 'Knitwear'], ['White', 'Pink', 'Lavender']),
  rules(['Jackets', 'Tops', 'Trousers'], ['Black', 'Gray', 'Navy'])
]);

export const socialItemId = (authorIndex, templateNumber) => demoUuid(`social-item-${authorIndex}-template-${templateNumber}`);

export const canonicalItemIdFor = (postIndex, templateNumber) => {
  const authorIndex = postIndex % 12;
  return authorIndex === 0
    ? demoUuid(`main-item-${templateNumber - 1}`)
    : socialItemId(authorIndex, templateNumber);
};

export const canonicalItemIdsForPost = (postIndex) => (
  OOTD_TEMPLATE_MAP[postIndex].map((templateNumber) => canonicalItemIdFor(postIndex, templateNumber))
);

export const buildSocialItems = ({ mainItems, profileIds }) => {
  const templateSets = Array.from({ length: profileIds.length }, () => new Set());
  OOTD_TEMPLATE_MAP.forEach((templates, postIndex) => {
    const authorIndex = postIndex % profileIds.length;
    if (authorIndex > 0) templates.forEach((templateNumber) => templateSets[authorIndex].add(templateNumber));
  });
  return templateSets.flatMap((templates, authorIndex) => (
    [...templates].sort((a, b) => a - b).map((templateNumber, offset) => ({
      ...mainItems[templateNumber - 1],
      id: socialItemId(authorIndex, templateNumber),
      owner_id: profileIds[authorIndex],
      created_at: new Date(Date.now() - (authorIndex * 10 + offset) * 86400000).toISOString()
    }))
  ));
};

const normalized = (value) => String(value || '').trim();

export const auditOotdClosetConsistency = ({ posts = [], clothingItems = [], profilePublic = new Map() }) => {
  const itemById = new Map(clothingItems.map((item) => [String(item.id), item]));
  const postById = new Map(posts.map((post) => [String(post.id), post]));
  const details = Array.from({ length: 36 }, (_, postIndex) => {
    const postId = demoUuid(`ootd-${postIndex}`);
    const post = postById.get(postId);
    const rule = OOTD_VISUAL_RULES[postIndex];
    if (!post) return { postIndex: postIndex + 1, postId, classification: 'C', reasons: ['post missing'] };
    const itemIds = Array.isArray(post.item_ids) ? post.item_ids.map(String) : [];
    const duplicateIds = itemIds.length !== new Set(itemIds).size;
    const items = itemIds.map((id) => itemById.get(id));
    const reasons = [];
    if (itemIds.length < 2 || itemIds.length > 5) reasons.push('item count outside 2..5');
    if (duplicateIds) reasons.push('duplicate item id');
    if (items.some((item) => !item)) reasons.push('referenced item missing');
    if (items.some((item) => item && String(item.owner_id) !== String(post.user_id))) reasons.push('item not owned by author');
    if (items.some((item) => item && profilePublic.has(String(item.owner_id)) && !profilePublic.get(String(item.owner_id)))) reasons.push('referenced item not publicly readable');
    for (const category of rule.requiredCategories) {
      if (!items.some((item) => normalized(item?.category) === category)) reasons.push(`missing visible category ${category}`);
    }
    const colorMismatches = items.filter((item) => item && !rule.colors.includes(normalized(item.primary_color)));
    if (colorMismatches.length) reasons.push(`major color mismatch: ${colorMismatches.map((item) => item.primary_color).join(', ')}`);
    const hardFailure = reasons.some((reason) => !reason.startsWith('major color mismatch'));
    return {
      postIndex: postIndex + 1,
      postId,
      image: post.image,
      authorId: post.user_id,
      scenario: String(post.caption || '').split('｜')[0],
      styleTags: Array.isArray(post.hashtags) ? post.hashtags : [],
      itemIds,
      itemNames: items.filter(Boolean).map((item) => item.name_zh || item.name),
      thumbnails: items.filter(Boolean).map((item) => item.photo),
      classification: hardFailure ? 'C' : colorMismatches.length ? 'B' : 'A',
      reasons
    };
  });
  const counts = details.reduce((result, row) => {
    result[row.classification] += 1;
    return result;
  }, { A: 0, B: 0, C: 0 });
  return { total: details.length, counts, details };
};
