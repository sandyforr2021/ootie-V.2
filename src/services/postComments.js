import { supabase } from './supabase';

export async function listPostComments(postId, client = supabase) {
  const { data, error } = await client.from('ootie_post_comments')
    .select('id,post_id,profile_id,body,created_at,ootie_profiles!ootie_post_comments_profile_id_fkey(username,initials)')
    .eq('post_id', postId).order('created_at', {ascending:true});
  if (error) throw error;
  return (data || []).map(row => ({id:row.id, profile_id:row.profile_id, text:row.body,
    user:row.ootie_profiles?.username || 'OOTIE', created_at:row.created_at}));
}
export async function insertPostComment({id, postId, profileId, text}, client = supabase) {
  const body = String(text || '').trim();
  if (!body || body.length>2000) throw new Error('INVALID_COMMENT');
  const {data, error} = await client.from('ootie_post_comments')
    .insert({id,post_id:postId,profile_id:profileId,body}).select('id').single();
  // A retry after an uncertain network response must not create a second comment.
  if (error?.code === '23505') {
    const existing = await client.from('ootie_post_comments').select('id').eq('id',id).eq('profile_id',profileId).eq('post_id',postId).eq('body',body).single();
    if (existing.error) throw existing.error;
    if (!existing.data?.id) throw new Error('COMMENT_NOT_CONFIRMED');
    return existing.data;
  }
  if (error) throw error;
  if (!data?.id) throw new Error('COMMENT_NOT_CONFIRMED');
  return data;
}
