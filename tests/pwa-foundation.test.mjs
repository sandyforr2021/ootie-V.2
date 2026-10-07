import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PWA manifest stays development-safe and installable', async () => {
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.name.includes('Development'), false);
  assert.ok(manifest.icons.some((icon) => icon.purpose.includes('maskable')));
});

test('service worker does not cache authenticated or private application requests', async () => {
  const serviceWorker = await read('public/sw.js');
  assert.match(serviceWorker, /request\.headers\.has\('authorization'\)/);
  assert.match(serviceWorker, /PRIVATE_PATH/);
  assert.doesNotMatch(serviceWorker, /localStorage|sessionStorage|access_token|refresh_token/);
});
