import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const socialMetrics = vi.hoisted(() => ({
  createSavedOutfit: vi.fn(),
  deleteSavedOutfit: vi.fn()
}));
vi.mock('@/services/socialMetrics', () => socialMetrics);

import { useAppStore } from '../app';
import { useAuthStore } from '../auth';
import { useSosStore } from '../sos';

const profileId = '11111111-1111-4111-8111-111111111111';
const sosId = '44444444-4444-4444-8444-444444444444';

describe('SOS saved outfit contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
    socialMetrics.createSavedOutfit.mockReset();
    socialMetrics.deleteSavedOutfit.mockReset();
  });

  it('marks a member SOS saved only after the remote saved-outfit write succeeds', async () => {
    const appStore = useAppStore();
    const authStore = useAuthStore();
    const sosStore = useSosStore();
    sosStore.sosPosts.splice(0, 1, { ...sosStore.sosPosts[0], id: sosId, saved: false });
    authStore.session = { user: { id: 'auth-user-id' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId, profile: { id: profileId } };
    socialMetrics.createSavedOutfit.mockResolvedValue({ id: '77777777-7777-4777-8777-777777777777' });

    await sosStore.toggleSave(sosId);

    expect(socialMetrics.createSavedOutfit).toHaveBeenCalledWith(profileId, { target_type: 'SOS', target_id: sosId });
    expect(sosStore.sosPosts[0].saved).toBe(true);
    expect(appStore.toastSyncStatus).toBe('SYNCED');
  });
});
