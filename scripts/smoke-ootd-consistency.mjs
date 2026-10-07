const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const baseUrl = required('SUPABASE_URL').replace(/\/$/, '');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const email = required('OOTIE_DEMO_EMAIL');
const password = required('OOTIE_DEMO_PASSWORD');
const baseHeaders = { apikey: publishableKey, 'Content-Type': 'application/json' };
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...baseHeaders, ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
};

const posts = await request('/rest/v1/ootie_ootd_posts?select=id,user_id,item_ids,wearing&order=created_at.asc');
if (posts.length !== 36) throw new Error(`Expected 36 public posts, found ${posts.length}`);
for (const post of posts) {
  const ids = Array.isArray(post.item_ids) ? post.item_ids.map(String) : [];
  const snapshots = Array.isArray(post.wearing) ? post.wearing : [];
  if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length) throw new Error(`Invalid canonical IDs for ${post.id}`);
  if (snapshots.length !== ids.length || snapshots.some((entry, index) => String(entry?.id) !== ids[index] || !entry?.photo)) {
    throw new Error(`Published snapshot drift for ${post.id}`);
  }
}

const session = await request('/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const itemIds = [...new Set(posts.flatMap((post) => post.item_ids.map(String)))];
const encodedIds = itemIds.map((id) => `"${id}"`).join(',');
const readableItems = await request(`/rest/v1/ootie_clothing_items?select=id,owner_id,photo&id=in.(${encodeURIComponent(encodedIds)})`, {
  headers: { Authorization: `Bearer ${session.access_token}` }
});
const itemById = new Map(readableItems.map((item) => [String(item.id), item]));
for (const post of posts) {
  for (const id of post.item_ids.map(String)) {
    const item = itemById.get(id);
    if (!item) throw new Error(`Authenticated public item is not readable: ${id}`);
    if (String(item.owner_id) !== String(post.user_id)) throw new Error(`Cross-owner OOTD item: ${post.id}/${id}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  publicPosts: posts.length,
  uniqueReferencedItems: itemIds.length,
  readableReferencedItems: readableItems.length,
  duplicateIdsInsideOutfit: 0,
  snapshotDrift: 0,
  crossOwnerReferences: 0
}, null, 2));
