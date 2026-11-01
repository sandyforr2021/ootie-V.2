import { mergePublicPostCounts } from './publicPostCounts';
import { createClient } from '@supabase/supabase-js';
import { assertOotieProject } from '@/contracts/projectBoundary';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing VITE_SUPABASE_URL in .env');
if (!SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');
assertOotieProject(SUPABASE_URL, import.meta.env.VITE_OOTIE_SUPABASE_PROJECT_REF || undefined);

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Fetch avatar_url from profiles table for current user
 */
export async function fetchProfileAvatar(userId) {
  if (!isUuid(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase fetch avatar error:', error);
      return null;
    }
    return data?.avatar_url || null;
  } catch (err) {
    console.error('Supabase fetch avatar failed:', err);
    return null;
  }
}

/**
 * Sync avatar_url to profiles table
 */
export async function syncProfileAvatar(avatarUrl, userId) {
  if (!avatarUrl || !isUuid(userId)) return false;
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, avatar_url: avatarUrl });

    if (error) {
      console.error('Supabase profile avatar sync error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase profile avatar sync failed:', err);
    return false;
  }
}

/**
 * Fetch full profile from Supabase profiles table
 */
export async function fetchProfileFromSupabase(userId) {
  if (!isUuid(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase fetch profile error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Supabase fetch profile failed:', err);
    return null;
  }
}

/**
 * Upsert profile data to Supabase profiles table
 */
export async function upsertProfileToSupabase(profileData, userId) {
  if (!isUuid(userId)) return null;
  try {
    const payload = {
      user_id: userId,
      email: profileData.email || null,
      full_name: profileData.name || profileData.full_name || null,
      username: profileData.username || null,
      initials: profileData.initials || null,
      bio: profileData.bio || null,
      avatar_url: profileData.avatar_url || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.error('Supabase profile upsert error:', error);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.error('Supabase profile upsert failed:', err);
    return null;
  }
}

/**
 * Fetch items from Supabase items table
 */
export async function fetchItemsFromSupabase(userId) {
  if (!isUuid(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase items fetch error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Supabase items fetch failed:', err);
    return null;
  }
}

/**
 * Insert item into Supabase items table
 */
export async function insertItemToSupabase(itemData, userId) {
  if (!isUuid(userId)) return null;
  try {
    const itemUuid = isUuid(itemData.id) ? itemData.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const payload = {
      user_id: userId,
      name: itemData.name,
      name_zh: itemData.name_zh || itemData.name,
      brand: itemData.brand || '',
      category: itemData.category || 'Tops',
      shape: itemData.shape || '',
      primary_color: itemData.primaryColor || itemData.primary_color || '',
      secondary_color: itemData.secondaryColor || itemData.secondary_color || '',
      color_hex: itemData.colorHex || itemData.color_hex || '#000000',
      style: itemData.style || '',
      season: itemData.season || 'All',
      photo: itemData.photo || '',
      wear_count: itemData.wearCount || itemData.wear_count || 0,
      favorite: itemData.favorite || false,
      hidden: itemData.hidden || false,
      notes: itemData.notes || '',
      created_at: itemData.createdAt || new Date().toISOString()
    };
    if (itemUuid) payload.id = itemUuid;

    const { data, error } = await supabase
      .from('items')
      .insert(payload)
      .select();

    if (error) {
      console.error('Supabase item insert error:', error);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.error('Supabase item insert failed:', err);
    return null;
  }
}

/**
 * Delete item from Supabase items table
 */
export async function deleteItemFromSupabase(itemId, userId) {
  if (!isUuid(itemId) || !isUuid(userId)) return false;
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase item delete error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase item delete failed:', err);
    return false;
  }
}

/**
 * Fetch OOTD posts from Supabase ootie_ootd_posts table
 */
export async function fetchProfileOotdPosts(userId, options = {}) {
  try {
    let query = supabase
      .from('ootie_ootd_posts')
      .select('*,ootie_profiles!ootie_ootd_posts_user_id_fkey(username,display_name,initials,avatar_url),ootie_post_likes(count),ootie_post_comments(count)')
      .order('created_at', { ascending: false });
    if (isUuid(userId)) query = query.eq('user_id', userId);
    if(Array.isArray(options.authorIds)){
      const ids=options.authorIds.filter(isUuid);if(!ids.length)return [];
      query=query.in('user_id',ids);
    }
    const term=String(options.search||'').trim().slice(0,80);
    if(term){
      const pattern='%'+term.replace(/[\\%_]/g,'\\$&')+'%';
      const searches=[['ootie_profiles','username'],['ootie_profiles','display_name'],['ootie_clothing_items','name'],['ootie_clothing_items','name_zh']];
      const matches=await Promise.all(searches.map(([table,column])=>supabase.from(table).select('id').ilike(column,pattern).limit(100)));
      if(matches.some(result=>result.error))throw new Error('FEED_SEARCH_UNAVAILABLE');
      const authors=[...new Set(matches.slice(0,2).flatMap(result=>result.data||[]).map(row=>row.id).filter(isUuid))];
      const items=[...new Set(matches.slice(2).flatMap(result=>result.data||[]).map(row=>row.id).filter(isUuid))];
      const filters=[`caption.ilike.${JSON.stringify(pattern)}`];
      if(authors.length)filters.push(`user_id.in.(${authors.join(',')})`);
      if(items.length)filters.push(`item_ids.ov.{${items.join(',')}}`);
      query=query.or(filters.join(','));
    }

    if (options.limit) {
      const offset=Math.max(0,Number(options.offset)||0),limit=Math.min(48,Math.max(1,Number(options.limit)||24));
      query=query.order('id',{ascending:false}).range(offset,offset+limit-1);
    }
    const { data, error } = await query;

    if (error) {
      console.error('Supabase OOTD fetch error:', error);
      return null;
    }
    return await mergePublicPostCounts(data, supabase);
  } catch (err) {
    console.error('Supabase OOTD fetch failed:', err);
    return null;
  }
}

/**
 * Insert new OOTD post to Supabase
 */
export async function insertOotdPost(postData, userId) {
  if (!isUuid(userId)) return null;
  try {
    const payload = {
      user_id: userId,
      image: postData.image,
      caption: postData.caption,
      caption_language: postData.caption_language || null,
      item_ids: postData.itemIds || postData.item_ids || [],
      wearing: postData.wearing || [],
      hashtags: postData.hashtags || [],
      likes: postData.likes || 0,
      comments: postData.comments || 0,
      created_at: postData.createdAt || new Date().toISOString()
    };
    if (postData.image_storage_path) payload.image_storage_path = postData.image_storage_path;

    const { data, error } = await supabase
      .from('ootie_ootd_posts')
      .insert(payload)
      .select();

    if (error) {
      console.error('Supabase OOTD insert error:', error);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.error('Supabase OOTD insert failed:', err);
    return null;
  }
}

/**
 * Update OOTD post on Supabase
 */
export async function updateOotdPost(postId, postData, userId) {
  if (!isUuid(postId) || !isUuid(userId)) return null;
  try {
    const payload = {
      image: postData.image,
      caption: postData.caption,
      caption_language: postData.caption_language || null,
      item_ids: postData.itemIds || postData.item_ids || [],
      wearing: postData.wearing || [],
      hashtags: postData.hashtags || []
    };
    if (postData.image_storage_path !== undefined) payload.image_storage_path = postData.image_storage_path;

    const { data, error } = await supabase
      .from('ootie_ootd_posts')
      .update(payload)
      .eq('id', postId)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Supabase OOTD update error:', error);
      return null;
    }
    return data?.[0] || true;
  } catch (err) {
    console.error('Supabase OOTD update failed:', err);
    return null;
  }
}

/**
 * Delete OOTD post from Supabase
 */
export async function deleteOotdPost(postId, userId) {
  if (!isUuid(postId) || !isUuid(userId)) return false;
  try {
    const { data, error } = await supabase
      .from('ootie_ootd_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Supabase OOTD delete error:', error);
      return false;
    }
    return Boolean(data?.id);
  } catch (err) {
    console.error('Supabase OOTD delete failed:', err);
    return false;
  }
}

/**
 * Fetch SOS posts from Supabase ootie_sos_posts
 */
export async function fetchSosPostsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('ootie_sos_posts')
      .select('*,ootie_profiles!ootie_sos_posts_user_id_fkey(username,display_name,initials,avatar_url,public_closet)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase SOS fetch error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Supabase SOS fetch failed:', err);
    return null;
  }
}

