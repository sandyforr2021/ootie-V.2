import fixtureIds from '@/contracts/legacyFixtureIds.json';
import { editorialLook } from './editorial';

// Exact records produced by scripts/seed-demo-data.mjs, not a name/word heuristic.
// Keep stored records intact; exclude them only from the live product presentation.
const knownIds = new Set(Object.values(fixtureIds).flat());
const legacyIds = new Set([
  ...Array.from({ length: 5 }, (_, i) => `post-0${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `sos-0${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `notification-0${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `bookmark-0${i + 1}`)
]);
const fixtureMedia = /(?:\/demo\/|\/demo-feed\/|\/demo-assets-real-v1\/|\/demo-avatar\.jpg(?:\?|$))/i;
const metadata = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } };
export function isFixtureContent(row) {
  if (!row) return false;
  if (editorialLook(row)) return false;
  if (knownIds.has(String(row.id)) || legacyIds.has(String(row.id)) || knownIds.has(String(row.target_id)) || knownIds.has(String(row.post_id)) || knownIds.has(String(row.sos_id))) return true;
  if ([row.image, row.photo, row.avatar_url, row.ootie_profiles?.avatar_url, row.following?.avatar_url].some(value => fixtureMedia.test(value || ''))) return true;
  return [row.meta, row.metadata, row.result_metadata].some(value => metadata(value)?.demo === true || metadata(value)?.demoSeed === true);
}
export const genuineContent = rows => Array.isArray(rows) ? rows.filter(row => !isFixtureContent(row)) : rows;
