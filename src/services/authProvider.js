import { supabase } from './supabase';
import { SERVICE_ERROR_CODE, ServiceError, normalizeServiceError } from './serviceError';

export const OAUTH_RETURN_TO_KEY = 'ootie_oauth_return_to-v1';
const PROVIDERS = new Set(['google']);

export const normalizeReturnTo = (value) => {
  const path = typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
  return path;
};

export const saveOAuthReturnTo = (value) => {
  const path = normalizeReturnTo(value);
  try { sessionStorage.setItem(OAUTH_RETURN_TO_KEY, path); } catch (e) { /* best effort */ }
  return path;
};

export const consumeOAuthReturnTo = () => {
  try {
    const value = sessionStorage.getItem(OAUTH_RETURN_TO_KEY);
    sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
    return normalizeReturnTo(value || '/');
  } catch (e) { return '/'; }
};

export async function signInWithProvider(provider, returnTo = '/', client = supabase) {
  const normalizedProvider = String(provider || '').toLowerCase();
  if (!PROVIDERS.has(normalizedProvider)) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '不支援的登入方式。' });
  saveOAuthReturnTo(returnTo);
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: normalizedProvider,
      options: { redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined }
    });
    if (error) throw error;
    return data;
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('provider') || message.includes('not enabled') || message.includes('unsupported')) {
      throw new ServiceError(SERVICE_ERROR_CODE.PROVIDER_NOT_CONFIGURED, { cause: error });
    }
    throw normalizeServiceError(error, SERVICE_ERROR_CODE.PROVIDER_NOT_CONFIGURED);
  }
}
