import { GatewayError, assert } from '../errors.js';
import { normalizeGarmentImageForAi, parseImageDataUrl, validateImageBytes, readBoundedImage } from '../image.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encodeStoragePath = (path) => path.split('/').map(encodeURIComponent).join('/');

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
};

export class SupabaseGateway {
  constructor({ config, fetchImpl = fetch }) {
    this.url = config.supabase.url;
    this.publishableKey = config.supabase.publishableKey;
    this.serviceRoleKey = config.supabase.serviceRoleKey;
    this.bucket = config.supabase.aiBucket;
    this.fetchImpl = fetchImpl;
  }

  serviceHeaders(extra = {}) {
    return {
      apikey: this.serviceRoleKey,
      ...(this.serviceRoleKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.serviceRoleKey}` }),
      ...extra
    };
  }

  async serviceRequest(path, options = {}) {
    let response;
    try {
      response = await this.fetchImpl(`${this.url}${path}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(20000),
        headers: this.serviceHeaders(options.headers)
      });
    } catch {
      throw new GatewayError('SUPABASE_UNAVAILABLE', 503, 'Supabase could not be reached');
    }
    const body = await parseResponseBody(response);
    if (!response.ok) {
      const commerceCodes = ['FREE_BUDGET_EXHAUSTED','BATCH_CONFLICT','PRODUCT_NOT_OWNED','INVALID_BATCH','PERSON_IMAGE_NOT_OWNED'];
      const commerceCode = commerceCodes.find((code) => body?.message === code);
      if (commerceCode) throw new GatewayError(commerceCode, commerceCode === 'FREE_BUDGET_EXHAUSTED' ? 429 : 409, {
        FREE_BUDGET_EXHAUSTED: '可用免費額度不足或已到期，本次沒有送出生成。',
        BATCH_CONFLICT: '此提交編號已使用，請重新選擇商品。',
        PRODUCT_NOT_OWNED: '請選擇自己收藏的商品。'
      }[commerceCode] || '請重新確認照片與商品。');
      throw new GatewayError('SUPABASE_ERROR', 502, 'Supabase operation failed', {
        status: response.status,
        code: body?.code
      });
    }
    return body;
  }

  async verifyAccessToken(authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(String(authorization || ''));
    assert(match, 'AUTH_REQUIRED', 401, 'A Supabase access token is required');
    let response;
    try {
      response = await this.fetchImpl(`${this.url}/auth/v1/user`, {
        headers: {
          apikey: this.publishableKey,
          Authorization: `Bearer ${match[1]}`
        }
      });
    } catch {
      throw new GatewayError('AUTH_UNAVAILABLE', 503, 'Supabase Auth could not be reached');
    }
    if (!response.ok) throw new GatewayError('AUTH_REQUIRED', 401, 'Supabase session is invalid or expired');
    const user = await response.json();
    assert(UUID_PATTERN.test(user?.id || ''), 'AUTH_REQUIRED', 401, 'Supabase user identity is invalid');
    assert(!user?.is_anonymous, 'MEMBER_REQUIRED', 403, 'A permanent OOTIE member account is required');
    return { id: user.id, accessToken: match[1], user };
  }

  async findProfileForUser(userId) {
    const query = `/rest/v1/ootie_profiles?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id&limit=2`;
    const rows = await this.serviceRequest(query);
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new GatewayError('PROFILE_NOT_READY', 409, 'OOTIE profile identity is missing or ambiguous');
    }
    return rows[0];
  }

  async accessibleSharedClothing(user, itemId) {
    assert(user?.accessToken, 'AUTH_REQUIRED', 401);
    assert(UUID_PATTERN.test(itemId), 'ITEM_NOT_FOUND', 404);
    // Authorize the row with the viewer JWT, never with service-role bypass.
    const response = await this.fetchImpl(`${this.url}/rest/v1/ootie_clothing_items?id=eq.${encodeURIComponent(itemId)}&select=id,owner_id,name,name_zh,category,photo_display_path&limit=1`, {
      headers: { apikey: this.publishableKey, Authorization: `Bearer ${user.accessToken}` },
      signal: AbortSignal.timeout(15000)
    });
    const rows = response.ok ? await response.json() : [];
    const item = Array.isArray(rows) ? rows[0] : null;
    assert(item?.id === itemId && UUID_PATTERN.test(item.owner_id), 'ITEM_NOT_FOUND', 404);
    // Only a display derivative can cross this bridge; original paths are ignored.
    assert(typeof item.photo_display_path === 'string' && /\/display\.(?:jpe?g|png|webp)$/i.test(item.photo_display_path), 'ITEM_NOT_FOUND', 404);
    return item;
  }

  async sharedClothingImage(user, itemId) {
    const item = await this.accessibleSharedClothing(user,itemId);
    const owners = await this.serviceRequest(`/rest/v1/ootie_profiles?id=eq.${encodeURIComponent(item.owner_id)}&select=user_id&limit=1`);
    const ownerUserId = owners?.[0]?.user_id;
    assert(UUID_PATTERN.test(ownerUserId || ''), 'ITEM_NOT_FOUND', 404);
    return this.clothingImage(item, { userId: ownerUserId });
  }

  async listOwnedItems(profileId) {
    const select = 'id,name,name_zh,category,primary_color,secondary_color,style,season,photo,owner_id,hidden';
    const rows = await this.serviceRequest(
      `/rest/v1/ootie_clothing_items?owner_id=eq.${encodeURIComponent(profileId)}&select=${select}&limit=200`
    );
    return Array.isArray(rows) ? rows.filter((item) => item.hidden !== true) : [];
  }

  async findOwnedItems(profileId, itemIds) {
    const uniqueIds = [...new Set(itemIds)];
    if (!uniqueIds.length || uniqueIds.some((id) => !UUID_PATTERN.test(id))) {
      throw new GatewayError('INVALID_ITEM_IDS', 400, 'Clothing item IDs must be UUIDs');
    }
    const filter = uniqueIds.map(encodeURIComponent).join(',');
    const select = 'id,name,name_zh,category,primary_color,secondary_color,style,season,photo,photo_display_path,owner_id';
    const rows = await this.serviceRequest(
      `/rest/v1/ootie_clothing_items?id=in.(${filter})&owner_id=eq.${encodeURIComponent(profileId)}&select=${select}`
    );
    if (!Array.isArray(rows) || rows.length !== uniqueIds.length) {
      throw new GatewayError('ITEM_NOT_OWNED', 403, 'One or more clothing items do not belong to this user');
    }
    const byId = new Map(rows.map((item) => [item.id, item]));
    return uniqueIds.map((id) => byId.get(id));
  }

  async claimGeneration({ id, userId, type, model, sourceItemIds, dailyLimit, quotaTimezone, pointsCost = 0 }) {
    const body = await this.serviceRequest('/rest/v1/rpc/claim_ootie_ai_generation_with_points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_generation_id: id,
        p_user_id: userId,
        p_generation_type: type,
        p_provider: 'google_cloud',
        p_model: model,
        p_source_item_ids: sourceItemIds,
        p_daily_limit: dailyLimit,
        p_quota_timezone: quotaTimezone,
        p_points_cost: pointsCost
      })
    });
    return body;
  }

  async debitGenerationPoints({ id, userId, pointsCost }) {
    return this.serviceRequest('/rest/v1/rpc/debit_ootie_ai_points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_generation_id: id,
        p_user_id: userId,
        p_points_cost: pointsCost
      })
    });
  }

  async getGeneration(id, userId) {
    const rows = await this.serviceRequest(
      `/rest/v1/ootie_ai_generations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
    );
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  async updateGeneration(id, userId, changes) {
    const rows = await this.serviceRequest(
      `/rest/v1/ootie_ai_generations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(changes)
      }
    );
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new GatewayError('GENERATION_NOT_FOUND', 404, 'Generation was not found');
    }
    return rows[0];
  }

  async listGenerations(userId, limit = 24) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 50));
    const select = 'id,generation_type,status,source_item_ids,result_path,created_at,saved_at,error_code';
    const rows = await this.serviceRequest(
      `/rest/v1/ootie_ai_generations?user_id=eq.${encodeURIComponent(userId)}&status=eq.succeeded&result_path=not.is.null&select=${select}&order=created_at.desc&limit=${safeLimit}`
    );
    return Array.isArray(rows) ? rows : [];
  }

  async uploadPrivate(path, image, { upsert = false } = {}) {
    await this.serviceRequest(`/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodeStoragePath(path)}`, {
      method: 'POST',
      headers: {
        'Content-Type': image.mimeType,
        'x-upsert': upsert ? 'true' : 'false'
      },
      body: image.buffer
    });
    return path;
  }

  async downloadPrivate(path) {
    let response;
    try {
      response = await this.fetchImpl(
        `${this.url}/storage/v1/object/authenticated/${encodeURIComponent(this.bucket)}/${encodeStoragePath(path)}`,
        { headers: this.serviceHeaders(), redirect: 'error', signal: AbortSignal.timeout(20000) }
      );
    } catch {
      throw new GatewayError('PRIVATE_IMAGE_NOT_FOUND', 404, 'Private image could not be read');
    }
    if (!response.ok) throw new GatewayError('PRIVATE_IMAGE_NOT_FOUND', 404, 'Private image could not be read');
    const bytes = await readBoundedImage(response);
    return validateImageBytes(bytes, response.headers.get('content-type')?.split(';')[0] || '');
  }

  async listPersonPhotos(userId) {
    const prefix = `person/${userId}`;
    const entries = await this.serviceRequest(`/storage/v1/object/list/${encodeURIComponent(this.bucket)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix,
        limit: 50,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })
    });
    const files = Array.isArray(entries) ? entries.filter((entry) => entry?.name && entry.id) : [];
    return files.map((entry) => {
      const path = `${prefix}/${entry.name}`;
      return {
        id: entry.name.replace(/\.[^.]+$/, ''),
        path,
        createdAt: entry.created_at
      };
    });
  }

  async deletePersonPhoto(userId, photoId) {
    const photos = await this.listPersonPhotos(userId);
    const target = photos.find((photo) => photo.id === photoId);
    if (!target) throw new GatewayError('PERSON_IMAGE_NOT_FOUND', 404, 'Person image was not found');
    const expectedPrefix = `person/${userId}/`;
    if (!target.path.startsWith(expectedPrefix) || target.path.includes('..')) {
      throw new GatewayError('PERSON_IMAGE_NOT_OWNED', 403, 'Person image does not belong to the signed-in user');
    }
    await this.serviceRequest(`/storage/v1/object/${encodeURIComponent(this.bucket)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [target.path] })
    });
    return target;
  }

  storagePathFromSupabaseUrl(value) {
    let url;
    try { url = new URL(value); } catch { return null; }
    const expected = new URL(this.url);
    if (url.origin !== expected.origin) return null;
    const match = /^\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (!match) return null;
    return { bucket: decodeURIComponent(match[1]), path: match[2].split('/').map(decodeURIComponent).join('/') };
  }

  async clothingImage(item, { userId } = {}) {
    let storage;
    if (item?.photo_display_path) {
      const path = item.photo_display_path;
      assert(
        UUID_PATTERN.test(String(userId || ''))
          && UUID_PATTERN.test(String(item.id || ''))
          && typeof path === 'string'
          && path.startsWith(`closet/${userId}/${item.id}/`)
          && !path.split('/').some((part) => !part || part === '.' || part === '..' || /[%\\?#]/.test(part)),
        'CLOTHING_IMAGE_SOURCE_UNSUPPORTED', 422,
        'Private clothing media must belong to this member and item'
      );
      storage = { bucket: 'ootie-closet-media', path };
    } else {
      if (typeof item?.photo !== 'string' || !item.photo) {
        throw new GatewayError('CLOTHING_IMAGE_REQUIRED', 422, 'Selected clothing item has no product image');
      }
      if (item.photo.startsWith('data:')) return parseImageDataUrl(item.photo);
      storage = this.storagePathFromSupabaseUrl(item.photo);
    }
    if (!storage) {
      throw new GatewayError(
        'CLOTHING_IMAGE_SOURCE_UNSUPPORTED',
        422,
        'Clothing images used for AI must be inline wardrobe data or Supabase Storage assets'
      );
    }

    let response;
    try {
      response = await this.fetchImpl(
        `${this.url}/storage/v1/object/authenticated/${encodeURIComponent(storage.bucket)}/${encodeStoragePath(storage.path)}`,
        { headers: this.serviceHeaders(), redirect: 'error', signal: AbortSignal.timeout(20000) }
      );
    } catch {
      throw new GatewayError('CLOTHING_IMAGE_REQUIRED', 422, 'Clothing image could not be read');
    }
    if (!response.ok) throw new GatewayError('CLOTHING_IMAGE_REQUIRED', 422, 'Clothing image could not be read');
    try {
      return await normalizeGarmentImageForAi(
        await readBoundedImage(response),
        response.headers.get('content-type')?.split(';')[0] || ''
      );
    } catch (error) {
      if (error instanceof GatewayError) {
        throw new GatewayError('CLOTHING_IMAGE_INVALID', 422, error.message, {
          itemId: item.id,
          itemName: item.name_zh || item.name || '所選衣物'
        });
      }
      throw error;
    }
  }
}

export const isUuid = (value) => UUID_PATTERN.test(String(value || ''));
