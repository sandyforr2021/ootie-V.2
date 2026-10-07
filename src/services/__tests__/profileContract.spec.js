import { describe, expect, it } from 'vitest';
import { getDisplayNameCooldown, validatePrivateProfileInput, validatePublicProfileInput } from '../profileContract';
import { SERVICE_ERROR_CODE } from '../serviceError';

describe('profileContract', () => {
  it('normalizes and validates public fields without changing username contract', () => {
    expect(validatePublicProfileInput({ display_name: ' Sandy ', username: 'Sandy', slogan: ' hello ' })).toEqual({ display_name: 'Sandy', username: '@sandy', slogan: 'hello' });
  });

  it('enforces display-name cooldown at day 10/29 and releases it at day 30', () => {
    const changedAt = '2026-01-01T00:00:00.000Z';
    expect(getDisplayNameCooldown({ display_name_changed_at: changedAt }, Date.parse('2026-01-11T00:00:00Z')).locked).toBe(true);
    expect(getDisplayNameCooldown({ display_name_changed_at: changedAt }, Date.parse('2026-01-30T00:00:00Z')).locked).toBe(true);
    expect(getDisplayNameCooldown({ display_name_changed_at: changedAt }, Date.parse('2026-01-30T23:00:00Z')).locked).toBe(true);
    expect(getDisplayNameCooldown({ display_name_changed_at: changedAt }, Date.parse('2026-01-31T00:00:00Z')).locked).toBe(false);
    const recentChange = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(() => validatePublicProfileInput({ display_name: 'New', username: '@sandy' }, { currentProfile: { display_name: 'Old', display_name_changed_at: recentChange } })).toThrowError(expect.objectContaining({ code: SERVICE_ERROR_CODE.DISPLAY_NAME_COOLDOWN }));
  });

  it('rejects future birthdays and accepts private data', () => {
    expect(() => validatePrivateProfileInput({ birth_date: '2999-01-01' })).toThrow();
    expect(validatePrivateProfileInput({ full_name: 'Sandy', birth_date: '1990-01-01', phone: '09' })).toEqual({ full_name: 'Sandy', birth_date: '1990-01-01', phone: '09' });
  });
});
