import { describe, expect, it, vi } from 'vitest';
import { createIdentityResolver, IDENTITY_STATUS } from '../identityResolver';

describe('frontend identity resolver interface', () => {
  it('returns unauthenticated without querying a profile', async () => {
    const loadProfile = vi.fn();
    const resolver = createIdentityResolver({ loadProfileByAuthUserId: loadProfile });
    expect((await resolver.resolve(null)).status).toBe(IDENTITY_STATUS.UNAUTHENTICATED);
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it('bridges auth user id to application profile id through an injected lookup', async () => {
    const states = [];
    const resolver = createIdentityResolver({
      loadProfileByAuthUserId: vi.fn(async (userId) => ({ id: 'profile-uuid', user_id: userId })),
      onStateChange: (state) => states.push(state.status)
    });
    const state = await resolver.resolve({ user: { id: 'auth-uuid' } });
    expect(states).toEqual([IDENTITY_STATUS.PROFILE_LOADING, IDENTITY_STATUS.PROFILE_READY]);
    expect(state).toMatchObject({ authUserId: 'auth-uuid', profileId: 'profile-uuid' });
  });

  it('reports missing and query failure without mock identity fallback', async () => {
    const missing = createIdentityResolver({ loadProfileByAuthUserId: vi.fn(async () => null) });
    expect((await missing.resolve({ user: { id: 'auth-uuid' } })).status).toBe(IDENTITY_STATUS.PROFILE_MISSING);

    const failed = createIdentityResolver({ loadProfileByAuthUserId: vi.fn(async () => { throw new Error('offline'); }) });
    const state = await failed.resolve({ user: { id: 'auth-uuid' } });
    expect(state.status).toBe(IDENTITY_STATUS.PROFILE_QUERY_ERROR);
    expect(JSON.stringify(state)).not.toContain('user-01');
    expect(JSON.stringify(state)).not.toContain('profile-01');
  });
});
