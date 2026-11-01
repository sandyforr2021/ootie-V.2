import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CommerceService } from '../src/commerce/service.js';

const userId = randomUUID();
const productId = randomUUID();

function fixture() {
  const current = { id: productId, user_id: userId, title: 'Shirt', category: 'upper_body', color: '#c8bba9', source_url: '', state: 'wishlist' };
  const calls = [];
  const repository = {
    product: async (id, owner) => id === productId && owner === userId ? current : null,
    updateProduct: async (id, owner, changes) => {
      calls.push(changes);
      return id === productId && owner === userId ? { ...current, ...changes } : null;
    }
  };
  return { service: new CommerceService({ repository, storage: {} }), calls };
}

test('updates owner wishlist metadata without replacing its image or state', async () => {
  const f = fixture();
  const updated = await f.service.updateProduct({ id: userId }, productId, {
    title: '  Linen shirt  ', category: 'lower_body', color: '#123456', sourceUrl: 'https://shop.example/item'
  });
  assert.equal(updated.title, 'Linen shirt');
  assert.deepEqual(f.calls, [{
    title: 'Linen shirt', category: 'lower_body', outfit_layer: 'bottom',
    color: '#123456', source_url: 'https://shop.example/item'
  }]);
});

test('preserves outerwear as its own layer after normalizing its product category', async () => {
  const f = fixture();
  const updated = await f.service.updateProduct({ id: userId }, productId, { category: 'outer' });
  assert.equal(updated.category, 'upper_body');
  assert.equal(updated.outfit_layer, 'outer');
  assert.deepEqual(f.calls, [{ category: 'upper_body', outfit_layer: 'outer' }]);
});

test('rejects invalid wishlist metadata and try-on snapshots', async () => {
  const f = fixture();
  await assert.rejects(f.service.updateProduct({ id: userId }, productId, { title: ' '.repeat(2) }), { code: 'INVALID_TITLE' });
  await assert.rejects(f.service.updateProduct({ id: userId }, productId, { category: 'unknown' }), { code: 'INVALID_CATEGORY' });
  await assert.rejects(f.service.updateProduct({ id: userId }, productId, { sourceUrl: 'javascript:alert(1)' }), { code: 'INVALID_PRODUCT_URL' });
  assert.equal(f.calls.length, 0);

  f.service.repository.product = async () => ({ ...productId, state: 'tryon_only' });
  await assert.rejects(f.service.updateProduct({ id: userId }, productId, { title: 'Changed' }), { code: 'PRODUCT_NOT_FOUND' });
});
