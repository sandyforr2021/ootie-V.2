import { supabase } from './supabase';

export const CLOSET_MEDIA_BUCKET = 'ootie-closet-media';
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
export const RESUMABLE_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;
const privateObjectUrls = new Set();

const extensionForMime = (mime) => ({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}[mime] || 'bin');

const requireUserId = async (client = supabase) => {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) throw new Error('登入狀態已失效，請重新登入後再試。');
  return data.user.id;
};

const removePaths = async (paths, client) => {
  const safePaths = [...new Set(paths.filter(Boolean))];
  if (!safePaths.length) return;
  const { error } = await client.storage.from(CLOSET_MEDIA_BUCKET).remove(safePaths);
  if (error) throw error;
};

const directStorageEndpoint = () => {
  const projectUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl)) {
    throw new Error('目前無法建立大型照片的安全上傳連線，請稍後再試。');
  }
  return `${projectUrl.replace('.supabase.co', '.storage.supabase.co')}/storage/v1/upload/resumable`;
};

export async function uploadResumableOriginal(path, file, mimeType, options = {}, client = supabase) {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error('登入狀態已失效，請重新登入後再試。');
  }
  const UploadClass = options.UploadClass || (await import('tus-js-client')).Upload;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      options.registerAbort?.(null);
      callback(value);
    };
    const upload = new UploadClass(file, {
      endpoint: directStorageEndpoint(),
      retryDelays: [0, 3000, 5000],
      headers: { authorization: `Bearer ${data.session.access_token}` },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: RESUMABLE_CHUNK_SIZE_BYTES,
      metadata: {
        bucketName: CLOSET_MEDIA_BUCKET,
        objectName: path,
        contentType: mimeType,
        cacheControl: '3600'
      },
      onProgress: (uploadedBytes, totalBytes) => {
        if (totalBytes > 0) options.onProgress?.(uploadedBytes, totalBytes);
      },
      onError: (uploadError) => finish(reject, uploadError),
      onSuccess: () => finish(resolve, { path })
    });

    options.registerAbort?.(async () => {
      try { await upload.abort(true); } catch { /* incomplete TUS uploads expire server-side */ }
      const cancelled = new Error('上傳已取消。');
      cancelled.code = 'UPLOAD_CANCELLED';
      finish(reject, cancelled);
    });

    upload.findPreviousUploads()
      .then((previousUploads) => {
        if (options.shouldCancel?.()) {
          options.registerAbort?.(null);
          const cancelled = new Error('上傳已取消。');
          cancelled.code = 'UPLOAD_CANCELLED';
          finish(reject, cancelled);
          return;
        }
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch((resumeError) => finish(reject, resumeError));
  });
}

export async function uploadClothingMedia(itemId, prepared, options = {}, client = supabase) {
  const userId = await requireUserId(client);
  const operationId = options.operationId || crypto.randomUUID();
  const basePath = `closet/${userId}/${itemId}/${operationId}`;
  const originalPath = `${basePath}/original.${extensionForMime(prepared.originalMimeType)}`;
  const displayPath = `${basePath}/display.${extensionForMime(prepared.displayMimeType)}`;
  const uploaded = [];
  const ensureActive = () => {
    if (options.shouldCancel?.()) {
      const error = new Error('上傳已取消。');
      error.code = 'UPLOAD_CANCELLED';
      throw error;
    }
  };

  try {
    ensureActive();
    if (prepared.originalBytes > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
      await uploadResumableOriginal(originalPath, prepared.originalFile, prepared.originalMimeType, options, client);
    } else {
      const originalResult = await client.storage.from(CLOSET_MEDIA_BUCKET).upload(originalPath, prepared.originalFile, {
        contentType: prepared.originalMimeType,
        cacheControl: '3600',
        upsert: false
      });
      if (originalResult.error) throw originalResult.error;
    }
    uploaded.push(originalPath);

    ensureActive();
    const displayResult = await client.storage.from(CLOSET_MEDIA_BUCKET).upload(displayPath, prepared.displayBlob, {
      contentType: prepared.displayMimeType,
      cacheControl: '3600',
      upsert: false
    });
    if (displayResult.error) throw displayResult.error;
    uploaded.push(displayPath);

    ensureActive();
    const verification = await client.storage.from(CLOSET_MEDIA_BUCKET).download(displayPath);
    if (verification.error || !verification.data) throw verification.error || new Error('處理後照片無法讀取。');
    ensureActive();

    return {
      userId,
      originalPath,
      displayPath,
      databaseFields: {
        photo: null,
        photo_original_path: originalPath,
        photo_display_path: displayPath,
        photo_mime_type: prepared.originalMimeType,
        photo_width: prepared.width,
        photo_height: prepared.height,
        photo_file_size: prepared.originalBytes,
        photo_processing_status: 'READY',
        photo_updated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    try { await removePaths(uploaded, client); } catch { /* audited by the orphan tool */ }
    throw error;
  }
}

export async function cleanupUploadedClothingMedia(media, client = supabase) {
  if (!media) return;
  await removePaths([media.originalPath, media.displayPath], client);
}

export async function removeReplacedDerivative(path, client = supabase) {
  if (!path) return;
  await removePaths([path], client);
}

export async function createPrivateClothingPhotoUrl(path, client = supabase) {
  if (!path) return '';
  const { data, error } = await client.storage.from(CLOSET_MEDIA_BUCKET).download(path);
  if (error || !data || typeof URL?.createObjectURL !== 'function') return '';
  const objectUrl = URL.createObjectURL(data);
  privateObjectUrls.add(objectUrl);
  return objectUrl;
}

export function releasePrivateClothingPhotoUrls() {
  for (const objectUrl of privateObjectUrls) URL.revokeObjectURL(objectUrl);
  privateObjectUrls.clear();
}

export async function hydratePrivateClothingPhotos(items, client = supabase) {
  return Promise.all((items || []).map(async (item) => {
    if (!item?.photo_display_path) return item;
    const signedUrl = await createPrivateClothingPhotoUrl(item.photo_display_path, client);
    return signedUrl ? { ...item, photo: signedUrl } : item;
  }));
}

export async function cleanupDeletedItemMedia(userId, itemId, client = supabase) {
  if (!userId || !itemId) return { removed: 0 };
  const itemPrefix = `closet/${userId}/${itemId}`;
  const root = await client.storage.from(CLOSET_MEDIA_BUCKET).list(itemPrefix, { limit: 100 });
  if (root.error) throw root.error;
  const paths = [];
  for (const operation of root.data || []) {
    if (!operation?.name || operation.name.includes('.')) continue;
    const nested = await client.storage.from(CLOSET_MEDIA_BUCKET).list(`${itemPrefix}/${operation.name}`, { limit: 10 });
    if (nested.error) throw nested.error;
    for (const file of nested.data || []) {
      if (/^(original|display)\.(jpg|jpeg|png|webp)$/i.test(file.name || '')) {
        paths.push(`${itemPrefix}/${operation.name}/${file.name}`);
      }
    }
  }
  await removePaths(paths, client);
  return { removed: paths.length };
}

export { requireUserId as getAuthenticatedMediaUserId };
