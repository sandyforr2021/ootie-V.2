export const OOTIE_PROJECT_REF = 'hoxkrmadzjnyjaqjbyxc';
export function assertOotieProject(url, expectedRef = OOTIE_PROJECT_REF) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${expectedRef}.supabase.co` || parsed.username || parsed.password || parsed.port) {
    throw new Error('OOTIE_PROJECT_MISMATCH: refused a database outside the configured OOTIE project.');
  }
  return url;
}
