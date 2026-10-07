import { describe, expect, it } from 'vitest';
import { BIRTHDAY_BONUS_POINTS, createBirthdaySourceKey, birthdayBonusContract } from '../pointsContract';

describe('pointsContract', () => {
  it('defines the Development birthday reward with annual idempotency', () => {
    expect(BIRTHDAY_BONUS_POINTS.enabled).toBe(true);
    expect(BIRTHDAY_BONUS_POINTS.amount).toBe(25);
    expect(BIRTHDAY_BONUS_POINTS.annualIdempotency).toBe(true);
    expect(createBirthdaySourceKey(2027)).toBe('birthday:2027');
    expect(birthdayBonusContract.type).toBe('BIRTHDAY_BONUS');
  });
});
