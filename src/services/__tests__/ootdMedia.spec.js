import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase', () => ({ supabase: {} }));

import {
  OOTD_IMAGE_BUCKET,
  OOTD_IMAGE_MAX_BYTES,
  removeOotdImage,
  uploadOotdImage,
  validateOotdImage
} from '../ootdMedia';

const authUserId = '11111111-1111-4111-8111-111111111111';

describe('OOTD media storage contract', () => {
  let bucket;
  let client;

  beforeEach(() => {
    bucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.test/ootd.jpg' } }),
      remove: vi.fn().mockResolvedValue({ error: null })
    };
    client = { storage: { from: vi.fn().mockReturnValue(bucket) } };
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('22222222-2222-4222-8222-222222222222');
  });

  it('accepts JPEG/PNG/WebP and rejects unsupported or oversized files', () => {
    expect(validateOotdImage(new File(['x'], 'look.webp', { type: 'image/webp' }))).toBeTruthy();
    expect(() => validateOotdImage(new File(['x'], 'look.svg', { type: 'image/svg+xml' }))).toThrow();
    const large = new File([new Uint8Array(OOTD_IMAGE_MAX_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' });
    expect(() => validateOotdImage(large)).toThrow();
  });

  it('uploads to an auth-owned OOTD path without overwrite', async () => {
    const result = await uploadOotdImage(new File(['x'], 'look.jpg', { type: 'image/jpeg' }), authUserId, client);
    expect(client.storage.from).toHaveBeenCalledWith(OOTD_IMAGE_BUCKET);
    expect(bucket.upload).toHaveBeenCalledWith(
      `ootd/${authUserId}/22222222-2222-4222-8222-222222222222.jpg`,
      expect.any(File),
      { contentType: 'image/jpeg', upsert: false }
    );
    expect(result.publicUrl).toBe('https://example.test/ootd.jpg');
  });

  it('refuses cross-user cleanup paths', async () => {
    await expect(removeOotdImage('ootd/99999999-9999-4999-8999-999999999999/x.jpg', authUserId, client)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});
