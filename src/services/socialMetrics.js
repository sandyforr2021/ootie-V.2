import { supabase } from './supabase';
import {
  SERVICE_ERROR_CODE,
  ServiceError,
  normalizeServiceError
} from './serviceError';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAVED_TARGET_TYPES = new Set(['OOTD', 'SOS']);

const requireUuid = (value, userMessage) => {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage });
  }
};

const normalizeSavedOutfitError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  if (code === '42P01' || message.includes('ootie_saved_outfits') && message.includes('does not exist')) {
    return new ServiceError(SERVICE_ERROR_CODE.SAVED_OUTFITS_NOT_READY, { cause: error });
  }
  return normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
};

/** Counts unique SOS requesters that this profile has actually helped. */
export function calculateHelpedFriends(profileId, suggestions) {
  const requesters = new Set();
  for (const suggestion of suggestions || []) {
    if (suggestion?.user_id !== profileId) continue;
    const requesterId = suggestion?.sos?.user_id;
    if (requesterId && requesterId !== profileId) requesters.add(requesterId);
  }
  return requesters.size;
}

/** Counts persisted likes on OOTD posts authored by this profile. */
export function calculateReceivedLikes(profileId, posts, likes) {
  const ownPostIds = new Set((posts || [])
    .filter((post) => post?.user_id === profileId)
    .map((post) => post.id));
  return (likes || []).filter((like) => ownPostIds.has(like?.post_id)).length;
}

export async function createPostLike(profileId, postId, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  requireUuid(postId, '無效的貼文 ID。');
  try {
    const { data, error } = await client
      .from('ootie_post_likes')
      .insert({ user_id: profileId, post_id: postId })
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    return data;
  } catch (error) {
    throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  }
}

export async function deletePostLike(profileId, postId, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  requireUuid(postId, '無效的貼文 ID。');
  try {
    const { data, error } = await client
      .from('ootie_post_likes')
      .delete()
      .eq('user_id', profileId)
      .eq('post_id', postId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND);
    return data;
  } catch (error) {
    throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  }
}

export async function loadPostInteractionState(profileId, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  try {
    const [likes, saves] = await Promise.all([
      client.from('ootie_post_likes').select('post_id').eq('user_id', profileId),
      client.from('ootie_saved_outfits').select('target_id').eq('profile_id', profileId).eq('target_type', 'OOTD')
    ]);
    if (likes.error) throw likes.error;
    if (saves.error) throw saves.error;
    return {
      likedPostIds: new Set((likes.data || []).map((row) => String(row.post_id))),
      savedPostIds: new Set((saves.data || []).map((row) => String(row.target_id)))
    };
  } catch (error) {
    throw normalizeSavedOutfitError(error);
  }
}

/** Reads the authoritative received-like total; it never consults local feed state. */
export async function loadReceivedLikeCount(profileId, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  try {
    const { data: posts, error: postError } = await client
      .from('ootie_ootd_posts')
      .select('id')
      .eq('user_id', profileId);
    if (postError) throw postError;
    const postIds = (posts || []).map((post) => post.id).filter(Boolean);
    if (!postIds.length) return 0;

    const { data: likes, error: likeError } = await client
      .from('ootie_post_likes')
      .select('post_id')
      .in('post_id', postIds);
    if (likeError) throw likeError;
    return (likes || []).length;
  } catch (error) {
    throw normalizeServiceError(error);
  }
}

/** Reads the lifetime number of distinct SOS requesters the profile helped. */
export async function loadHelpedFriendsCount(profileId, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  try {
    const { data, error } = await client
      .from('ootie_outfit_suggestions')
      .select('user_id, ootie_sos_posts!inner(user_id)')
      .eq('user_id', profileId);
    if (error) throw error;
    const suggestions = (data || []).map((suggestion) => ({
      ...suggestion,
      sos: suggestion.ootie_sos_posts
    }));
    return calculateHelpedFriends(profileId, suggestions);
  } catch (error) {
    throw normalizeServiceError(error);
  }
}

export async function loadHelpHistory(profileId, days, client = supabase, now = new Date()) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  if (![7, 30].includes(days)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '不支援的幫助紀錄期間。' });
  }
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - days);
  try {
    const { data, error } = await client
      .from('ootie_outfit_suggestions')
      .select('id, sos_id, item_ids, message, created_at, ootie_sos_posts!inner(id, user_id, title, details, created_at)')
      .eq('user_id', profileId)
      .gte('created_at', since.toISOString());
    if (error) throw error;
    return (data || []).filter((suggestion) => suggestion?.ootie_sos_posts?.user_id !== profileId);
  } catch (error) {
    throw normalizeServiceError(error);
  }
}

/**
 * Creates one future generic saved-outfit record. It deliberately accepts no
 * caller-supplied owner: the verified profile identity is the only owner.
 */
export async function createSavedOutfit(profileId, target, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  const targetType = target?.target_type;
  const targetId = target?.target_id;
  if (!SAVED_TARGET_TYPES.has(targetType)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '收藏內容類型不正確。' });
  }
  requireUuid(targetId, '無效的收藏內容 ID。');

  try {
    const { data, error } = await client
      .from('ootie_saved_outfits')
      .insert({ profile_id: profileId, target_type: targetType, target_id: targetId })
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    return data;
  } catch (error) {
    throw normalizeSavedOutfitError(error);
  }
}

export async function deleteSavedOutfit(profileId, target, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  const targetType = target?.target_type;
  const targetId = target?.target_id;
  if (!SAVED_TARGET_TYPES.has(targetType)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '收藏內容類型不正確。' });
  }
  requireUuid(targetId, '無效的收藏內容 ID。');

  try {
    const { data, error } = await client
      .from('ootie_saved_outfits')
      .delete()
      .eq('profile_id', profileId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND);
    return data;
  } catch (error) {
    throw normalizeSavedOutfitError(error);
  }
}

export async function listSavedOutfits(profileId, { limit = 20 } = {}, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  try {
    const { data, error } = await client
      .from('ootie_saved_outfits')
      .select('id, profile_id, target_type, target_id, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    throw normalizeSavedOutfitError(error);
  }
}

/** Reads the full private saved-outfit total without relying on paginated rows. */
export async function countSavedOutfits(profileId, client = supabase) {
  requireUuid(profileId, '無效的個人檔案 ID。');
  try {
    const { count, error } = await client
      .from('ootie_saved_outfits')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId);
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    throw normalizeSavedOutfitError(error);
  }
}
