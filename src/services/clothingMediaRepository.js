import { supabase } from './supabase';
import { aiGateway } from './aiGateway';
import {registerMedia,acquireMedia,clearMediaMemory} from './mediaMemory';
import {itemPhoto} from './itemPresentation';
import {mediaEpoch} from './mediaMemory';
import {createListImage,listImagePath} from './listImage';

export const CLOSET_MEDIA_BUCKET = 'ootie-closet-media';
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
export const RESUMABLE_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;
const privateObjectUrls = new Set();
const sharedObjectUrls = new Set();
let sharedUrlVersion = 0;

export function releaseSharedClothingPhotoUrls() {
  sharedUrlVersion += 1;
  clearMediaMemory();
  for (const url of sharedObjectUrls) URL.revokeObjectURL(url);
  sharedObjectUrls.clear();
}

export async function hydrateSharedClothingPhotos(items, client = supabase, {defer=false}={}) {
  items=items.map(item=>{const photo=itemPhoto(item);return photo.startsWith('/')?{...item,photo}:item;});
  if (!items.some(item => item.photo_display_path)) return items;
  const version = sharedUrlVersion;
  const { data } = await client.auth.getSession();
  const session=data?.session, token=session?.access_token;
  if (!token || version!==sharedUrlVersion) return items;
  return Promise.all(items.map(async item => {
    if (!item.photo_display_path) return item;
    const prepared=itemPhoto(item);
    if(prepared.startsWith('/'))return {...item,photo:prepared};
    const id=registerMedia(session.user?.id||token,`shared:${item.id}:${item.photo_display_path}:${item.photo_updated_at||''}`,()=>defer?aiGateway.loadSharedClothingImage(token,item.id,{thumbnail:true}):aiGateway.loadSharedClothingImage(token,item.id),()=>aiGateway.loadSharedClothingImage(token,item.id));
    if(defer)return {...item,photo:id};
    try {const photo=await acquireMedia(id);return version===sharedUrlVersion?{...item,photo}:{...item,photo:''};}
    catch{return {...item,photo:''};}
  }));
}

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
    const thumbnail=await createListImage(prepared.displayBlob);
    if(thumbnail){
      ensureActive();const thumbnailPath=listImagePath(displayPath);
      const result=await client.storage.from(CLOSET_MEDIA_BUCKET).upload(thumbnailPath,thumbnail,{contentType:thumbnail.type,cacheControl:'3600',upsert:false});
      if(result.error)throw result.error;uploaded.push(thumbnailPath);
    }

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

export async function createPrivateClothingPhotoUrl(path, client = supabase, {thumbnail=false}={}) {
  const epoch=mediaEpoch.value;
  if (!path) return '';
  let {data,error}=await client.storage.from(CLOSET_MEDIA_BUCKET).download(thumbnail?listImagePath(path):path);
  if(thumbnail && error && ['404','NoSuchKey','not_found'].includes(String(error.statusCode||error.status||error.code))){({data,error}=await client.storage.from(CLOSET_MEDIA_BUCKET).download(path));}
  if(epoch!==mediaEpoch.value)return '';
  if (error || !data || typeof URL?.createObjectURL !== 'function') return '';
  const objectUrl = URL.createObjectURL(data);
  privateObjectUrls.add(objectUrl);
  return objectUrl;
}

export function releasePrivateClothingPhotoUrls() {
  clearMediaMemory();
  for (const objectUrl of privateObjectUrls) URL.revokeObjectURL(objectUrl);
  privateObjectUrls.clear();
}

export async function hydratePrivateClothingPhotos(items, client = supabase, {defer=false}={}) {
  const epoch=mediaEpoch.value;
  const session=defer?(await client.auth.getSession()).data?.session:null;
  if(epoch!==mediaEpoch.value)return [];
  return Promise.all((items || []).map(async (item) => {
    const curated=itemPhoto(item);
    if(curated.startsWith('/assets/wardrobe-clean-v1/'))return {...item,photo:curated};
    if (!item?.photo_display_path) return item;
    const prepared=itemPhoto({...item,photo:''});
    if(prepared.startsWith('/'))return {...item,photo:prepared};
    if(defer){
      if(!session?.user?.id)return {...item,photo:''};
      return {...item,photo:registerMedia(session.user.id,`owned:${item.photo_display_path}:${item.photo_updated_at||''}`,()=>createPrivateClothingPhotoUrl(item.photo_display_path,client,{thumbnail:true}),()=>createPrivateClothingPhotoUrl(item.photo_display_path,client))};
    }
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
