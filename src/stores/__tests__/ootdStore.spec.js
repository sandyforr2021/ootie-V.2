import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const remote = vi.hoisted(() => ({
  fetchProfileOotdPosts: vi.fn(),
  insertOotdPost: vi.fn(),
  updateOotdPost: vi.fn(),
  deleteOotdPost: vi.fn()
}));
const clothing = vi.hoisted(() => ({ getCurrentUserItems: vi.fn(), getPublicItemsByIds: vi.fn() }));
const media = vi.hoisted(() => ({ uploadOotdImage: vi.fn(), removeOotdImage: vi.fn() }));
const social = vi.hoisted(() => ({
  createPostLike: vi.fn(), deletePostLike: vi.fn(),
  createSavedOutfit: vi.fn(), deleteSavedOutfit: vi.fn()
}));

vi.mock('@/services/supabase', () => ({
  ...remote,
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() } }
}));
vi.mock('@/services/clothingRepository', () => clothing);
vi.mock('@/services/ootdMedia', () => media);
vi.mock('@/services/socialMetrics', () => social);

import { useAppStore } from '../app';
import { useAuthStore } from '../auth';
import { uniquePostsById, useOotdStore } from '../ootd';
import { IDENTITY_STATUS } from '@/services/identityResolver';

const authUserId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const postId = '44444444-4444-4444-8444-444444444444';

const prepareMember = () => {
  const appStore = useAppStore();
  const authStore = useAuthStore();
  authStore.session = { user: { id: authUserId } };
  authStore.user = authStore.session.user;
  authStore.profileIdentity = {
    status: IDENTITY_STATUS.PROFILE_READY,
    authUserId,
    profileId,
    profile: { id: profileId, username: '@owner' },
    error: null
  };
  appStore.setMemberProfile({ id: profileId, user_id: authUserId, username: '@owner', initials: 'OW' });
  appStore.items = [{ id: itemId, owner_id: profileId, name: 'Classic Shirt', name_zh: '白色經典襯衫', photo: '/shirt.jpg' }];
  clothing.getCurrentUserItems.mockResolvedValue(appStore.items);
  clothing.getPublicItemsByIds.mockResolvedValue(appStore.items);
  media.uploadOotdImage.mockResolvedValue({
    path: `ootd/${authUserId}/image.jpg`,
    publicUrl: 'https://example.test/image.jpg'
  });
  media.removeOotdImage.mockResolvedValue(true);
  remote.insertOotdPost.mockResolvedValue({
    id: postId,
    user_id: profileId,
    image: 'https://example.test/image.jpg',
    image_storage_path: `ootd/${authUserId}/image.jpg`,
    caption: '今日穿搭',
    item_ids: [itemId],
    wearing: ['白色經典襯衫'],
    hashtags: ['#daily'],
    likes: 0,
    comments: 0,
    created_at: '2026-09-30T00:00:00.000Z'
  });
  return { appStore, authStore, ootdStore: useOotdStore() };
};

describe('OOTD publish and actions contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('renders each Explore post ID only once even if the data source repeats a row', async () => {
    const { appStore, ootdStore } = prepareMember();
    const repeated = { id: postId, user_id: profileId, caption: '同一篇', image: '/look.jpg' };
    appStore.ootdPosts = [repeated, { ...repeated }, { ...repeated, id: 'unique-post', image: '/other-look.jpg' }];

    expect(uniquePostsById(appStore.ootdPosts).map((post) => post.id)).toEqual([postId, 'unique-post']);
    expect(ootdStore.filteredPosts.map((post) => post.id)).toEqual([postId, 'unique-post']);
  });

  it('publishes only after upload and remote insert succeed', async () => {
    const { appStore, ootdStore } = prepareMember();
    const before = appStore.ootdPosts.length;
    const file = new File(['photo'], 'ootd.jpg', { type: 'image/jpeg' });

    const result = await ootdStore.createPost({
      imageFile: file,
      caption: '今日穿搭',
      hashtags: '#daily',
      selectedItemIds: [itemId]
    });

    expect(media.uploadOotdImage).toHaveBeenCalledBefore(remote.insertOotdPost);
    expect(remote.insertOotdPost).toHaveBeenCalledWith(expect.objectContaining({
      item_ids: [itemId],
      wearing: [{ id: itemId, name: '白色經典襯衫', photo: '' }]
    }), profileId);
    expect(result.syncStatus).toBe('SYNCED');
    expect(appStore.ootdPosts).toHaveLength(before + 1);
    expect(appStore.ootdPosts[0].id).toBe(postId);
  });

  it('preserves the draft contract and does not add a post on remote failure', async () => {
    const { appStore, ootdStore } = prepareMember();
    const before = appStore.ootdPosts.length;
    remote.insertOotdPost.mockResolvedValue(null);

    const result = await ootdStore.createPost({
      imageFile: new File(['photo'], 'ootd.jpg', { type: 'image/jpeg' }),
      caption: '保留草稿', hashtags: '', selectedItemIds: []
    });

    expect(result.syncStatus).toBe('REMOTE_FAILED');
    expect(appStore.ootdPosts).toHaveLength(before);
    expect(media.removeOotdImage).toHaveBeenCalled();
  });

  it('rejects a clothing tag that is not in the member remote closet', async () => {
    const { ootdStore } = prepareMember();
    clothing.getCurrentUserItems.mockResolvedValue([]);

    const result = await ootdStore.createPost({
      imageFile: new File(['photo'], 'ootd.jpg', { type: 'image/jpeg' }),
      caption: '非法標註', hashtags: '', selectedItemIds: [itemId]
    });

    expect(result.syncStatus).toBe('REMOTE_FAILED');
    expect(media.uploadOotdImage).not.toHaveBeenCalled();
    expect(remote.insertOotdPost).not.toHaveBeenCalled();
  });

  it('blocks a double submit while the first publish is pending', async () => {
    const { ootdStore } = prepareMember();
    let release;
    media.uploadOotdImage.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const input = { imageFile: new File(['photo'], 'ootd.jpg', { type: 'image/jpeg' }), caption: '一次', hashtags: '', selectedItemIds: [] };

    const first = ootdStore.createPost(input);
    const second = await ootdStore.createPost(input);
    expect(second.syncStatus).toBe('IN_PROGRESS');
    release({ path: `ootd/${authUserId}/image.jpg`, publicUrl: 'https://example.test/image.jpg' });
    await first;
    expect(remote.insertOotdPost).toHaveBeenCalledTimes(1);
  });

  it('keeps the post visible when remote delete fails', async () => {
    const { appStore, ootdStore } = prepareMember();
    appStore.ootdPosts.unshift({ id: postId, user_id: profileId, username: '@owner', image: '/x.jpg' });
    remote.deleteOotdPost.mockResolvedValue(false);

    expect(await ootdStore.deletePost(postId)).toBe(false);
    expect(appStore.ootdPosts.some((post) => post.id === postId)).toBe(true);
  });

  it('uses native share, treats cancellation as neutral, and opens fallback when unavailable', async () => {
    const { appStore, ootdStore } = prepareMember();
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: nativeShare, configurable: true });
    expect(await ootdStore.sharePost(postId)).toBe('SHARED');
    expect(nativeShare).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining(`/ootd/${postId}`) }));

    nativeShare.mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    appStore.toastMessage = '';
    expect(await ootdStore.sharePost(postId)).toBe('CANCELLED');
    expect(appStore.toastMessage).toBe('');

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    expect(await ootdStore.sharePost(postId)).toBe('FALLBACK');
    expect(ootdStore.shareSheetPostId).toBe(postId);
  });
});