export async function hasOpenSosPost(profileId, client = supabase) {
  if (!isUuid(profileId)) throw new Error('Invalid SOS author profile ID');

  const { data, error } = await client
    .from('ootie_sos_posts')
    .select('id')
    .eq('user_id', profileId)
    .eq('status', 'OPEN')
    .limit(1);

  if (error) throw error;
  return Boolean(data?.length);
}

/**
 * Insert new SOS post to Supabase ootie_sos_posts
 */
export async function insertSosPostToSupabase(sosData) {
  if (!isUuid(sosData?.sender_id) || !isUuid(sosData?.closet_owner_id || sosData?.sender_id)) return null;
  try {
    const postUuid = isUuid(sosData.id) ? sosData.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const payload = {
      user_id: sosData.sender_id,
      closet_owner_id: sosData.closet_owner_id || sosData.sender_id,
      title: sosData.title,
      details: sosData.details,
      occasion: sosData.occasion,
      weather: sosData.weather,
      when_label: sosData.when_label,
      vibes: sosData.vibes || [],
      closet_item_ids: sosData.closet_item_ids || [],
      cover_url: sosData.cover_url || null,
      cover_path: sosData.cover_path || null,
      cover_item_id: sosData.cover_item_id || null,
      status: sosData.status || 'OPEN',
      created_at: sosData.created_at || new Date().toISOString()
    };
    if (postUuid) payload.id = postUuid;

    const { data, error } = await supabase
      .from('ootie_sos_posts')
      .insert(payload)
      .select();

    if (error) {
      console.error('Supabase SOS insert error:', error);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.error('Supabase SOS insert failed:', err);
    return null;
  }
}

export async function deleteSosPostFromSupabase(sosId, profileId) {
  if (!isUuid(sosId) || !isUuid(profileId)) return false;
  const { data, error } = await supabase.from('ootie_sos_posts').delete()
    .eq('id',sosId).eq('user_id',profileId).select('id');
  if (error) throw error;
  return Boolean(data?.length);
}

/**
 * Update SOS post status (OPEN / CLOSED)
 */
export async function updateSosStatusInSupabase(sosId, status) {
  if (!isUuid(sosId)) return false;
  try {
    const { data, error } = await supabase
      .from('ootie_sos_posts')
      .update({ status })
      .eq('id', sosId)
      .select();

    if (error) {
      console.error('Supabase SOS status update error:', error);
      return false;
    }
    return data?.length === 1;
  } catch (err) {
    console.error('Supabase SOS status update failed:', err);
    return false;
  }
}

/**
 * Update adopted (picked) suggestion ID on SOS post
 */
export async function updateAdoptedSuggestionInSupabase(sosId, suggestionId) {
  if (!isUuid(sosId)) return false;
  try {
    const { data, error } = await supabase
      .from('ootie_sos_posts')
      .update({ picked_suggestion_id: suggestionId })
      .eq('id', sosId)
      .select();

    if (error) {
      console.error('Supabase SOS adopt update error:', error);
      return false;
    }
    return data?.length === 1;
  } catch (err) {
    console.error('Supabase SOS adopt update failed:', err);
    return false;
  }
}

/**
 * Fetch outfit suggestions from Supabase ootie_outfit_suggestions
 */
export async function fetchOutfitSuggestionsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('ootie_outfit_suggestions')
      .select('*,ootie_profiles!ootie_outfit_suggestions_user_id_fkey(username,display_name,initials,avatar_url)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase outfit suggestions fetch error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Supabase outfit suggestions fetch failed:', err);
    return null;
  }
}

