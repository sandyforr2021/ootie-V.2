import { supabase } from './supabase';
import { inferContentLanguage } from '../../shared/contentLanguages.js';

export async function listPostComments(postId, client = supabase) {
  const { data, error } = await client.from('ootie_post_comments')
    .select('id,post_id,profile_id,body,body_language,created_at,ootie_profiles!ootie_post_comments_profile_id_fkey(username,display_name,initials,avatar_url)')
    .eq('post_id', postId).order('created_at', {ascending:true});
  if (error) throw error;
  return (data || []).map(row => ({id:row.id, profile_id:row.profile_id, text:row.body, body_language:row.body_language,
    user:row.ootie_profiles?.username || 'OOTIE', display_name:row.ootie_profiles?.display_name || '',
    avatar_url:row.ootie_profiles?.avatar_url || '', created_at:row.created_at}));
}
export async function insertPostComment({id, postId, profileId, text}, client = supabase) {
  const body = String(text || '').trim();
  if (!body || body.length>2000) throw new Error('INVALID_COMMENT');
  const {data, error} = await client.from('ootie_post_comments')
    .insert({id,post_id:postId,profile_id:profileId,body,body_language:inferContentLanguage(body)}).select('id').single();
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

export async function deletePostComment({id, postId, profileId}, client = supabase) {
  const { data, error } = await client.from('ootie_post_comments').delete()
    .eq('id', id).eq('profile_id', profileId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('COMMENT_DELETE_NOT_CONFIRMED');
  return true;
}
