import { describe, expect, it, vi } from 'vitest';
import { hasOpenSosPost } from '../supabase';

describe('hasOpenSosPost', () => {
  const profileId = '11111111-1111-4111-8111-111111111111';

  it('queries one OPEN post ID by profile ID', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'sos-id' }], error: null });
    const eqStatus = vi.fn().mockReturnValue({ limit });
    const eqUser = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqUser });
    const client = { from: vi.fn().mockReturnValue({ select }) };

    await expect(hasOpenSosPost(profileId, client)).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith('ootie_sos_posts');
    expect(select).toHaveBeenCalledWith('id');
    expect(eqUser).toHaveBeenCalledWith('user_id', profileId);
    expect(eqStatus).toHaveBeenCalledWith('status', 'OPEN');
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('returns false for an empty result and rejects query failures', async () => {
    const makeClient = response => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => Promise.resolve(response)
            })
          })
        })
      })
    });

    await expect(hasOpenSosPost(profileId, makeClient({ data: [], error: null }))).resolves.toBe(false);
    await expect(hasOpenSosPost(profileId, makeClient({ data: null, error: new Error('offline') }))).rejects.toThrow('offline');
  });

  it('rejects invalid profile IDs without querying', async () => {
    const client = { from: vi.fn() };
    await expect(hasOpenSosPost('not-a-uuid', client)).rejects.toThrow('Invalid SOS author profile ID');
    expect(client.from).not.toHaveBeenCalled();
  });
});
