import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Upload } from 'tus-js-client';

const parseEnvFile = (file) => Object.fromEntries(
  fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const parseLocalAccount = () => {
  const text = fs.readFileSync('DEMO_ACCOUNT.local.md', 'utf8');
  const value = (label) => {
    const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`- ${label}:`)) || '';
    return line.slice(line.indexOf(':') + 1).trim().replace(/^`|`$/g, '');
  };
  return { email: value('Email'), password: value('Password') };
};

const env = parseEnvFile('.env.local');
const url = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demo = parseLocalAccount();
if (!url || !anonKey || !serviceKey || !demo.email || !demo.password) {
  throw new Error(`Missing Development Supabase or local presentation account configuration: ${JSON.stringify({ url: Boolean(url), anonKey: Boolean(anonKey), serviceKey: Boolean(serviceKey), email: Boolean(demo.email), password: Boolean(demo.password) })}`);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const owner = createClient(url, anonKey, options);
const other = createClient(url, anonKey, options);
const anonymous = createClient(url, anonKey, options);
const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const otherEmail = `ootie-media-${suffix}@dev.example.com`;
const otherPassword = `Media-${crypto.randomUUID()}!aA1`;
let otherUserId = '';
let otherProfileId = '';
let itemId = crypto.randomUUID();
let referencePostId = '';
const operationOne = crypto.randomUUID();
const operationTwo = crypto.randomUUID();
let ownerUserId = '';
let ownerProfileId = '';
const bucketName = 'ootie-closet-media';
const paths = [];

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const upload = async (client, path) => {
  const result = await client.storage.from(bucketName).upload(path, png, { contentType: 'image/png', upsert: false });
  if (result.error) throw result.error;
  paths.push(path);
};

const uploadLargeOriginal = async (client, path) => {
  const session = await client.auth.getSession();
  if (session.error || !session.data.session?.access_token) throw session.error || new Error('Missing member access token');
  const directEndpoint = `${url.replace('.supabase.co', '.storage.supabase.co')}/storage/v1/upload/resumable`;
  const largeJpegLikePayload = Buffer.alloc((6 * 1024 * 1024) + 1);
  largeJpegLikePayload.set([0xff, 0xd8, 0xff], 0);
  await new Promise((resolve, reject) => {
    const resumable = new Upload(largeJpegLikePayload, {
      endpoint: directEndpoint,
      retryDelays: [0, 3000, 5000],
      headers: { authorization: `Bearer ${session.data.session.access_token}` },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName,
        objectName: path,
        contentType: 'image/jpeg',
        cacheControl: '3600'
      },
      onError: reject,
      onSuccess: resolve
    });
    resumable.start();
  });
  paths.push(path);
};

const assertions = [];
const check = (name, condition, details = null) => {
  assertions.push({ name, ok: Boolean(condition), ...(details ? { details } : {}) });
  if (!condition) throw new Error(`Smoke failed: ${name}${details ? ` (${details})` : ''}`);
};

const removeItemMediaTree = async (userId, targetItemId) => {
  const itemPrefix = `closet/${userId}/${targetItemId}`;
  const root = await admin.storage.from(bucketName).list(itemPrefix, { limit: 100 });
  if (root.error) return;
  const deletePaths = [];
  for (const operation of root.data || []) {
    if (!operation.name || operation.id) continue;
    const nested = await admin.storage.from(bucketName).list(`${itemPrefix}/${operation.name}`, { limit: 10 });
    for (const file of nested.data || []) {
      if (file.id && /^(original|display)\.(jpg|jpeg|png|webp)$/i.test(file.name || '')) {
        deletePaths.push(`${itemPrefix}/${operation.name}/${file.name}`);
      }
    }
  }
  if (deletePaths.length) await admin.storage.from(bucketName).remove(deletePaths);
};

const cleanupPriorSmokeRows = async (profileId, userId) => {
  await admin.from('ootie_ootd_posts').delete().eq('user_id', profileId).like('caption', 'Media reference guard %');
  const prior = await admin.from('ootie_clothing_items').select('id').eq('owner_id', profileId).like('name', 'Media smoke %');
  for (const row of prior.data || []) {
    await admin.from('ootie_clothing_items').delete().eq('id', row.id).eq('owner_id', profileId);
    await removeItemMediaTree(userId, row.id);
  }
};

