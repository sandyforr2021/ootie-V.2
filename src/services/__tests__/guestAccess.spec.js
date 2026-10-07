import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_USAGE_POLICY,
  GUEST_CLOSET_LIMIT,
  canAddGuestItem,
  canUseMeteredGuestAi,
  getAiUsagePolicy,
  readGuestAiUsage,
  resolveAiUsagePolicy,
  writeGuestAiUsage
} from '../guestAccess';

describe('guest access policy contract', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the default AI policy free and supports an explicit metered mode', () => {
    expect(getAiUsagePolicy()).toBe(AI_USAGE_POLICY.FREE_UNLIMITED);
    expect(resolveAiUsagePolicy('METERED_GUEST')).toBe(AI_USAGE_POLICY.METERED_GUEST);
  });

  it('enforces the two-item closet quota by current item count', () => {
    expect(GUEST_CLOSET_LIMIT).toBe(2);
    expect(canAddGuestItem([])).toBe(true);
    expect(canAddGuestItem([{}, {}])).toBe(false);
  });

  it('persists metered AI usage and blocks the third attempt', () => {
    expect(readGuestAiUsage()).toBe(0);
    expect(writeGuestAiUsage(2)).toBe(true);
    expect(readGuestAiUsage()).toBe(2);
    expect(canUseMeteredGuestAi(1)).toBe(true);
    expect(canUseMeteredGuestAi(2)).toBe(false);
  });
});
