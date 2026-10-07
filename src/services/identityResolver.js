import { SERVICE_ERROR_CODE, ServiceError, normalizeServiceError } from './serviceError';

export const IDENTITY_STATUS = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  PROFILE_LOADING: 'PROFILE_LOADING',
  PROFILE_READY: 'PROFILE_READY',
  PROFILE_MISSING: 'PROFILE_MISSING',
  PROFILE_QUERY_ERROR: 'PROFILE_QUERY_ERROR'
});

const identityState = (status, values = {}) => ({
  status,
  authUserId: values.authUserId || null,
  profileId: values.profileId || null,
  profile: values.profile || null,
  error: values.error || null
});

/**
 * Frontend-only identity bridge. The profile lookup is injected so this module
 * has no table name, Supabase client, schema, or migration dependency.
 */
export function createIdentityResolver({ loadProfileByAuthUserId, onStateChange } = {}) {
  let current = identityState(IDENTITY_STATUS.UNAUTHENTICATED);

  const publish = (next) => {
    current = next;
    onStateChange?.(next);
    return next;
  };

  const resolve = async (session) => {
    const authUserId = session?.user?.id || null;
    if (!authUserId) return publish(identityState(IDENTITY_STATUS.UNAUTHENTICATED));

    if (typeof loadProfileByAuthUserId !== 'function') {
      return publish(identityState(IDENTITY_STATUS.PROFILE_QUERY_ERROR, {
        authUserId,
        error: new ServiceError(SERVICE_ERROR_CODE.PROFILE_MISSING, {
          userMessage: '個人檔案查詢尚未接上已核准的 identity migration。'
        })
      }));
    }

    publish(identityState(IDENTITY_STATUS.PROFILE_LOADING, { authUserId }));
    try {
      const profile = await loadProfileByAuthUserId(authUserId);
      if (!profile?.id) {
        return publish(identityState(IDENTITY_STATUS.PROFILE_MISSING, {
          authUserId,
          error: new ServiceError(SERVICE_ERROR_CODE.PROFILE_MISSING)
        }));
      }
      return publish(identityState(IDENTITY_STATUS.PROFILE_READY, {
        authUserId,
        profileId: profile.id,
        profile
      }));
    } catch (error) {
      return publish(identityState(IDENTITY_STATUS.PROFILE_QUERY_ERROR, {
        authUserId,
        error: normalizeServiceError(error)
      }));
    }
  };

  return {
    resolve,
    getState: () => current
  };
}
