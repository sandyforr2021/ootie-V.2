import { describe, expect, it, vi } from 'vitest';
import {
  calculateHelpedFriends,
  calculateReceivedLikes,
  createPostLike,
  loadPostInteractionState,
  loadHelpedFriendsCount,
  loadHelpHistory,
  loadReceivedLikeCount,
  createSavedOutfit,
  countSavedOutfits
} from '../socialMetrics';
import { ServiceError, SERVICE_ERROR_CODE } from '../serviceError';

const profileA = '11111111-1111-4111-8111-111111111111';
const profileB = '22222222-2222-4222-822222222222';
const profileC = '33333333-3333-4333-8333-333333333333';
const ootdId = '44444444-4444-4444-8444-444444444444';

describe('socialMetrics', () => {
  it('counts distinct SOS requesters and excludes a self-SOS from helped friends', () => {
    const count = calculateHelpedFriends(profileA, [
      { user_id: profileA, sos: { user_id: profileB } },
      { user_id: profileA, sos: { user_id: profileB } },
      { user_id: profileA, sos: { user_id: profileC } },
      { user_id: profileA, sos: { user_id: profileA } }
    ]);

    expect(count).toBe(2);
  });

  it('counts likes only for the profile owner’s OOTD posts', () => {
    const count = calculateReceivedLikes(profileA, [
      { id: ootdId, user_id: profileA },
      { id: '55555555-5555-4555-8555-555555555555', user_id: profileA },
      { id: '66666666-6666-4666-8666-666666666666', user_id: profileB }
    ], [
      { post_id: ootdId },
      { post_id: ootdId },
      { post_id: '55555555-5555-4555-8555-555555555555' },
      { post_id: '66666666-6666-4666-8666-666666666666' }
    ]);

    expect(count).toBe(3);
  });

  it('creates a saved outfit using only the verified profile id and generic OOTD target', async () => {
    const saved = { id: '77777777-7777-4777-8777-777777777777', profile_id: profileA, target_type: 'OOTD', target_id: ootdId };
    const single = vi.fn().mockResolvedValue({ data: saved, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    await expect(createSavedOutfit(profileA, { target_type: 'OOTD', target_id: ootdId, profile_id: profileB }, { from }))
      .resolves.toEqual(saved);
    expect(from).toHaveBeenCalledWith('ootie_saved_outfits');
    expect(insert).toHaveBeenCalledWith({ profile_id: profileA, target_type: 'OOTD', target_id: ootdId });
  });

  it('counts every remote saved outfit without using the paginated collection query', async () => {
    const eq = vi.fn().mockResolvedValue({ count: 24, error: null });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    await expect(countSavedOutfits(profileA, { from })).resolves.toBe(24);
    expect(from).toHaveBeenCalledWith('ootie_saved_outfits');
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(eq).toHaveBeenCalledWith('profile_id', profileA);
  });

  it('rejects a legacy or malformed target before contacting Supabase', async () => {
    const from = vi.fn();
    await expect(createSavedOutfit('profile-01', { target_type: 'OOTD', target_id: ootdId }, { from }))
      .rejects.toMatchObject({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR });
    await expect(createSavedOutfit(profileA, { target_type: 'POST', target_id: ootdId }, { from }))
      .rejects.toBeInstanceOf(ServiceError);
    expect(from).not.toHaveBeenCalled();
  });

  it('creates a remote like only for the verified profile and target post', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: '88888888-8888-4888-8888-888888888888' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    await createPostLike(profileA, ootdId, { from });

    expect(from).toHaveBeenCalledWith('ootie_post_likes');
    expect(insert).toHaveBeenCalledWith({ user_id: profileA, post_id: ootdId });
  });

  it('hydrates the member like and save state from authoritative remote rows', async () => {
    const likedPostId = ootdId;
    const savedPostId = '55555555-5555-4555-8555-555555555555';
    const from = vi.fn((table) => ({
      select: () => ({
        eq: () => table === 'ootie_saved_outfits'
          ? { eq: vi.fn().mockResolvedValue({ data: [{ target_id: savedPostId }], error: null }) }
          : Promise.resolve({ data: [{ post_id: likedPostId }], error: null })
      })
    }));

    const state = await loadPostInteractionState(profileA, { from });

    expect([...state.likedPostIds]).toEqual([likedPostId]);
    expect([...state.savedPostIds]).toEqual([savedPostId]);
  });

  it('loads received likes from remote rows for only the profile’s OOTD posts', async () => {
    const likeSelect = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({
      data: [{ post_id: ootdId }, { post_id: ootdId }], error: null
    }) });
    const postSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({
      data: [{ id: ootdId }], error: null
    }) });
    const from = vi.fn((table) => ({ select: table === 'ootie_ootd_posts' ? postSelect : likeSelect }));

    await expect(loadReceivedLikeCount(profileA, { from })).resolves.toBe(2);
    expect(from).toHaveBeenCalledWith('ootie_ootd_posts');
    expect(from).toHaveBeenCalledWith('ootie_post_likes');
  });

  it('loads lifetime distinct SOS requesters from persisted suggestions', async () => {
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({
      data: [
        { user_id: profileA, ootie_sos_posts: { user_id: profileB } },
        { user_id: profileA, ootie_sos_posts: { user_id: profileB } },
        { user_id: profileA, ootie_sos_posts: { user_id: profileC } },
        { user_id: profileA, ootie_sos_posts: { user_id: profileA } }
      ], error: null
    }) });
    const from = vi.fn().mockReturnValue({ select });

    await expect(loadHelpedFriendsCount(profileA, { from })).resolves.toBe(2);
    expect(from).toHaveBeenCalledWith('ootie_outfit_suggestions');
  });

  it('loads only a member’s recent suggestion history for the requested rolling window', async () => {
    const gte = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ gte });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const now = new Date('2026-09-30T00:00:00.000Z');

    await expect(loadHelpHistory(profileA, 7, { from }, now)).resolves.toEqual([]);
    expect(eq).toHaveBeenCalledWith('user_id', profileA);
    expect(gte).toHaveBeenCalledWith('created_at', '2026-09-23T00:00:00.000Z');
  });
});
