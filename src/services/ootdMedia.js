import { supabase } from './supabase';
import {
  SERVICE_ERROR_CODE,
  ServiceError,
  normalizeServiceError
} from './serviceError';

export const OOTD_IMAGE_BUCKET = 'ootie-ootd-images';
export const OOTD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const OOTD_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
});

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function validateOotdImage(file) {
  if (!(file instanceof File) || !OOTD_IMAGE_MIME_TYPES.includes(file.type)) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      userMessage: 'OOTD 照片只接受 JPEG、PNG 或 WebP。'
    });
  }
  if (file.size > OOTD_IMAGE_MAX_BYTES) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
      userMessage: 'OOTD 照片不可超過 10 MB。'
    });
  }
  return file;
}

const requireAuthUserId = (authUserId) => {
  if (!isUuid(authUserId)) {
    throw new ServiceError(SERVICE_ERROR_CODE.AUTH_REQUIRED);
  }
};

export async function uploadOotdImage(file, authUserId, client = supabase) {
  validateOotdImage(file);
  requireAuthUserId(authUserId);

  const extension = EXTENSIONS[file.type];
  const objectId = globalThis.crypto?.randomUUID?.();
  if (!objectId) {
    throw new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED, {
      userMessage: '無法建立安全的圖片識別碼，請重新整理後再試。'
    });
  }
  const path = `ootd/${authUserId}/${objectId}.${extension}`;

  try {
    const { error } = await client.storage
      .from(OOTD_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data } = client.storage.from(OOTD_IMAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED, {
        userMessage: '圖片已上傳，但無法取得公開網址。'
      });
    }
    return { path, publicUrl: data.publicUrl };
  } catch (error) {
    const normalized = normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    if (String(error?.message || '').toLowerCase().includes('bucket')) {
      normalized.userMessage = 'OOTD 圖片儲存空間尚未啟用，暫時無法發布。';
    }
    throw normalized;
  }
}

export async function removeOotdImage(path, authUserId, client = supabase) {
  requireAuthUserId(authUserId);
  const ownedPrefix = `ootd/${authUserId}/`;
  if (typeof path !== 'string' || !path.startsWith(ownedPrefix)) {
    throw new ServiceError(SERVICE_ERROR_CODE.PERMISSION_DENIED, {
      userMessage: '無法安全移除這張 OOTD 圖片。'
    });
  }

  try {
    const { error } = await client.storage.from(OOTD_IMAGE_BUCKET).remove([path]);
    if (error) throw error;
    return true;
  } catch (error) {
    throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  }
}
