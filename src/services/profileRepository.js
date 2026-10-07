import { supabase } from './supabase';
import {
  SERVICE_ERROR_CODE,
  ServiceError,
  normalizeServiceError
} from './serviceError';

const isUuid = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const SELF_PROFILE_SELECT = 'id,user_id,username,display_name,slogan,avatar_url,avatar_storage_path,initials,name,hearts,helped,likes,public_closet,display_name_changed_at';
export const PUBLIC_PROFILE_SELECT = 'id,username,display_name,slogan,avatar_url,avatar_storage_path,initials,hearts,helped,likes,public_closet';
export const PUBLIC_PROFILE_FIELDS = ['username', 'display_name', 'slogan', 'avatar_url', 'avatar_storage_path', 'initials', 'public_closet'];
export const PRIVATE_PROFILE_FIELDS = ['full_name', 'birth_date', 'phone', 'weather_city'];

/**
 * Repository layer for public.ootie_profiles.
 * Strictly adheres to AUTH_IDENTITY_MODEL:
 * - auth.users.id is the authentication identity.
 * - ootie_profiles.id is the domain profile identity.
 * - Never uses fixed mock identities (user-01, profile-01).
 */

/**
 * Loads the single OOTIE profile corresponding to an auth user id.
 * @param {string} authUserId - The auth.users.id UUID.
 * @param {object} [client=supabase] - Supabase client instance.
 * @returns {Promise<object|null>} The profile object or null if not found.
 */
export async function loadProfileByAuthUserId(authUserId, client = supabase) {
  if (!isUuid(authUserId)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      userMessage: '無效的使用者身分識別碼。'
    });
  }

  try {
    const { data, error } = await client
      .from('ootie_profiles')
      .select(SELF_PROFILE_SELECT)
      .eq('user_id', authUserId);

    if (error) {
      throw normalizeServiceError(error);
    }

    if (!data || data.length === 0) {
      return null;
    }

    if (data.length > 1) {
      throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
        message: '帳號關聯了多筆個人檔案，資料不一致。',
        userMessage: '帳號關聯了多筆個人檔案，資料不一致。'
      });
    }

    return data[0];
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

/**
 * Fetches an OOTIE profile by its primary key (ootie_profiles.id).
 * @param {string} profileId - Profile UUID.
 * @param {object} [client=supabase] - Supabase client instance.
 * @returns {Promise<object|null>}
 */
export async function getProfileById(profileId, client = supabase) {
  if (!isUuid(profileId)) {
    return null;
  }

  try {
    const { data, error } = await client
      .from('ootie_profiles')
      .select(PUBLIC_PROFILE_SELECT)
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      throw normalizeServiceError(error);
    }

    return data || null;
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

/**
 * Updates profile fields by profile ID.
 * @param {string} profileId - The ootie_profiles.id UUID.
 * @param {object} profileData - Profile updates.
 * @param {object} [client=supabase] - Supabase client instance.
 * @returns {Promise<object>}
 */
export async function updateProfile(profileId, profileData, client = supabase) {
  if (!isUuid(profileId)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      userMessage: '無效的個人檔案 ID。'
    });
  }

  const allowedColumns = [
    'name',
    'username',
    'avatar_url',
    'bio',
    'initials',
    'hearts',
    'helped',
    'likes',
    'public_closet'
  ];

  const payload = {};
  for (const col of allowedColumns) {
    if (profileData[col] !== undefined) {
      payload[col] = profileData[col];
    }
  }

  try {
    const { data, error } = await client
      .from('ootie_profiles')
      .update(payload)
      .eq('id', profileId)
      .select()
      .maybeSingle();

    if (error) {
      throw normalizeServiceError(error);
    }

    return data;
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

/**
 * Upserts a profile record for an auth user.
 * @param {object} profileData - Profile attributes.
 * @param {string} authUserId - The auth.users.id UUID.
 * @param {object} [client=supabase] - Supabase client instance.
 * @returns {Promise<object>}
 */
export async function upsertProfile(profileData, authUserId, client = supabase) {
  if (!isUuid(authUserId)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      userMessage: '無效的使用者身分識別碼。'
    });
  }

  const payload = {
    user_id: authUserId,
    name: profileData.name || null,
    username: profileData.username || null,
    avatar_url: profileData.avatar_url || null,
    bio: profileData.bio || null,
    initials: profileData.initials || null,
    public_closet: profileData.public_closet ?? false
  };
  if (profileData.display_name !== undefined) payload.display_name = profileData.display_name;
  if (profileData.slogan !== undefined) payload.slogan = profileData.slogan;

  try {
    const { data, error } = await client
      .from('ootie_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (error) {
      throw normalizeServiceError(error);
    }

    return data;
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

export async function bootstrapOAuthProfile(session, client = supabase) {
  const user = session?.user;
  if (!isUuid(user?.id)) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: 'OAuth 使用者身分無效。' });
  const metadata = user.user_metadata || {};
  const rawName = String(metadata.full_name || metadata.name || user.email?.split('@')[0] || 'OOTIE 會員').trim().slice(0, 30);
  const emailStem = String(user.email?.split('@')[0] || 'member').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 18) || 'member';
  const username = `@${emailStem}_${user.id.slice(0, 6)}`;
  const initials = rawName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'OT';
  return upsertProfile({
    name: rawName,
    display_name: rawName,
    username,
    avatar_url: metadata.avatar_url || metadata.picture || null,
    initials,
    slogan: '用衣櫥記錄日常，也和衣友分享穿搭靈感。',
    public_closet: false
  }, user.id, client);
}

export async function getPublicProfileByUsername(username, client = supabase) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return null;
  try {
    const { data, error } = await client.from('ootie_profiles')
      .select(PUBLIC_PROFILE_SELECT)
      .eq('username', normalized.startsWith('@') ? normalized : `@${normalized}`);
    if (error) throw normalizeServiceError(error);
    return data?.[0] || null;
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

export async function updatePublicProfile(profileId, profileData, client = supabase) {
  if (!isUuid(profileId)) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '無效的個人檔案 ID。' });
  const payload = {};
  for (const field of PUBLIC_PROFILE_FIELDS) if (profileData?.[field] !== undefined) payload[field] = profileData[field];
  try {
    const { data, error } = await client.from('ootie_profiles').update(payload).eq('id', profileId).select(SELF_PROFILE_SELECT).maybeSingle();
    if (error) throw normalizeServiceError(error);
    return data;
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

export async function getPrivateProfile(profileId, client = supabase) {
  if (!isUuid(profileId)) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '無效的個人檔案 ID。' });
  try {
    const { data, error } = await client.from('ootie_profile_private').select(`profile_id,${PRIVATE_PROFILE_FIELDS.join(',')}`).eq('profile_id', profileId).maybeSingle();
    if (error) throw normalizeServiceError(error);
    return data || null;
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

export async function upsertPrivateProfile(profileId, profileData, client = supabase) {
  if (!isUuid(profileId)) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '無效的個人檔案 ID。' });
  const payload = { profile_id: profileId };
  for (const field of PRIVATE_PROFILE_FIELDS) if (profileData?.[field] !== undefined) payload[field] = profileData[field];
  try {
    const { data, error } = await client.from('ootie_profile_private').upsert(payload, { onConflict: 'profile_id' }).select(`profile_id,${PRIVATE_PROFILE_FIELDS.join(',')}`).maybeSingle();
    if (error) throw normalizeServiceError(error);
    return data;
  } catch (err) {
    throw normalizeServiceError(err);
  }
}
