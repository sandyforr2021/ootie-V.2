import { supabase } from './supabase';
import { SERVICE_ERROR_CODE, ServiceError, normalizeServiceError } from './serviceError';

export const AVATAR_BUCKET = 'ootie-profile-avatars';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });

export const validateAvatarFile = (file) => {
  if (!file || !AVATAR_MIME_TYPES[file.type]) throw new ServiceError(SERVICE_ERROR_CODE.AVATAR_INVALID);
  if (Number(file.size) > MAX_AVATAR_BYTES) throw new ServiceError(SERVICE_ERROR_CODE.AVATAR_TOO_LARGE);
  return true;
};

const makeUuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function uploadAvatar(file, authUserId, client = supabase) {
  validateAvatarFile(file);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId || '')) {
    throw new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, { userMessage: '無效的登入身分。' });
  }
  const path = `avatars/${authUserId}/${makeUuid()}.${AVATAR_MIME_TYPES[file.type]}`;
  try {
    const { data, error } = await client.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    const publicUrl = client.storage.from(AVATAR_BUCKET).getPublicUrl(path)?.data?.publicUrl || '';
    return { path: data?.path || path, publicUrl };
  } catch (error) {
    throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  }
}

export async function removeAvatar(path, client = supabase) {
  if (!path) return { removed: false };
  const { error } = await client.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
  return { removed: true };
}
