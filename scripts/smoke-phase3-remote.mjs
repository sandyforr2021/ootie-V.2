import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const url = required('SUPABASE_URL');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const email = required('OOTIE_DEMO_EMAIL');
const password = required('OOTIE_DEMO_PASSWORD');
const expectedUserId = required('OOTIE_DEMO_USER_ID');
const expectedProfileId = required('OOTIE_DEMO_PROFILE_ID');

const member = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const cleanupNotificationIds = [];
let targetProfileId = null;

const ensure = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const { data: authData, error: authError } = await member.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  ensure(authData.user?.id === expectedUserId, 'Demo auth user mismatch');

  const { data: ownProfile, error: ownError } = await member.from('ootie_profiles').select('id,username').eq('user_id', expectedUserId).single();
  if (ownError) throw ownError;
  ensure(ownProfile.id === expectedProfileId, 'Demo profile mismatch');

  const { data: targets, error: targetError } = await member.from('ootie_profiles').select('id,username').neq('id', expectedProfileId).limit(1);
  if (targetError) throw targetError;
  targetProfileId = targets?.[0]?.id;
  ensure(targetProfileId, 'No remote profile available for follow smoke');

  await admin.from('ootie_profile_follows').delete().eq('follower_id', expectedProfileId).eq('following_id', targetProfileId);
  const { data: follow, error: followError } = await member.from('ootie_profile_follows')
    .insert({ follower_id: expectedProfileId, following_id: targetProfileId })
    .select('id,follower_id,following_id').single();
  if (followError) throw followError;
  ensure(follow.following_id === targetProfileId, 'Follow insert mismatch');

  const { error: duplicateError } = await member.from('ootie_profile_follows')
    .insert({ follower_id: expectedProfileId, following_id: targetProfileId });
  ensure(Boolean(duplicateError), 'Duplicate follow was not rejected');

  const { error: selfError } = await member.from('ootie_profile_follows')
    .insert({ follower_id: expectedProfileId, following_id: expectedProfileId });
  ensure(Boolean(selfError), 'Self follow was not rejected');

  const { data: followed, error: followedError } = await member.from('ootie_profile_follows')
    .select('id').eq('follower_id', expectedProfileId).eq('following_id', targetProfileId);
  if (followedError) throw followedError;
  ensure(followed.length === 1, 'Remote follow did not persist');

  const { data: triggerNotice, error: triggerError } = await admin.from('ootie_notifications')
    .select('id,event_type,actor_profile_id').eq('user_id', targetProfileId).eq('event_type', 'FOLLOW')
    .eq('actor_profile_id', expectedProfileId).eq('entity_id', follow.id).maybeSingle();
  if (triggerError) throw triggerError;
  ensure(triggerNotice?.event_type === 'FOLLOW', 'Follow notification trigger missing');
  cleanupNotificationIds.push(triggerNotice.id);

  const notificationId = randomUUID();
  const { error: seedNoticeError } = await admin.from('ootie_notifications').insert({
    id: notificationId,
    user_id: expectedProfileId,
    text: 'Phase 3 notification smoke',
    read: false,
    event_type: 'PHASE3_SMOKE',
    actor_profile_id: targetProfileId,
    entity_id: randomUUID(),
    target_path: '/profile'
  });
  if (seedNoticeError) throw seedNoticeError;
  cleanupNotificationIds.push(notificationId);
  const { data: marked, error: markError } = await member.from('ootie_notifications')
    .update({ read: true }).eq('id', notificationId).eq('user_id', expectedProfileId).select('read').single();
  if (markError) throw markError;
  ensure(marked.read === true, 'Notification mark-read failed');

  const { data: anonPrivate, error: anonPrivateError } = await anon.from('ootie_profile_private')
    .select('profile_id,weather_city').eq('profile_id', expectedProfileId);
  ensure(Boolean(anonPrivateError) || anonPrivate?.length === 0, 'Anonymous private profile visibility was not denied');

  const { data: priorPrivate, error: priorPrivateError } = await member.from('ootie_profile_private')
    .select('weather_city').eq('profile_id', expectedProfileId).maybeSingle();
  if (priorPrivateError) throw priorPrivateError;
  const { error: cityError } = await member.from('ootie_profile_private')
    .upsert({ profile_id: expectedProfileId, weather_city: '台北' }, { onConflict: 'profile_id' });
  if (cityError) throw cityError;
  const { data: savedCity, error: savedCityError } = await member.from('ootie_profile_private')
    .select('weather_city').eq('profile_id', expectedProfileId).single();
  if (savedCityError) throw savedCityError;
  ensure(savedCity.weather_city === '台北', 'Weather city preference did not persist');
  await member.from('ootie_profile_private').update({ weather_city: priorPrivate?.weather_city || null }).eq('profile_id', expectedProfileId);

  const { error: anonWriteError } = await anon.from('ootie_profile_follows')
    .insert({ follower_id: expectedProfileId, following_id: targetProfileId });
  ensure(Boolean(anonWriteError), 'Anonymous follow write was not denied');

  console.log(JSON.stringify({
    auth: 'PASS', profileBootstrapIdentity: 'PASS', followPersistence: 'PASS', duplicateGuard: 'PASS', selfFollowGuard: 'PASS',
    followNotification: 'PASS', notificationRead: 'PASS', privateProfileIsolation: 'PASS', weatherPreference: 'PASS', anonWriteDenied: 'PASS'
  }));
} finally {
  if (targetProfileId) await admin.from('ootie_profile_follows').delete().eq('follower_id', expectedProfileId).eq('following_id', targetProfileId);
  if (cleanupNotificationIds.length) await admin.from('ootie_notifications').delete().in('id', cleanupNotificationIds);
  await member.auth.signOut();
}