/**
 * Insert new outfit suggestion to Supabase ootie_outfit_suggestions
 */
export async function insertOutfitSuggestionToSupabase(suggestionData, { update = false } = {}) {
  if (!isUuid(suggestionData?.responder_id || suggestionData?.user_id)) return null;
  try {
    const sugUuid = isUuid(suggestionData.id) ? suggestionData.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const payload = {
      sos_id: suggestionData.sos_id,
      user_id: suggestionData.responder_id || suggestionData.user_id,
      item_ids: suggestionData.item_ids || [],
      message: suggestionData.message,
      hearts: suggestionData.hearts || 0,
      created_at: suggestionData.created_at || new Date().toISOString()
    };
    if (sugUuid) payload.id = sugUuid;

    const table = supabase.from('ootie_outfit_suggestions');
    const query = update
      ? table.update({ item_ids: payload.item_ids, message: payload.message }).eq('id', sugUuid).eq('user_id', payload.user_id).eq('sos_id', payload.sos_id)
      : table.insert(payload);
    const { data, error } = await query.select();

    if (error) {
      console.error('Supabase suggestion insert error:', error);
      return null;
    }
    return data?.[0] || null;
  } catch (err) {
    console.error('Supabase suggestion insert failed:', err);
    return null;
  }
}

/**
 * Fetch closet stats from Supabase RPC get_closet_stats
 */
