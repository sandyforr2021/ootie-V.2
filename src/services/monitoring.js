const SENSITIVE_KEY = /token|authorization|password|secret|prompt|photo|image|payment|card/i;

export const scrubMonitoringContext = (value, depth = 0) => {
  if (depth > 3 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => scrubMonitoringContext(entry, depth + 1));
  if (typeof value !== 'object') return typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : scrubMonitoringContext(entry, depth + 1)]));
};

export const monitoring = {
  enabled: Boolean(import.meta.env.VITE_MONITORING_PROVIDER),
  capture(error, context = {}) {
    const safeEvent = { message: error?.message || String(error), name: error?.name || 'Error', context: scrubMonitoringContext(context) };
    if (import.meta.env.DEV) console.error('[OOTIE monitoring]', safeEvent);
    return safeEvent;
  }
};
