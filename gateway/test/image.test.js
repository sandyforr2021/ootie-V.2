import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { detectMime, normalizeGarmentImageForAi, validateImageBytes } from '../src/image.js';

test('normalizes a wardrobe WebP into a provider-safe JPEG derivative', async () => {
  const original = await sharp({
    create: {
      width: 640,
      height: 800,
      channels: 4,
      background: { r: 242, g: 232, b: 218, alpha: 0.82 }
    }
  }).webp({ quality: 90 }).toBuffer();

  const derivative = await normalizeGarmentImageForAi(original, 'image/webp');

  assert.equal(detectMime(original), 'image/webp');
  assert.equal(derivative.mimeType, 'image/jpeg');
  assert.equal(derivative.width, 640);
  assert.equal(derivative.height, 800);
  assert.notDeepEqual(derivative.buffer, original);
  assert.doesNotThrow(() => validateImageBytes(derivative.buffer, 'image/jpeg'));
});

test('accepts generic Storage content type when WebP bytes are valid', async () => {
  const original = await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: { r: 210, g: 220, b: 230 }
    }
  }).webp().toBuffer();

  const derivative = await normalizeGarmentImageForAi(original, 'application/octet-stream');
  assert.equal(derivative.mimeType, 'image/jpeg');
});

test('rejects an image MIME claim that conflicts with the actual garment bytes', async () => {
  const original = await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: { r: 250, g: 250, b: 250 }
    }
  }).webp().toBuffer();

  await assert.rejects(
    normalizeGarmentImageForAi(original, 'image/png'),
    (error) => error.code === 'CLOTHING_IMAGE_INVALID'
  );
});