export async function fetchClosetStatsFromSupabase() {
  try {
    const { data, error } = await supabase.rpc('get_closet_stats');
    if (error) {
      console.warn('Supabase get_closet_stats error:', error);
      return null;
    }
    const stats = typeof data === 'string' ? JSON.parse(data) : data;
    return stats;
  } catch (err) {
    console.warn('Supabase get_closet_stats failed:', err);
    return null;
  }
}

/**
 * Fetch brand stats from Supabase RPC get_brand_stats
 */
export async function fetchBrandStatsFromSupabase() {
  try {
    const { data, error } = await supabase.rpc('get_brand_stats');
    if (error) {
      console.warn('Supabase get_brand_stats error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase get_brand_stats failed:', err);
    return null;
  }
}

/**
 * Fetch top worn items from Supabase RPC get_top_worn_items
 */
export async function fetchTopWornItemsFromSupabase() {
  try {
    const { data, error } = await supabase.rpc('get_top_worn_items');
    if (error) {
      console.warn('Supabase get_top_worn_items error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase get_top_worn_items failed:', err);
    return null;
  }
}

/**
 * Fetch cost per wear ranking from Supabase RPC get_cost_per_wear_ranking
 */
export async function fetchCostPerWearRankingFromSupabase() {
  try {
    const { data, error } = await supabase.rpc('get_cost_per_wear_ranking');
    if (error) {
      console.warn('Supabase get_cost_per_wear_ranking error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase get_cost_per_wear_ranking failed:', err);
    return null;
  }
}

/**
 * Fetch disused items from Supabase RPC get_disused_items
 */
export async function fetchDisusedItemsFromSupabase() {
  try {
    const { data, error } = await supabase.rpc('get_disused_items');
    if (error) {
      console.warn('Supabase get_disused_items error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase get_disused_items failed:', err);
    return null;
  }
}

/**
 * Mark clearance note on Supabase
 */
export async function markItemClearanceInSupabase(itemId, notes) {
  if (!isUuid(itemId)) return false;
  try {
    const { error } = await supabase
      .from('ootie_clothing_items')
      .update({ notes })
      .eq('id', itemId);

    if (error) {
      console.warn('Supabase clearance note update failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase clearance note update exception:', err);
    return false;
  }
}

/**
 * Fetch bookmarks from Supabase ootie_bookmarks table
 */
export async function fetchBookmarksFromSupabase(userId) {
  if (!isUuid(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('ootie_bookmarks')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase bookmarks fetch error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase bookmarks fetch failed:', err);
    return null;
  }
}

/**
 * Insert new bookmark to Supabase ootie_bookmarks
 */
export async function insertBookmarkToSupabase(bookmarkData, userId) {
  if (!isUuid(userId)) return null;
  try {
    const rawOwnerId = bookmarkData.owner_id || userId;
    const ownerId = isUuid(rawOwnerId) ? rawOwnerId : undefined;
    if (!ownerId) {
      // Non-UUID owner ID is local-only
      return bookmarkData;
    }
    const itemUuid = isUuid(bookmarkData.id) ? bookmarkData.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const payload = {
      owner_id: ownerId,
      product_url: bookmarkData.product_url || '',
      title: bookmarkData.title,
      image_url: bookmarkData.image_url || '',
      image_storage_path: bookmarkData.image_storage_path || '',
      brand: bookmarkData.brand || '',
      price: bookmarkData.price || '',
      currency: bookmarkData.currency || 'TWD',
      variant_name: bookmarkData.variant_name || '',
      color: bookmarkData.color || '',
      size: bookmarkData.size || '',
      source_domain: bookmarkData.source_domain || '',
      notes: bookmarkData.notes || '',
      created_at: bookmarkData.created_at || new Date().toISOString(),
      updated_at: bookmarkData.updated_at || new Date().toISOString()
    };
    if (itemUuid) payload.id = itemUuid;

    const { data, error } = await supabase
      .from('ootie_bookmarks')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Supabase bookmark insert error:', error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.warn('Supabase bookmark insert failed:', err);
    return null;
  }
}

/**
 * Update bookmark in Supabase ootie_bookmarks
 */
export async function updateBookmarkInSupabase(bookmarkId, bookmarkData) {
  if (!isUuid(bookmarkId)) return false;
  try {
    const payload = {
      product_url: bookmarkData.product_url || '',
      title: bookmarkData.title,
      image_url: bookmarkData.image_url || '',
      image_storage_path: bookmarkData.image_storage_path || '',
      brand: bookmarkData.brand || '',
      price: bookmarkData.price || '',
      currency: bookmarkData.currency || 'TWD',
      variant_name: bookmarkData.variant_name || '',
      color: bookmarkData.color || '',
      size: bookmarkData.size || '',
      source_domain: bookmarkData.source_domain || '',
      notes: bookmarkData.notes || '',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('ootie_bookmarks')
      .update(payload)
      .eq('id', bookmarkId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Supabase bookmark update error:', error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.warn('Supabase bookmark update failed:', err);
    return null;
  }
}

/**
 * Delete bookmark from Supabase
 */
export async function deleteBookmarkFromSupabase(bookmarkId) {
  if (!isUuid(bookmarkId)) return false;
  try {
    const { data, error } = await supabase
      .from('ootie_bookmarks')
      .delete()
      .eq('id', bookmarkId).select('id');

    if (error) {
      console.warn('Supabase bookmark delete error:', error);
      return false;
    }
    return data?.length === 1;
  } catch (err) {
    console.warn('Supabase bookmark delete failed:', err);
    return false;
  }
}

/**
 * Batch delete bookmarks from Supabase
 */
export async function deleteBatchBookmarksFromSupabase(bookmarkIds) {
  if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) return true;
  const validUuids = bookmarkIds.filter(isUuid);
  if (!validUuids.length) return false;
  try {
    const { data, error } = await supabase
      .from('ootie_bookmarks')
      .delete()
      .in('id', validUuids).select('id');

    if (error) {
      console.warn('Supabase batch delete bookmarks error:', error);
      return false;
    }
    return data?.length === validUuids.length;
  } catch (err) {
    console.warn('Supabase batch delete bookmarks failed:', err);
    return false;
  }
}

/**
 * Upload bookmark image to Supabase Storage bucket 'ootie-bookmarks-images'
 */
export async function uploadBookmarkImageToStorage(file, userId) {
  if (!file || !isUuid(userId)) return null;
  try {
    const fileExt = (file.name ? file.name.split('.').pop() : 'jpg').toLowerCase();
    const storagePath = `bookmarks/${userId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('ootie-bookmarks-images')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.warn('Supabase bookmark storage upload error:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('ootie-bookmarks-images')
      .getPublicUrl(storagePath);

    return {
      publicUrl: publicUrlData?.publicUrl || '',
      storagePath
    };
  } catch (err) {
    console.warn('Supabase bookmark image upload exception:', err);
    return null;
  }
}


export async function updateLikedSuggestionsInSupabase(sosId, ids) {
  if (!isUuid(sosId) || !Array.isArray(ids) || !ids.every(isUuid)) return false;
  try {
    const {data,error} = await supabase.from('ootie_sos_posts')
      .update({liked_suggestion_ids:[...new Set(ids)]}).eq('id',sosId).select('id');
    return !error && data?.length === 1;
  } catch { return false; }
}

export async function fetchSavedSosIds(profileId) {
  if (!isUuid(profileId)) return new Set();
  const {data,error} = await supabase.from('ootie_saved_outfits')
    .select('target_id').eq('profile_id',profileId).eq('target_type','SOS');
  if(error) throw error;
  return new Set((data || []).map(row=>row.target_id));
}

export async function fetchOotdPostsByIds(ids){
 const unique=[...new Set(ids.filter(isUuid))];const rows=[];
 for(let index=0;index<unique.length;index+=50){
  const {data,error}=await supabase.from('ootie_ootd_posts').select('id,item_ids,wearing').in('id',unique.slice(index,index+50));
  if(error)throw error;rows.push(...(data||[]));
 }
 return rows;
}
