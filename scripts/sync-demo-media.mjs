import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const baseUrl = required('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const demoUserId = required('OOTIE_DEMO_USER_ID');
const headers = (extra = {}) => ({ apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra });

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers: headers(options.headers) });
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${endpoint} failed (${response.status})`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const objectPathFromPublicUrl = (url) => {
  const marker = '/storage/v1/object/public/ootie-ootd-images/';
  const pathname = new URL(url).pathname;
  const index = pathname.indexOf(marker);
  if (index < 0) throw new Error(`Unexpected Storage URL: ${url}`);
  return decodeURIComponent(pathname.slice(index + marker.length));
};

const upload = async (objectPath, bytes) => request(`/storage/v1/object/ootie-ootd-images/${objectPath.split('/').map(encodeURIComponent).join('/')}`, {
  method: 'POST',
  headers: { 'Content-Type': 'image/webp', 'x-upsert': 'true' },
  body: bytes
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const syncedAssets = [];

const garmentIndices = [16, 17, 18, ...Array.from({ length: 15 }, (_, index) => index + 25)];
const ootdIndices = Array.from({ length: 15 }, (_, index) => index + 1);

const profiles = await request(`/rest/v1/ootie_profiles?select=id&user_id=eq.${encodeURIComponent(demoUserId)}&limit=1`);
const profileId = profiles?.[0]?.id;
if (!profileId) throw new Error('Presentation profile not found');

const [items, posts] = await Promise.all([
  request(`/rest/v1/ootie_clothing_items?select=photo&owner_id=eq.${encodeURIComponent(profileId)}`),
  request('/rest/v1/ootie_ootd_posts?select=image')
]);

const garmentUrlByName = new Map(items.map(({ photo }) => [photo?.match(/garment-\d+\.webp$/)?.[0], photo]).filter(([name]) => name));
const ootdUrlByName = new Map(posts.map(({ image }) => [image?.match(/look-\d+\.webp$/)?.[0], image]).filter(([name]) => name));

for (const index of garmentIndices) {
  const localName = `${String(index).padStart(2, '0')}.webp`;
  const remoteName = `garment-${localName}`;
  const remoteUrl = garmentUrlByName.get(remoteName);
  if (!remoteUrl) throw new Error(`Missing remote garment mapping for ${remoteName}`);
  const bytes = await readFile(path.join(root, 'public', 'demo', 'garments', localName));
  await upload(objectPathFromPublicUrl(remoteUrl), bytes);
  syncedAssets.push({ remoteUrl, bytes });
}

for (const index of ootdIndices) {
  const localName = `${String(index).padStart(2, '0')}.webp`;
  const remoteName = `look-${localName}`;
  const remoteUrl = ootdUrlByName.get(remoteName);
  if (!remoteUrl) throw new Error(`Missing remote OOTD mapping for ${remoteName}`);
  const bytes = await readFile(path.join(root, 'public', 'demo', 'ootd', localName));
  await upload(objectPathFromPublicUrl(remoteUrl), bytes);
  syncedAssets.push({ remoteUrl, bytes });
}

for (const { remoteUrl, bytes } of syncedAssets) {
  const response = await fetch(`${remoteUrl}?ootie_media_phase=6`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Verification fetch failed (${response.status})`);
  const remoteBytes = Buffer.from(await response.arrayBuffer());
  if (digest(remoteBytes) !== digest(bytes)) throw new Error(`Remote media digest mismatch: ${remoteUrl}`);
}

console.log(JSON.stringify({ ok: true, garmentsSynced: garmentIndices.length, ootdSynced: ootdIndices.length, remoteDigestsVerified: syncedAssets.length }));
