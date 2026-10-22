import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  loadProfile: vi.fn(),
  bootstrapProfile: vi.fn(),
  setMemberProfile: vi.fn(),
  clearMemberProfile: vi.fn(),
  prepareGuestImport: vi.fn()
}));

vi.mock('@/services/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange } }
}));
vi.mock('@/services/profileRepository', () => ({
  loadProfileByAuthUserId: mocks.loadProfile,
  bootstrapOAuthProfile: mocks.bootstrapProfile,
  getPrivateProfile: vi.fn(),
  updatePublicProfile: vi.fn(),
  upsertPrivateProfile: vi.fn()
}));
vi.mock('@/stores/app', () => ({ useAppStore: () => ({
  setMemberProfile: mocks.setMemberProfile,
  clearMemberProfile: mocks.clearMemberProfile,
  prepareGuestImport: mocks.prepareGuestImport
}) }));

import { useAuthStore } from '../auth';

const userId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';
const session = { user: { id: userId }, access_token: 'test-session' };
const profile = { id: profileId, user_id: userId, display_name: 'Member' };

describe('Auth session event lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.loadProfile.mockResolvedValue(profile);
  });
  afterEach(() => vi.useRealTimers());

  it('initializes a Google profile left blank by the new-user database trigger', async () => {
    const store = useAuthStore();
    const googleSession = { ...session, user: { ...session.user, app_metadata: { provider: 'google' } } };
    const completed = { ...profile, username: 'new_style_member' };
    mocks.loadProfile.mockResolvedValueOnce({ ...profile, username: null }).mockResolvedValueOnce(completed);
    mocks.bootstrapProfile.mockResolvedValue(completed);
    await store.resolveProfileIdentity(googleSession);
    expect(mocks.bootstrapProfile).toHaveBeenCalledWith(googleSession);
    expect(store.profile.username).toBe('new_style_member');
    expect(mocks.setMemberProfile).toHaveBeenCalledWith(completed);
  });

  it('preserves an established Google profile without bootstrapping it again', async () => {
    const store = useAuthStore();
    mocks.loadProfile.mockResolvedValue({ ...profile, username: 'established_member' });
    await store.resolveProfileIdentity({ ...session, user: { ...session.user, app_metadata: { provider: 'google' } } });
    expect(mocks.bootstrapProfile).not.toHaveBeenCalled();
    expect(store.profile.username).toBe('established_member');
  });

  it('releases the SDK auth callback before querying a profile, allowing later remote operations', async () => {
    const store = useAuthStore();
    await store.initAuth();
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    mocks.loadProfile.mockClear();
    let authCallbackActive = true;
    mocks.loadProfile.mockImplementation(async () => {
      if (authCallbackActive) throw new Error('Supabase request attempted while its auth lock is held');
      return profile;
    });

    const refreshedSession = { ...session, access_token: 'refreshed-test-session' };
    expect(callback('TOKEN_REFRESHED', refreshedSession)).toBeUndefined();
    expect(store.session.access_token).toBe('refreshed-test-session');
    expect(mocks.loadProfile).not.toHaveBeenCalled();
    authCallbackActive = false;
    await vi.runAllTimersAsync();

    expect(mocks.loadProfile).toHaveBeenCalledWith(userId);
    expect(store.isMember).toBe(true);
    expect(store.profileId).toBe(profileId);
  });

  it('does not restore a signed-out identity from a queued sign-in event', async () => {
    const store = useAuthStore();
    await store.initAuth();
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    mocks.loadProfile.mockClear();
    callback('SIGNED_IN', session);
    callback('SIGNED_OUT', null);
    await vi.runAllTimersAsync();

    expect(mocks.loadProfile).not.toHaveBeenCalled();
    expect(store.isGuest).toBe(true);
    expect(store.profileId).toBeNull();
    expect(mocks.clearMemberProfile).toHaveBeenCalled();
  });

  it('ignores an in-flight profile response after the user signs out', async () => {
    const store = useAuthStore();
    let finishLookup;
    mocks.loadProfile.mockImplementation(() => new Promise(resolve => { finishLookup = resolve; }));
    const oldLookup = store.resolveProfileIdentity(session);
    await store.resolveProfileIdentity(null);
    finishLookup(profile);
    await oldLookup;

    expect(store.profileId).toBeNull();
    expect(store.profileIdentity.status).toBe('UNAUTHENTICATED');
    expect(mocks.setMemberProfile).not.toHaveBeenCalled();
  });
});
