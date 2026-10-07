import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const socialMetrics = vi.hoisted(() => ({
  createPostLike: vi.fn(),
  deletePostLike: vi.fn(),
  createSavedOutfit: vi.fn(),
  deleteSavedOutfit: vi.fn()
}));
vi.mock('@/services/socialMetrics', () => socialMetrics);

import { useAppStore } from '../app';
import { useAuthStore } from '../auth';
import { useOotdStore } from '../ootd';

const profileId = '11111111-1111-4111-8111-111111111111';
const postId = '44444444-4444-4444-8444-444444444444';

describe('OOTD member save contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    socialMetrics.createSavedOutfit.mockReset();
    socialMetrics.deleteSavedOutfit.mockReset();
  });

  it('marks a member post saved only after the remote saved-outfit write succeeds', async () => {
    const appStore = useAppStore();
    const authStore = useAuthStore();
    const ootdStore = useOotdStore();
    const post = { ...appStore.ootdPosts[0], id: postId, saved: false };
    appStore.ootdPosts.splice(0, 1, post);
    authStore.session = { user: { id: 'auth-user-id' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId, profile: { id: profileId } };
    socialMetrics.createSavedOutfit.mockResolvedValue({ id: '77777777-7777-4777-8777-777777777777' });

    await ootdStore.toggleSave(postId);

    expect(socialMetrics.createSavedOutfit).toHaveBeenCalledWith(profileId, { target_type: 'OOTD', target_id: postId });
    expect(post.saved).toBe(true);
  });
});
