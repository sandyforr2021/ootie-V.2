import { locale } from '@/i18n';
import { convertCurrency } from './exchangeRates';

export const CURRENCIES = Object.freeze(['TWD', 'USD', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD', 'HKD', 'CNY', 'KRW']);
export const defaultCurrency = (language = locale.value) => ({ 'zh-TW': 'TWD', en: 'USD', ja: 'JPY', es: 'EUR' }[language] || 'USD');
// Existing wardrobe prices were explicitly entered and displayed as NT$.
export const itemCurrency = item => item?.currency || 'TWD';
export const currencyDigits = currency => ['JPY', 'KRW'].includes(currency) ? 0 : 2;
export function validPurchaseAmount(value, currency) {
  if (value === '' || value == null) return true;
  const amount = Number(value);
  const scale = 10 ** currencyDigits(currency);
  return CURRENCIES.includes(currency) && Number.isFinite(amount) && amount >= 0 && amount <= 999999999999
    && Math.abs(amount * scale - Math.round(amount * scale)) < 0.0001;
}
export function formatMoney(value, currency = 'TWD', language = locale.value) {
  if (value === '' || value == null || !Number.isFinite(Number(value))) return '—';
  try { return new Intl.NumberFormat(language, { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: currencyDigits(currency) }).format(Number(value)); }
  catch { return `${currency} ${Number(value).toLocaleString(language)}`; }
}
export function moneyQuote(value, currency = 'TWD', language = locale.value) {
  const original = formatMoney(value, currency, language);
  if (value === '' || value == null || !Number.isFinite(Number(value))) return { formatted: '—', original: '', converted: false };
  const quote = convertCurrency(Number(value), String(currency).toUpperCase(), defaultCurrency(language));
  if (!quote) return { formatted: original, original, converted: false, unavailable: true };
  return { ...quote, original, formatted: `${quote.converted ? '≈ ' : ''}${formatMoney(quote.amount, quote.currency, language)}` };
}
export function formatConvertedMoney(value, currency = 'TWD', language = locale.value) {
  const quote = moneyQuote(value, currency, language);
  return quote.converted ? `${quote.formatted} (${quote.original})` : quote.formatted;
}
export function wardrobeCosts(items) {
  const groups = new Map();
  for (const item of items.filter(item => item.hidden !== true && item.hidden !== 'true')) {
    const currency = itemCurrency(item);
    if (!groups.has(currency)) groups.set(currency, { currency, total: 0, priced: 0, unknown: 0, wears: 0, unworn: 0, rows: [] });
    const group = groups.get(currency);
    const known = item.price !== '' && item.price != null && Number.isFinite(Number(item.price)) && Number(item.price) >= 0;
    const wears = Math.max(0, Number(item.wear_count) || 0);
    if (known) {
      group.priced++;
      group.total += Math.round(Number(item.price) * 100);
      group.wears += wears;
      if (!wears) group.unworn++;
    } else group.unknown++;
    group.rows.push({ ...item, currency, costPerWear: known && wears > 0 ? Number(item.price) / wears : null });
  }
  return [...groups.values()].map(group => ({ ...group, total: group.total / 100 }));
}
