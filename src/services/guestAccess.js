export const GUEST_CLOSET_STORAGE_KEY = 'ootie_guest_closet-v1';
export const GUEST_AI_USAGE_STORAGE_KEY = 'ootie_guest_ai_usage-v1';
export const GUEST_CLOSET_LIMIT = 2;
export const GUEST_AI_LIMIT = 2;

export const AI_USAGE_POLICY = Object.freeze({
  FREE_UNLIMITED: 'FREE_UNLIMITED',
  METERED_GUEST: 'METERED_GUEST'
});

export const resolveAiUsagePolicy = (value) => {
  const configured = String(value || '').trim().toUpperCase();
  return configured === AI_USAGE_POLICY.METERED_GUEST
    ? AI_USAGE_POLICY.METERED_GUEST
    : AI_USAGE_POLICY.FREE_UNLIMITED;
};

export const getAiUsagePolicy = () => {
  return resolveAiUsagePolicy(import.meta.env?.VITE_OOTIE_AI_GUEST_POLICY);
};

export const readGuestCloset = () => {
  try {
    const raw = localStorage.getItem(GUEST_CLOSET_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const writeGuestCloset = (items) => {
  try {
    localStorage.setItem(GUEST_CLOSET_STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
    return true;
  } catch (error) {
    return false;
  }
};

export const readGuestAiUsage = () => {
  try {
    const parsed = Number(localStorage.getItem(GUEST_AI_USAGE_STORAGE_KEY) || 0);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  } catch (error) {
    return 0;
  }
};

export const writeGuestAiUsage = (usage) => {
  try {
    localStorage.setItem(GUEST_AI_USAGE_STORAGE_KEY, String(Math.max(0, Math.floor(Number(usage) || 0))));
    return true;
  } catch (error) {
    return false;
  }
};

export const canAddGuestItem = (items) => Array.isArray(items) && items.length < GUEST_CLOSET_LIMIT;

export const canUseMeteredGuestAi = (usage) => Number(usage) < GUEST_AI_LIMIT;
