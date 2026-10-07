import { describe, expect, it, vi, beforeEach } from 'vitest';
import { consumeOAuthReturnTo, OAUTH_RETURN_TO_KEY, signInWithProvider } from '../authProvider';
import { SERVICE_ERROR_CODE } from '../serviceError';

describe('authProvider', () => {
  beforeEach(() => sessionStorage.clear());
  it('starts Google OAuth and stores internal returnTo', async () => {
    const signInWithOAuth = vi.fn(async () => ({ data: { url: 'https://example.test' }, error: null }));
    const client = { auth: { signInWithOAuth } };
    await signInWithProvider('google', '/tryon', client);
    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
    expect(sessionStorage.getItem(OAUTH_RETURN_TO_KEY)).toBe('/tryon');
    expect(consumeOAuthReturnTo()).toBe('/tryon');
    await expect(signInWithProvider('facebook', '/profile', client)).rejects.toMatchObject({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR });
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  });
  it('maps an unconfigured provider error and rejects unsupported providers', async () => {
    const client = { auth: { signInWithOAuth: vi.fn(async () => ({ data: null, error: { message: 'provider is not enabled' } })) } };
    await expect(signInWithProvider('google', '/', client)).rejects.toMatchObject({ code: SERVICE_ERROR_CODE.PROVIDER_NOT_CONFIGURED });
    await expect(signInWithProvider('instagram', '/', client)).rejects.toMatchObject({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR });
  });
});
