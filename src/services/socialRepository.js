import { supabase } from './supabase';
import { SERVICE_ERROR_CODE, ServiceError, normalizeServiceError } from './serviceError';

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const requireUuid = (value, label = 'ID') => {
  if (!isUuid(value)) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: `${label} 格式不正確。` });
};

export async function loadFollowingProfiles(profileId, client = supabase) {
  requireUuid(profileId, '個人檔案 ID');
  const { data, error } = await client
    .from('ootie_profile_follows')
    .select('following_id,created_at,following:ootie_profiles!ootie_profile_follows_following_id_fkey(id,username,display_name,initials,avatar_url)')
    .eq('follower_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw normalizeServiceError(error);
  return data || [];
}

export async function followProfile(followerId, followingId, client = supabase) {
  requireUuid(followerId, '追蹤者 ID');
  requireUuid(followingId, '目標會員 ID');
  if (followerId === followingId) throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '不能追蹤自己。' });
  const { data, error } = await client
    .from('ootie_profile_follows')
    .insert({ follower_id: followerId, following_id: followingId })
    .select('id,follower_id,following_id,created_at')
    .single();
  if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  return data;
}

export async function unfollowProfile(followerId, followingId, client = supabase) {
  requireUuid(followerId, '追蹤者 ID');
  requireUuid(followingId, '目標會員 ID');
  const { error } = await client.from('ootie_profile_follows')
    .delete().eq('follower_id', followerId).eq('following_id', followingId);
  if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  return true;
}

export async function getFollowCounts(profileId, client = supabase) {
  requireUuid(profileId, '個人檔案 ID');
  const [followers, following] = await Promise.all([
    client.from('ootie_profile_follows').select('id', { count: 'exact', head: true }).eq('following_id', profileId),
    client.from('ootie_profile_follows').select('id', { count: 'exact', head: true }).eq('follower_id', profileId)
  ]);
  if (followers.error) throw normalizeServiceError(followers.error);
  if (following.error) throw normalizeServiceError(following.error);
  return { followers: followers.count || 0, following: following.count || 0 };
}

export async function loadNotifications(profileId, client = supabase) {
  requireUuid(profileId, '個人檔案 ID');
  const { data, error } = await client.from('ootie_notifications')
    .select('id,user_id,text,meta,read,event_type,actor_profile_id,entity_id,target_path,created_at,actor:ootie_profiles!ootie_notifications_actor_profile_id_fkey(id,username,display_name,avatar_url)')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw normalizeServiceError(error);
  return data || [];
}

export async function markNotificationRead(profileId, notificationId, client = supabase) {
  requireUuid(profileId, '個人檔案 ID');
  requireUuid(notificationId, '通知 ID');
  const { data, error } = await client.from('ootie_notifications')
    .update({ read: true }).eq('id', notificationId).eq('user_id', profileId)
    .select('id,read').maybeSingle();
  if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  return data;
}

export async function markAllNotificationsRead(profileId, client = supabase) {
  requireUuid(profileId, '個人檔案 ID');
  const { error } = await client.from('ootie_notifications')
    .update({ read: true }).eq('user_id', profileId).eq('read', false);
  if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  return true;
}
