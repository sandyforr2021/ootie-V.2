// Callers must authorize the canonical clothing row before using this source.
export function publicClothingSource(value, projectUrl) {
  if (typeof value !== 'string' || /(?:\/\.{1,2}(?:\/|$)|%(?:2e|2f|5c|25))/i.test(value)) return null;
  try {
    const url = new URL(value);
    const expected = new URL(projectUrl);
    if (url.protocol !== 'https:' || url.origin !== expected.origin || url.username || url.password || url.search || url.hash) return null;
    const match = /^\/storage\/v1\/object\/public\/(ootie-ootd-images|ootie-public)\/(.+\.(?:png|jpe?g|webp))$/i.exec(url.pathname);
    if (!match) return null;
    const path = decodeURIComponent(match[2]);
    if (path.split('/').some(part => !part || part === '.' || part === '..' || /[%\\?#\x00-\x1f]/.test(part))) return null;
    return { bucket: match[1], path };
  } catch { return null; }
}
