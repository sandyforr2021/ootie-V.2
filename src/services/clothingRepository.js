import { genuineContent } from './contentAuthenticity';
import { supabase } from './supabase';
import {
  SERVICE_ERROR_CODE,
  ServiceError,
  normalizeServiceError
} from './serviceError';
import { hydratePrivateClothingPhotos, hydrateSharedClothingPhotos } from './clothingMediaRepository';

const isUuid = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Repository layer for public.ootie_clothing_items.
 * Strictly adheres to CLOTHING_OWNERSHIP_CONTRACT:
 * - owner_id must be a valid ootie_profiles.id (domain profile UUID).
 * - Queries strictly against public.ootie_clothing_items.
 * - Never uses fixed mock identities (user-01, profile-01).
 * - Never queries deprecated tables (public.items, public.profiles).
 */

const CLOTHING_MUTABLE_COLUMNS = Object.freeze([
  'brand',
  'favorite',
  'category',
  'color_hex',
  'last_worn',
  'name',
  'name_zh',
  'notes',
  'photo',
  'photo_original_path',
  'photo_display_path',
  'photo_mime_type',
  'photo_width',
  'photo_height',
  'photo_file_size',
  'photo_processing_status',
  'photo_updated_at',
  'price',
  'primary_color',
  'purchase_date',
  'season',
  'secondary_color',
  'shape',
  'source_url',
  'source_domain',
  'style',
  'wear_count'
]);

const cleanClothingPayload = (payload, { requireName = false } = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR);
  }

  const clean = {};
  for (const column of CLOTHING_MUTABLE_COLUMNS) {
    if (payload[column] !== undefined) clean[column] = payload[column];
  }

  if (requireName && (typeof clean.name !== 'string' || !clean.name.trim())) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      userMessage: '請輸入單品名稱。'
    });
  }
  if (clean.favorite !== undefined && typeof clean.favorite !== 'boolean') throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR);
  if (typeof clean.name === 'string') clean.name = clean.name.trim();
  if (clean.price === '') {
    clean.price = null;
  } else if (clean.price !== undefined && clean.price !== null) {
    const price = Number(clean.price);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
      throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
        userMessage: '價格必須是零或正整數。'
      });
    }
    clean.price = price;
  }
  if (Object.keys(clean).length === 0) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      userMessage: '沒有可更新的單品欄位。'
    });
  }

  return clean;
};

const requireUuid = (value, userMessage) => {
  if (!isUuid(value)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage });
  }
};

/**
 * Fetches all clothing items for a given profile owner.
 * @param {string} profileId - The ootie_profiles.id UUID.
 * @param {object} [client=supabase] - Supabase client instance.
 * @returns {Promise<Array>} List of items from ootie_clothing_items.
 */
export async function getCurrentUserItems(profileId, client = supabase) {
  if (!isUuid(profileId)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      message: '無效的個人檔案擁有者 ID。',
      userMessage: '無效的個人檔案擁有者 ID。'
    });
  }

  try {
    const { data, error } = await client
      .from('ootie_clothing_items')
      .select('*')
      .eq('owner_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      throw normalizeServiceError(error);
    }

    return await hydratePrivateClothingPhotos(genuineContent(data || []), client);
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

/**
 * Backward compatibility alias for getCurrentUserItems.
 */
export const fetchClothingItems = getCurrentUserItems;

/**
 * Resolves clothing referenced by public social content. Database RLS remains
 * the source of truth: private or non-readable rows are simply not returned.
 */
export async function getPublicItemsByIds(itemIds, client = supabase) {
  const ids = [...new Set((Array.isArray(itemIds) ? itemIds : []).filter(isUuid))].slice(0, 100);
  if (!ids.length) return [];
  try {
    const { data, error } = await client
      .from('ootie_clothing_items')
      .select('id,owner_id,name,name_zh,brand,category,primary_color,photo,photo_display_path')
      .in('id', ids);
    if (error) throw normalizeServiceError(error);
    return await hydrateSharedClothingPhotos(genuineContent(data || []), client);
  } catch (err) {
    throw normalizeServiceError(err);
  }
}

/**
 * Fetches a single clothing item by its primary key (ootie_clothing_items.id).
 * @param {string} itemId - The ootie_clothing_items.id UUID.
 * @param {object} [client=supabase] - Supabase client instance.
 * @returns {Promise<object|null>} The clothing item or null if not found.
 */
export async function getItemById(itemId, client = supabase) {
  if (!isUuid(itemId)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      message: '無效的單品 ID。',
      userMessage: '無效的單品 ID。'
    });
  }

  try {
    const { data, error } = await client
      .from('ootie_clothing_items')
      .select('*')
      .eq('id', itemId)
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
 * Inserts one item for the verified OOTIE profile. UI supplied owner_id is
 * intentionally discarded; the explicit profileId is the sole owner source.
 */
export async function createClothingItem(profileId, payload, client = supabase, itemId = null) {
  requireUuid(profileId, '無效的個人檔案擁有者 ID。');
  if (itemId !== null) requireUuid(itemId, '無效的單品 ID。');
  const cleanPayload = cleanClothingPayload(payload, { requireName: true });

  try {
    const { data, error } = await client
      .from('ootie_clothing_items')
      .insert({ ...cleanPayload, owner_id: profileId, ...(itemId ? { id: itemId } : {}) })
      .select()
      .single();

    if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    if (!data) throw new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    return data;
  } catch (err) {
    throw normalizeServiceError(err, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  }
}

/**
 * Updates one item only when both its id and current profile owner match.
 */
export async function updateClothingItem(profileId, itemId, changes, client = supabase) {
  requireUuid(profileId, '無效的個人檔案擁有者 ID。');
  requireUuid(itemId, '無效的單品 ID。');
  const cleanChanges = cleanClothingPayload(changes);

  try {
    const { data, error } = await client
      .from('ootie_clothing_items')
      .update(cleanChanges)
      .eq('id', itemId)
      .eq('owner_id', profileId)
      .select()
      .maybeSingle();

    if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    if (!data) throw new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND);
    return data;
  } catch (err) {
    throw normalizeServiceError(err, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  }
}

/**
 * Deletes one item only when both its id and current profile owner match.
 */
export async function deleteClothingItem(profileId, itemId, client = supabase) {
  requireUuid(profileId, '無效的個人檔案擁有者 ID。');
  requireUuid(itemId, '無效的單品 ID。');

  try {
    const { data, error } = await client
      .from('ootie_clothing_items')
      .delete()
      .eq('id', itemId)
      .eq('owner_id', profileId)
      .select('id')
      .maybeSingle();

    if (error?.code === '23503' || /referenced|仍被/i.test(error?.message || '')) {
      throw new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED, {
        message: error.message,
        userMessage: '這件單品仍被 OOTD 或 SOS 使用，請先移除相關引用再刪除。'
      });
    }
    if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    if (!data) throw new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND);
    return data;
  } catch (err) {
    throw normalizeServiceError(err, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  }
}
