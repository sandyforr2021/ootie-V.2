import { readonly, ref } from 'vue';
import { messages } from './messages.js';

export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English' }, { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' }, { code: 'es', label: 'Español' }
]);
export const LOCALE_STORAGE_KEY = 'ootie-language';
export function normalizeLocale(value) {
  return value === 'zh' ? 'zh-TW' : LANGUAGES.some(({code}) => code === value) ? value : null;
}
export function initialLocale(storage = globalThis.localStorage, search = globalThis.location?.search || '') {
  const requested = normalizeLocale(new URLSearchParams(search).get('lang'));
  if (requested) return requested;
  try { return normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY)) || 'en'; } catch { return 'en'; }
}
const activeLocale = ref(initialLocale());
export const locale = readonly(activeLocale);
export function setLocale(value) {
  const next = normalizeLocale(value);
  if (!next) return false;
  activeLocale.value = next;
  try { globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, next); } catch { /* Restricted storage still permits this session's selection. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  return true;
}
export function translateFor(language, key, english) {
  if (key == null) return '';
  const entry = messages[key];
  if (language === 'zh-TW') return entry?.['zh-TW'] || key;
  return entry?.[language] || entry?.en || english || key;
}
export function t(key, english) { return translateFor(activeLocale.value, key, english); }
export function formatDate(value, options = {}) {
  const date = new Date(value);
  return Number.isNaN(+date) ? '' : new Intl.DateTimeFormat(activeLocale.value, options).format(date);
}
export function installI18n(app) {
  app.config.globalProperties.$t = t;
  setLocale(activeLocale.value);
}
