// Explicitly approved by the owner on 2026-10-28. Never part of deployment.
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const url = 'https://hoxkrmadzjnyjaqjbyxc.supabase.co';
const userId = '71f33269-f0c4-44b3-8450-4993256f2133';
const profileId = 'cbf9abe4-1fe6-43c1-bab7-3ad2e813f633';
const itemId = 'de482586-0db8-4000-b07e-761ab30f32e1';
const paths = [
  `person/${userId}/04204193-9b1c-454c-9178-d1e9bf2d5826.png`,
  `person/${userId}/4e42c792-1e04-4244-b8db-8666a11a4e6a.png`,
  `person/${userId}/c9bfb2ec-8013-46ba-b56c-a3e73f6e10c0.png`,
  `clothing/${userId}/${itemId}.png`,
];
assert.equal(process.env.SUPABASE_URL, url, 'Wrong project');
assert(process.argv.includes('--execute-approved'), 'Explicit execution flag required');
const client = createClient(url, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const checked = async promise => { const { data, error } = await promise; if (error) throw new Error(`Operation failed: ${error.code || error.status || 'unknown'}`); return data; };
const profile = await checked(client.from('ootie_profiles').select('id,user_id,username,display_name').eq('id', profileId).single());
assert.deepEqual(profile, { id: profileId, user_id: userId, username: 'ootie_smoke_isolation', display_name: 'OOTIE Isolation Test' });
const items = await checked(client.from('ootie_clothing_items').select('id,name').eq('owner_id', profileId));
assert.deepEqual(items, [{ id: itemId, name: 'Synthetic sage cardigan' }]);
for (const folder of ['person', 'clothing']) {
  const objects = await checked(client.storage.from('ootie-ai-private').list(`${folder}/${userId}`, { limit: 100 }));
  assert.deepEqual(objects.map(o => `${folder}/${userId}/${o.name}`).sort(), paths.filter(p => p.startsWith(`${folder}/`)).sort());
}
await checked(client.storage.from('ootie-ai-private').remove(paths));
for (const folder of ['person', 'clothing']) {
  const objects = await checked(client.storage.from('ootie-ai-private').list(`${folder}/${userId}`, { limit: 100 }));
  assert.equal(objects.length, 0, 'Storage deletion not confirmed');
}
const removedItems = await checked(client.from('ootie_clothing_items').delete().eq('id', itemId).eq('owner_id', profileId).select('id'));
assert.equal(removedItems.length, 1);
const removedProfiles = await checked(client.from('ootie_profiles').delete().eq('id', profileId).eq('user_id', userId).select('id'));
assert.equal(removedProfiles.length, 1);
await checked(client.auth.admin.deleteUser(userId));
console.log(JSON.stringify({ deleted: { account: 1, clothing: 1, storageObjects: 4 }, project: 'hoxkrmadzjnyjaqjbyxc' }));
