import { describe, expect, it, vi } from 'vitest';
import {
  loadProfileByAuthUserId,
  getProfileById,
  updateProfile,
  upsertProfile,
  getPublicProfileByUsername,
  upsertPrivateProfile,
  getPrivateProfile,
  updatePublicProfile,
  bootstrapOAuthProfile
} from '../profileRepository';
import { ServiceError, SERVICE_ERROR_CODE } from '../serviceError';

describe('profileRepository', () => {
  const mockAuthUserId = '11111111-1111-4111-8111-111111111111';
  const mockProfileId = '22222222-2222-4222-8222-222222222222';

  it('bootstraps an OAuth profile without writing private profile fields', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: mockProfileId }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const upsert = vi.fn().mockReturnValue({ select });
    const findProfile = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert, select: vi.fn(() => ({ eq: findProfile })) }) };
    await bootstrapOAuthProfile({ user: { id: mockAuthUserId, email: 'new.user@example.com', user_metadata: { full_name: 'New User', picture: 'https://example.com/avatar.jpg' } } }, client);
    expect(client.from).toHaveBeenCalledWith('ootie_profiles');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: mockAuthUserId, display_name: 'New User' }),
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
    expect(upsert.mock.calls[0][0].public_closet).toBe(false);
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('birth_date');
  });

  it('updates an existing OAuth profile without changing public_closet', async () => {
    const existing = { id: mockProfileId, user_id: mockAuthUserId, public_closet: true };
    const findProfile = vi.fn().mockResolvedValue({ data: [existing], error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const upsert = vi.fn();
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn(() => ({ eq: findProfile })),
        update,
        upsert
      })
    };

    const result = await bootstrapOAuthProfile({
      user: {
        id: mockAuthUserId,
        email: 'existing.user@example.com',
        user_metadata: { full_name: 'Existing User' }
      }
    }, client);

    expect(result.public_closet).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ username: '@existing_user_111111' }));
    expect(update.mock.calls[0][0]).not.toHaveProperty('public_closet');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('does not overwrite public_closet if another OAuth bootstrap creates the profile concurrently', async () => {
    const existing = { id: mockProfileId, user_id: mockAuthUserId, public_closet: true };
    const findProfile = vi.fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [existing], error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn(() => ({ eq: findProfile })),
        update,
        upsert
      })
    };

    await bootstrapOAuthProfile({
      user: {
        id: mockAuthUserId,
        email: 'existing.user@example.com',
        user_metadata: { full_name: 'Existing User' }
      }
    }, client);

    expect(upsert.mock.calls[0][0].public_closet).toBe(false);
    expect(upsert.mock.calls[0][1].ignoreDuplicates).toBe(true);
    expect(update.mock.calls[0][0]).not.toHaveProperty('public_closet');
  });

  describe('loadProfileByAuthUserId', () => {
    it('throws VALIDATION_ERROR when authUserId is not a valid UUID', async () => {
      await expect(loadProfileByAuthUserId('invalid-uuid')).rejects.toThrowError(ServiceError);
      await expect(loadProfileByAuthUserId('invalid-uuid')).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.VALIDATION_ERROR
      });
    });

    it('returns null when no profile matches the authUserId', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      };

      const result = await loadProfileByAuthUserId(mockAuthUserId, mockClient);
      expect(result).toBeNull();
      expect(mockClient.from).toHaveBeenCalledWith('ootie_profiles');
    });

    it('returns the profile when exactly one row exists', async () => {
      const expectedProfile = {
        id: mockProfileId,
        user_id: mockAuthUserId,
        name: 'Hayley',
        username: 'hayley'
      };
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [expectedProfile], error: null })
          })
        })
      };

      const result = await loadProfileByAuthUserId(mockAuthUserId, mockClient);
      expect(result).toEqual(expectedProfile);
    });

    it('throws error when multiple profiles exist for one auth user', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: '1' }, { id: '2' }],
              error: null
            })
          })
        })
      };

      await expect(loadProfileByAuthUserId(mockAuthUserId, mockClient)).rejects.toThrowError(
        '帳號關聯了多筆個人檔案，資料不一致。'
      );
    });

    it('normalizes and throws Supabase errors', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'JWT expired', status: 401 }
            })
          })
        })
      };

      await expect(loadProfileByAuthUserId(mockAuthUserId, mockClient)).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.AUTH_REQUIRED
      });
    });
  });

  describe('getProfileById', () => {
    it('returns null for non-UUID id', async () => {
      const result = await getProfileById('not-uuid');
      expect(result).toBeNull();
    });

    it('queries and returns profile by id', async () => {
      const profile = { id: mockProfileId, name: 'Sinsin' };
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null })
            })
          })
        })
      };

      const result = await getProfileById(mockProfileId, mockClient);
      expect(result).toEqual(profile);
      expect(mockClient.from).toHaveBeenCalledWith('ootie_profiles');
    });
  });

  describe('updateProfile', () => {
    it('throws validation error for invalid profileId', async () => {
      await expect(updateProfile('bad-id', { name: 'New' })).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.VALIDATION_ERROR
      });
    });

    it('updates only allowed columns', async () => {
      const updated = { id: mockProfileId, name: 'Updated Name' };
      const updateFn = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: updated, error: null })
          })
        })
      });

      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: updateFn
        })
      };

      const result = await updateProfile(mockProfileId, { name: 'Updated Name', hackerField: 'bad' }, mockClient);
      expect(result).toEqual(updated);
      expect(updateFn).toHaveBeenCalledWith({ name: 'Updated Name' });
    });
  });

  describe('upsertProfile', () => {
    it('throws validation error when authUserId is not UUID', async () => {
      await expect(upsertProfile({ name: 'Test' }, 'bad-user')).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.VALIDATION_ERROR
      });
    });

    it('upserts profile tied to user_id', async () => {
      const upserted = { id: mockProfileId, user_id: mockAuthUserId, name: 'New User' };
      const upsertFn = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: upserted, error: null })
        })
      });

      const mockClient = {
        from: vi.fn().mockReturnValue({
          upsert: upsertFn
        })
      };

      const result = await upsertProfile({ name: 'New User' }, mockAuthUserId, mockClient);
      expect(result).toEqual(upserted);
      expect(upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockAuthUserId,
          name: 'New User'
        }),
        { onConflict: 'user_id', ignoreDuplicates: true }
      );
    });
  });

  it('public profile query explicitly excludes private account fields', async () => {
    const select = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [{ id: mockProfileId, username: '@sandy', display_name: 'Sandy' }], error: null })
    });
    const client = { from: vi.fn().mockReturnValue({ select }) };
    const result = await getPublicProfileByUsername('@sandy', client);
    expect(result.username).toBe('@sandy');
    expect(select.mock.calls[0][0]).not.toContain('full_name');
    expect(select.mock.calls[0][0]).not.toContain('birth_date');
    expect(select.mock.calls[0][0]).not.toContain('phone');
    expect(select.mock.calls[0][0]).not.toContain('email');
    expect(select.mock.calls[0][0]).not.toContain('user_id');
    expect(select.mock.calls[0][0]).not.toContain('display_name_changed_at');
    expect(select.mock.calls[0][0].split(',')).not.toContain('name');
  });

  it('private profile writes inject profile_id and public writes ignore private fields', async () => {
    const upsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { profile_id: mockProfileId }, error: null }) }) });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: mockProfileId }, error: null }) }) }) });
    const client = { from: vi.fn((table) => table === 'ootie_profile_private' ? { upsert } : { update }) };
    await upsertPrivateProfile(mockProfileId, { full_name: 'Sandy', profile_id: 'forged' }, client);
    expect(upsert).toHaveBeenCalledWith({ profile_id: mockProfileId, full_name: 'Sandy' }, { onConflict: 'profile_id' });
    await updatePublicProfile(mockProfileId, { display_name: 'Sandy', full_name: 'PRIVATE', birth_date: '1990-01-01' }, client);
    expect(update).toHaveBeenCalledWith({ display_name: 'Sandy' });
  });

  it('private reads only the private table contract', async () => {
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { profile_id: mockProfileId, full_name: 'Sandy' }, error: null }) }) });
    const client = { from: vi.fn().mockReturnValue({ select }) };
    await getPrivateProfile(mockProfileId, client);
    expect(client.from).toHaveBeenCalledWith('ootie_profile_private');
    expect(select.mock.calls[0][0]).toContain('full_name');
  });
});
