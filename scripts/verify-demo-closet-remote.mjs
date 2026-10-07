import { createHash } from 'node:crypto';

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const profileId = String(process.env.OOTIE_DEMO_PROFILE_ID || '');
if (!url || !serviceKey || !profileId) throw new Error('Missing remote verification environment.');

const response = await fetch(
  `${url}/rest/v1/ootie_clothing_items?owner_id=eq.${encodeURIComponent(profileId)}&select=name_zh,photo`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
);
if (!response.ok) throw new Error(`Closet query failed (${response.status}).`);
const rows = (await response.json()).filter((row) => String(row.photo || '').includes('/demo-assets-real-v1/'));
const results = await Promise.all(rows.map(async (row) => {
  const image = await fetch(row.photo);
  const bytes = image.ok ? Buffer.from(await image.arrayBuffer()) : Buffer.alloc(0);
  return {
    ok: image.ok && bytes.length > 0,
    hash: bytes.length ? createHash('sha256').update(bytes).digest('hex') : null
  };
}));

const report = {
  remoteRealCaptureCount: rows.length,
  remoteUniqueHashes: new Set(results.map((result) => result.hash).filter(Boolean)).size,
  remoteBrokenImages: results.filter((result) => !result.ok).length
};
console.log(JSON.stringify(report, null, 2));
if (report.remoteRealCaptureCount !== 43 || report.remoteUniqueHashes !== 43 || report.remoteBrokenImages !== 0) {
  process.exitCode = 1;
}
