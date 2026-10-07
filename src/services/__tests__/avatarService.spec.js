import { describe, expect, it, vi } from 'vitest';
import { AVATAR_BUCKET, MAX_AVATAR_BYTES, uploadAvatar, validateAvatarFile } from '../avatarService';
import { SERVICE_ERROR_CODE } from '../serviceError';

const userId = '11111111-1111-4111-8111-111111111111';
describe('avatarService', () => {
  it('accepts JPEG/PNG/WebP and rejects unsupported or oversized files', () => {
    expect(validateAvatarFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(() => validateAvatarFile(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toThrowError(expect.objectContaining({ code: SERVICE_ERROR_CODE.AVATAR_INVALID }));
    const large = { type: 'image/png', size: MAX_AVATAR_BYTES + 1 };
    expect(() => validateAvatarFile(large)).toThrowError(expect.objectContaining({ code: SERVICE_ERROR_CODE.AVATAR_TOO_LARGE }));
  });

  it('uploads under a per-user path and returns the public URL', async () => {
    const upload = vi.fn(async (path) => ({ data: { path }, error: null }));
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://cdn/avatar.png' } }));
    const client = { storage: { from: vi.fn(() => ({ upload, getPublicUrl })) } };
    const result = await uploadAvatar(new File(['x'], 'a.png', { type: 'image/png' }), userId, client);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^avatars/${userId}/`)), expect.any(File), expect.objectContaining({ contentType: 'image/png', upsert: false }));
    expect(result.publicUrl).toBe('https://cdn/avatar.png');
    expect(client.storage.from).toHaveBeenCalledWith(AVATAR_BUCKET);
  });
});
