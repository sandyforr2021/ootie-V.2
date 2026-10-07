import { describe, expect, it, vi } from 'vitest';
import { followProfile, getFollowCounts } from '../socialRepository';

const followerId = '11111111-1111-4111-8111-111111111111';
const followingId = '22222222-2222-4222-8222-222222222222';

describe('socialRepository', () => {
  it('prevents self-follow before a remote write', async () => {
    const client = { from: vi.fn() };
    await expect(followProfile(followerId, followerId, client)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('creates a remote follow pair and returns the persisted row', async () => {
    const row = { id: '33333333-3333-4333-8333-333333333333', follower_id: followerId, following_id: followingId };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    await expect(followProfile(followerId, followingId, client)).resolves.toEqual(row);
    expect(insert).toHaveBeenCalledWith({ follower_id: followerId, following_id: followingId });
  });

  it('loads follower and following counts independently', async () => {
    const results = [{ count: 9, error: null }, { count: 4, error: null }];
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue(results.shift()) }))
      }))
    };
    await expect(getFollowCounts(followerId, client)).resolves.toEqual({ followers: 9, following: 4 });
  });
});
