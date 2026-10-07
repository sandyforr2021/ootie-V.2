import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../auth';
import { IDENTITY_STATUS } from '@/services/identityResolver';

describe('Auth Guest and Member identity contract', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('treats no Supabase session as Guest', () => {
    const authStore = useAuthStore();
    expect(authStore.isGuest).toBe(true);
    expect(authStore.isMember).toBe(false);
  });

  it('requires a resolved OOTIE profile for Member access', () => {
    const authStore = useAuthStore();
    authStore.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = {
      status: IDENTITY_STATUS.PROFILE_READY,
      authUserId: authStore.user.id,
      profileId: '22222222-2222-4222-8222-222222222222',
      profile: { id: '22222222-2222-4222-8222-222222222222' },
      error: null
    };

    expect(authStore.isGuest).toBe(false);
    expect(authStore.isMember).toBe(true);

    authStore.profileIdentity = { ...authStore.profileIdentity, status: IDENTITY_STATUS.PROFILE_MISSING };
    expect(authStore.isGuest).toBe(false);
    expect(authStore.isMember).toBe(false);
  });
});
