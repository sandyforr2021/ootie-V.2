import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { SupabaseGateway } from '../src/services/supabaseGateway.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const config = {
  supabase: {
    url: 'https://project.supabase.co',
    publishableKey: 'publishable',
    serviceRoleKey: 'server-only-role',
    aiBucket: 'ootie-ai-private'
  }
};

test('shared clothing authorizes with the viewer JWT before reading only the owner display image', async () => {
  const itemId = '33333333-3333-4333-8333-333333333333';
  const profileId = '22222222-2222-4222-8222-222222222222';
  const path = `closet/${USER_ID}/${itemId}/operation/display.webp`;
  const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: 'white' } }).webp().toBuffer();
  const calls = [];
  const gateway = new SupabaseGateway({ config, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/ootie_clothing_items?')) return Response.json([{ id: itemId, owner_id: profileId, photo_display_path: path }]);
    if (url.includes('/ootie_profiles?')) return Response.json([{ user_id: USER_ID }]);
    return new Response(image, { headers: { 'content-type': 'image/webp' } });
  } });
  const result = await gateway.sharedClothingImage({ accessToken: 'viewer-session' }, itemId);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer viewer-session');
  assert.equal(calls[0].options.headers.apikey, 'publishable');
  assert.equal(calls[2].url, `https://project.supabase.co/storage/v1/object/authenticated/ootie-closet-media/${path}`);
  assert.equal(result.mimeType, 'image/jpeg');
});

test('unshared or revoked clothing never falls back to service-role row access', async () => {
  const calls = [];
  const gateway = new SupabaseGateway({ config, fetchImpl: async (url) => { calls.push(url); return Response.json([]); } });
  await assert.rejects(gateway.sharedClothingImage({ accessToken: 'viewer-session' }, '33333333-3333-4333-8333-333333333333'), e => e.code === 'ITEM_NOT_FOUND');
  assert.equal(calls.length, 1);
  await assert.rejects(gateway.sharedClothingImage({}, '33333333-3333-4333-8333-333333333333'), e => e.code === 'AUTH_REQUIRED');
  assert.equal(calls.length, 1);
});

test('shared clothing rejects originals and forged cross-owner display references before storage access', async () => {
  const itemId = '33333333-3333-4333-8333-333333333333';
  for (const path of [`closet/${USER_ID}/${itemId}/op/original.jpg`, `closet/99999999-9999-4999-8999-999999999999/${itemId}/op/display.jpg`]) {
    let storageCalls = 0;
    const gateway = new SupabaseGateway({ config, fetchImpl: async (url) => {
      if (url.includes('/ootie_clothing_items?')) return Response.json([{ id: itemId, owner_id: '22222222-2222-4222-8222-222222222222', photo_display_path: path }]);
      if (url.includes('/ootie_profiles?')) return Response.json([{ user_id: USER_ID }]);
      storageCalls += 1;
      return new Response('');
    } });
    await assert.rejects(gateway.sharedClothingImage({ accessToken: 'viewer-session' }, itemId));
    assert.equal(storageCalls, 0);
  }
});

test('person photo delete resolves an exact owner-scoped object before removal', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('/storage/v1/object/list/')) {
      return new Response(JSON.stringify([
        { id: 'object-1', name: 'owned-photo.jpg', created_at: '2026-10-02T00:00:00Z' },
        { id: 'object-2', name: 'another-photo.png', created_at: '2026-10-01T00:00:00Z' }
      ]), { status: 200 });
    }
    if (options.method === 'DELETE') return new Response('{}', { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const gateway = new SupabaseGateway({ config, fetchImpl });

  const removed = await gateway.deletePersonPhoto(USER_ID, 'owned-photo');

  assert.equal(removed.path, `person/${USER_ID}/owned-photo.jpg`);
  const deleteCall = calls.find((call) => call.options.method === 'DELETE');
  assert.equal(deleteCall.url, 'https://project.supabase.co/storage/v1/object/ootie-ai-private');
  assert.deepEqual(JSON.parse(deleteCall.options.body), {
    prefixes: [`person/${USER_ID}/owned-photo.jpg`]
  });
  assert.equal(deleteCall.options.headers.Authorization, 'Bearer server-only-role');
});