try {
  const ownerLogin = await owner.auth.signInWithPassword(demo);
  if (ownerLogin.error) throw ownerLogin.error;
  ownerUserId = ownerLogin.data.user.id;
  const ownerProfile = await owner.from('ootie_profiles').select('id').eq('user_id', ownerUserId).single();
  if (ownerProfile.error) throw ownerProfile.error;
  ownerProfileId = ownerProfile.data.id;
  await cleanupPriorSmokeRows(ownerProfileId, ownerUserId);

  const resumableOperation = crypto.randomUUID();
  const resumablePath = `closet/${ownerUserId}/${itemId}/${resumableOperation}/original.jpg`;
  await uploadLargeOriginal(owner, resumablePath);
  const resumableList = await owner.storage.from(bucketName).list(`closet/${ownerUserId}/${itemId}/${resumableOperation}`);
  check('large original resumable upload allowed', !resumableList.error && resumableList.data.some((file) => file.name === 'original.jpg'));
  await owner.storage.from(bucketName).remove([resumablePath]);
  paths.splice(paths.indexOf(resumablePath), 1);

  const createdOther = await admin.auth.admin.createUser({
    email: otherEmail,
    password: otherPassword,
    email_confirm: true
  });
  if (createdOther.error) throw createdOther.error;
  otherUserId = createdOther.data.user.id;
  const otherLogin = await other.auth.signInWithPassword({ email: otherEmail, password: otherPassword });
  if (otherLogin.error) throw otherLogin.error;
  const otherProfile = await admin.from('ootie_profiles').select('id').eq('user_id', otherUserId).single();
  if (otherProfile.error) throw otherProfile.error;
  otherProfileId = otherProfile.data.id;

  const baseOne = `closet/${ownerUserId}/${itemId}/${operationOne}`;
  const originalOne = `${baseOne}/original.png`;
  const displayOne = `${baseOne}/display.png`;
  await upload(owner, originalOne);
  await upload(owner, displayOne);

  const inserted = await owner.from('ootie_clothing_items').insert({
    id: itemId,
    owner_id: ownerProfileId,
    name: `Media smoke ${suffix}`,
    category: 'Tops',
    photo_original_path: originalOne,
    photo_display_path: displayOne,
    photo_mime_type: 'image/png',
    photo_width: 128,
    photo_height: 128,
    photo_file_size: png.byteLength,
    photo_processing_status: 'READY',
    photo_updated_at: new Date().toISOString()
  }).select('id,photo_original_path,photo_display_path').single();
  if (inserted.error) throw inserted.error;
  check('owner row saved after upload', inserted.data.id === itemId);

  referencePostId = crypto.randomUUID();
  const referencePost = await admin.from('ootie_ootd_posts').insert({
    id: referencePostId,
    user_id: ownerProfileId,
    caption: `Media reference guard ${suffix}`,
    image: 'https://example.invalid/development-smoke.webp',
    item_ids: [itemId],
    wearing: []
  });
  if (referencePost.error) throw referencePost.error;
  const guardedDelete = await owner.from('ootie_clothing_items').delete().eq('id', itemId).eq('owner_id', ownerProfileId);
  check('referenced item deletion is blocked', guardedDelete.error?.code === '23503', guardedDelete.error?.code || 'no error');
  const removeReference = await admin.from('ootie_ootd_posts').delete().eq('id', referencePostId);
  if (removeReference.error) throw removeReference.error;
  referencePostId = '';

  const ownerDownload = await owner.storage.from(bucketName).download(displayOne);
  check('owner private download allowed', !ownerDownload.error && ownerDownload.data?.size > 0);

  const anonDownload = await anonymous.storage.from(bucketName).download(displayOne);
  check('anonymous private download denied', Boolean(anonDownload.error));
  const anonList = await anonymous.storage.from(bucketName).list(`closet/${ownerUserId}/${itemId}`);
  check('anonymous listing denied or empty', Boolean(anonList.error) || (anonList.data || []).length === 0);

  const crossDownload = await other.storage.from(bucketName).download(displayOne);
  check('cross-user private download denied', Boolean(crossDownload.error));
  const crossList = await other.storage.from(bucketName).list(`closet/${ownerUserId}/${itemId}`);
  check('cross-user listing denied or empty', Boolean(crossList.error) || (crossList.data || []).length === 0);
  await other.storage.from(bucketName).remove([displayOne]);
  const ownerOperationOneList = await owner.storage.from(bucketName).list(baseOne);
  check('cross-user delete cannot remove owner file', !ownerOperationOneList.error && ownerOperationOneList.data.some((file) => file.name === 'display.png'));

  const baseTwo = `closet/${ownerUserId}/${itemId}/${operationTwo}`;
  const originalTwo = `${baseTwo}/original.png`;
  const displayTwo = `${baseTwo}/display.png`;
  await upload(owner, originalTwo);
  await upload(owner, displayTwo);
  const replaced = await owner.from('ootie_clothing_items').update({
    photo_original_path: originalTwo,
    photo_display_path: displayTwo,
    photo_updated_at: new Date().toISOString()
  }).eq('id', itemId).eq('owner_id', ownerProfileId).select('id,photo_original_path,photo_display_path').single();
  if (replaced.error) throw replaced.error;
  await owner.storage.from(bucketName).remove([displayOne]);
  const oldOriginal = await owner.storage.from(bucketName).download(originalOne);
  const oldOperationList = await owner.storage.from(bucketName).list(baseOne);
  check('replace preserves previous original', !oldOriginal.error);
  check('replace removes previous derivative', !oldOperationList.error && !oldOperationList.data.some((file) => file.name === 'display.png'));

  const deleted = await owner.from('ootie_clothing_items').delete().eq('id', itemId).eq('owner_id', ownerProfileId).select('id').single();
  if (deleted.error) throw deleted.error;
  await owner.storage.from(bucketName).remove([originalOne, originalTwo, displayTwo]);
  paths.length = 0;
  check('unreferenced item delete succeeds', deleted.data.id === itemId);

  await owner.auth.signOut();
  const logoutRead = await owner.storage.from(bucketName).download(displayTwo);
  check('logout removes authenticated private access', Boolean(logoutRead.error));

  console.log(JSON.stringify({ ok: true, assertions }, null, 2));
} finally {
  if (paths.length) {
    try { await admin.storage.from(bucketName).remove(paths); } catch { /* best-effort smoke cleanup */ }
  }
  if (referencePostId) {
    try { await admin.from('ootie_ootd_posts').delete().eq('id', referencePostId); } catch { /* best-effort smoke cleanup */ }
  }
  if (itemId && ownerProfileId) {
    try { await admin.from('ootie_clothing_items').delete().eq('id', itemId); } catch { /* best-effort smoke cleanup */ }
    try { await removeItemMediaTree(ownerUserId, itemId); } catch { /* best-effort smoke cleanup */ }
  }
  if (otherProfileId) {
    try { await admin.from('ootie_profiles').delete().eq('id', otherProfileId); } catch { /* best-effort smoke cleanup */ }
  }
  if (otherUserId) {
    try { await admin.auth.admin.deleteUser(otherUserId); } catch { /* best-effort smoke cleanup */ }
  }
}
