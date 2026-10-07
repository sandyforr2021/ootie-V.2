import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayApp } from '../src/app.js';
import { GatewayError } from '../src/errors.js';

const config = { corsAllowedOrigins: ['https://ootie.example'] };
const provider = { async healthCheck() { return { provider: 'google_cloud', configured: true }; } };

const createApp = ({ authenticated = true } = {}) => {
  let paidCalls = 0;
  const supabase = {
    async verifyAccessToken(header) {
      if (!authenticated || !header) throw new GatewayError('AUTH_REQUIRED', 401);
      return { id: '11111111-1111-4111-8111-111111111111' };
    },
    async findProfileForUser() { return { id: '22222222-2222-4222-8222-222222222222' }; }
  };
  const generationService = {
    capabilities: () => ({ imageGenerationEnabled: true }),
    async listPersonPhotos() { return []; },
    async listGenerations() { return []; },
    async generateImage() { paidCalls += 1; return { ok: true }; },
    async recommend() { return { ok: true }; },
    async uploadPersonPhoto() { return { ok: true }; },
    async deletePersonPhoto(user, photoId) { return { id: photoId, path: `person/${user.id}/${photoId}.jpg`, deleted: true }; },
    async privateImage() { return { buffer: Buffer.from('private-image'), mimeType: 'image/png' }; },
    async saveGeneration() { return { ok: true }; }
  };
  const productImportService = { async preview(url) { return { title: 'Parsed', sourceUrl: url }; } };
  return { app: createGatewayApp({ config, supabase, provider, generationService, productImportService }), paidCalls: () => paidCalls };
};

test('public health endpoint reports provider configuration without an AI request', async () => {
  const { app } = createApp({ authenticated: false });
  const response = await app.dispatch({ method: 'GET', path: '/health', headers: {} });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, provider: 'google_cloud', configured: true });
});

test('guest cannot call paid Virtual Try-On', async () => {
  const { app, paidCalls } = createApp({ authenticated: false });
  const response = await app.dispatch({ method: 'POST', path: '/v1/generations/single-try-on', headers: {}, body: {} });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
  assert.equal(paidCalls(), 0);
});

test('private image proxy requires a current member session after logout', async () => {
  const { app } = createApp({ authenticated: true });
  const path = `/v1/private-images/${encodeURIComponent('ai-generated/11111111-1111-4111-8111-111111111111/result.png')}`;
  const signedIn = await app.dispatch({ method: 'GET', path, headers: { authorization: 'Bearer valid' } });
  const signedOut = await app.dispatch({ method: 'GET', path, headers: {} });
  assert.equal(signedIn.status, 200);
  assert.deepEqual(signedIn.rawBody, Buffer.from('private-image'));
  assert.equal(signedIn.headers['Cache-Control'], 'private, no-store');
  assert.equal(signedOut.status, 401);
});

test('private person photo deletion requires auth and uses the verified member identity', async () => {
  const signedOut = createApp({ authenticated: false });
  const denied = await signedOut.app.dispatch({ method: 'DELETE', path: '/v1/person-photos/demo-photo', headers: {} });
  assert.equal(denied.status, 401);

  const signedIn = createApp({ authenticated: true });
  const removed = await signedIn.app.dispatch({
    method: 'DELETE',
    path: '/v1/person-photos/demo-photo',
    headers: { authorization: 'Bearer valid', origin: 'https://ootie.example' }
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body, {
    id: 'demo-photo',
    path: 'person/11111111-1111-4111-8111-111111111111/demo-photo.jpg',
    deleted: true
  });
  assert.equal(removed.headers['Access-Control-Allow-Origin'], 'https://ootie.example');
});

test('unlisted browser origin is rejected before authentication', async () => {
  const { app } = createApp();
  const response = await app.dispatch({ method: 'GET', path: '/v1/capabilities', headers: { origin: 'https://evil.example', authorization: 'Bearer valid' } });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'ORIGIN_NOT_ALLOWED');
});

test('product import preview requires auth and returns server parsed metadata', async () => {
  const signedOut = createApp({ authenticated: false });
  const denied = await signedOut.app.dispatch({ method: 'POST', path: '/v1/product-import/preview', headers: {}, body: { url: 'https://shop.example/item' } });
  assert.equal(denied.status, 401);

  const signedIn = createApp({ authenticated: true });
  const result = await signedIn.app.dispatch({ method: 'POST', path: '/v1/product-import/preview', headers: { authorization: 'Bearer valid' }, body: { url: 'https://shop.example/item' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.title, 'Parsed');
});
