import { shallowRef, ref } from 'vue';

const CACHE_KEY = 'ootie-exchange-rates-v1';
const DAY = 86400000;
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json'
];
export const exchangeRates = shallowRef(null);
export const exchangeRatesLoading = ref(false);
let pending;
let lastAttempt = 0;

function validSnapshot(value) {
  const date = Date.parse(value?.date);
  return typeof value?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    Number.isFinite(date) && Date.now() - date < 7 * DAY && date <= Date.now() + DAY &&
    value?.rates?.USD === 1 && ['TWD', 'USD', 'JPY', 'EUR'].every(code =>
      Number.isFinite(value.rates[code]) && value.rates[code] > 0);
}

export async function ensureExchangeRates(fetchImpl = fetch) {
  if (pending) return pending;
  if (!exchangeRates.value) {
    try { const cached = JSON.parse(localStorage.getItem(CACHE_KEY)); if (validSnapshot(cached)) exchangeRates.value = cached; } catch { /* Storage may be disabled. */ }
  }
  if (exchangeRates.value?.fetchedAt > Date.now() - 6 * 3600000 || lastAttempt > Date.now() - 60000) return;
  lastAttempt = Date.now();
  exchangeRatesLoading.value = true;
  pending = (async () => {
    for (const url of SOURCES) {
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000), cache: 'no-cache' });
        if (!response.ok) continue;
        const payload = await response.json();
        const rates = Object.fromEntries(Object.entries(payload.usd || {}).filter(([,rate]) => Number.isFinite(rate) && rate > 0).map(([code, rate]) => [code.toUpperCase(), rate]));
        const snapshot = { date: payload.date, rates, fetchedAt: Date.now() };
        if (!validSnapshot(snapshot)) continue;
        exchangeRates.value = snapshot;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot)); } catch { /* Conversion works without persistent storage. */ }
        return;
      } catch { /* Try the independent mirror, then retain a recent dated cache. */ }
    }
    if (!validSnapshot(exchangeRates.value)) exchangeRates.value = null;
  })().finally(() => { pending = null; exchangeRatesLoading.value = false; });
  return pending;
}

export function convertCurrency(amount, source, target) {
  if (source === target) return { amount, currency: target, converted: false, date: null };
  const snapshot = exchangeRates.value;
  if (!validSnapshot(snapshot)) return null;
  const from = snapshot.rates[source], to = snapshot.rates[target];
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) return null;
  return { amount: amount / from * to, currency: target, converted: true, date: snapshot.date };
}