test('person photo delete never guesses an unlisted cross-owner path', async () => {
  let deleteCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    if (url.includes('/storage/v1/object/list/')) {
      return new Response(JSON.stringify([{ id: 'object-1', name: 'owned-photo.jpg' }]), { status: 200 });
    }
    if (options.method === 'DELETE') deleteCalls += 1;
    return new Response('{}', { status: 200 });
  };
  const gateway = new SupabaseGateway({ config, fetchImpl });

  await assert.rejects(
    gateway.deletePersonPhoto(USER_ID, 'someone-elses-photo'),
    (error) => error.code === 'PERSON_IMAGE_NOT_FOUND'
  );
  assert.equal(deleteCalls, 0);
});

test('stored WebP clothing is converted in memory before provider use', async () => {
  const webp = await sharp({
    create: {
      width: 512,
      height: 640,
      channels: 3,
      background: { r: 235, g: 225, b: 214 }
    }
  }).webp({ quality: 88 }).toBuffer();
  const fetchImpl = async () => new Response(webp, {
    status: 200,
    headers: { 'content-type': 'image/webp' }
  });
  const gateway = new SupabaseGateway({ config, fetchImpl });

  const image = await gateway.clothingImage({
    id: '33333333-3333-4333-8333-333333333333',
    name_zh: '米色針織上衣',
    photo: 'https://project.supabase.co/storage/v1/object/public/ootie-public/demo/garment.webp'
  });

  assert.equal(image.mimeType, 'image/jpeg');
  assert.equal(image.width, 512);
  assert.equal(image.height, 640);
  assert.equal(webp.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.equal(image.buffer[0], 0xff);
  assert.equal(image.buffer[1], 0xd8);
});

test('a newly uploaded private closet photo is read without a legacy public photo URL', async () => {
  const itemId = '33333333-3333-4333-8333-333333333333';
  const photoPath = `closet/${USER_ID}/${itemId}/operation/display.webp`;
  const webp = await sharp({ create: {
    width: 768, height: 768, channels: 3, background: { r: 240, g: 230, b: 220 }
  } }).webp().toBuffer();
  const calls = [];
  const gateway = new SupabaseGateway({ config, fetchImpl: async (url) => {
    calls.push(url);
    return new Response(webp, { status: 200, headers: { 'content-type': 'image/webp' } });
  } });
  const result = await gateway.clothingImage({
    id: itemId, name: 'Uploaded shirt', photo: null, photo_display_path: photoPath
  }, { userId: USER_ID });
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.width, 768);
  assert.equal(calls[0], `https://project.supabase.co/storage/v1/object/authenticated/ootie-closet-media/${photoPath}`);
});

test('private closet media rejects another user, another item and traversal before download', async () => {
  const itemId = '33333333-3333-4333-8333-333333333333';
  let calls = 0;
  const gateway = new SupabaseGateway({ config, fetchImpl: async () => { calls += 1; return new Response(''); } });
  for (const photoPath of [
    `closet/99999999-9999-4999-8999-999999999999/${itemId}/operation/display.webp`,
    `closet/${USER_ID}/99999999-9999-4999-8999-999999999999/operation/display.webp`,
    `closet/${USER_ID}/${itemId}/../display.webp`,
    `closet/${USER_ID}/${itemId}/%2e%2e/display.webp`,
    `closet/${USER_ID}/${itemId}/operation\\display.webp`,
    `closet/${USER_ID}/${itemId}/operation/display.webp?other=path`
  ]) {
    await assert.rejects(gateway.clothingImage({ id: itemId, photo: null, photo_display_path: photoPath }, {
      userId: USER_ID
    }), (error) => error.code === 'CLOTHING_IMAGE_SOURCE_UNSUPPORTED');
  }
  assert.equal(calls, 0);
});

test('owned item lookup includes the private display path needed by both generation modes', async () => {
  const itemId = '33333333-3333-4333-8333-333333333333';
  let select;
  const gateway = new SupabaseGateway({ config, fetchImpl: async (url) => {
    select = new URL(url).searchParams.get('select');
    return new Response(JSON.stringify([{ id: itemId, photo: null, photo_display_path: 'private-path' }]), { status: 200 });
  } });
  const items = await gateway.findOwnedItems('22222222-2222-4222-8222-222222222222', [itemId]);
  assert.ok(select.split(',').includes('photo_display_path'));
  assert.equal(items[0].photo_display_path, 'private-path');
});
