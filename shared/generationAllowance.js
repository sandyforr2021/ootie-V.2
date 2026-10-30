export const DAILY_FREE_IMAGES = 2;
export const POINTS_PER_GARMENT = 2;

// A whole outfit produces one final image. Never partially debit an outfit.
// Policy v2 is advertised only after the matching database rules are installed.
export function generationQuote(capabilities, garmentCount = 1) {
  const balance = capabilities?.pointBalance;
  const cost = garmentCount * POINTS_PER_GARMENT;
  if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(garmentCount) || garmentCount < 1) {
    return { allowed: false, mode: null, points: 0, reason: 'POINTS_UNAVAILABLE' };
  }
  if (capabilities.generationPolicyVersion === 2) {
    if (balance >= cost) return { allowed: true, mode: 'points', points: cost };
    if (Number.isInteger(capabilities.dailyFreeGenerationRemaining) && capabilities.dailyFreeGenerationRemaining > 0) {
      return { allowed: true, mode: 'daily_free', points: 0 };
    }
    return { allowed: false, mode: null, points: 0, reason: 'DAILY_FREE_LIMIT' };
  }
  if (capabilities.dailyGenerationRemaining === 0) return { allowed: false, mode: null, points: 0, reason: 'DAILY_GENERATION_LIMIT' };
  return balance >= cost
    ? { allowed: true, mode: 'points', points: cost }
    : { allowed: false, mode: null, points: 0, reason: 'INSUFFICIENT_POINTS' };
}
