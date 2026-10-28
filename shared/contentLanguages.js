export const CONTENT_LANGUAGES = Object.freeze(['zh-TW', 'en', 'ja', 'es', 'ko', 'th', 'fr', 'hi', 'de', 'it', 'pt', 'vi', 'id']);
export const languageNames = { 'zh-TW': '繁體中文', en: 'English', ja: '日本語', es: 'Español', ko: '한국어', th: 'ไทย', fr: 'Français', hi: 'हिन्दी', de: 'Deutsch', it: 'Italiano', pt: 'Português', vi: 'Tiếng Việt', id: 'Bahasa Indonesia' };
export function normalizeContentLanguage(value) {
  if (/^zh(?:-|$)/i.test(value || '')) return 'zh-TW';
  const base = String(value || '').split('-')[0].toLowerCase();
  return CONTENT_LANGUAGES.includes(base) ? base : null;
}
export function inferContentLanguage(text, fallback = null) {
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
  if (/[\u0e00-\u0e7f]/u.test(text)) return 'th';
  if (/[\u0900-\u097f]/u.test(text)) return 'hi';
  if (/[\u3400-\u9fff]/u.test(text)) return 'zh-TW';
  return normalizeContentLanguage(fallback);
}
