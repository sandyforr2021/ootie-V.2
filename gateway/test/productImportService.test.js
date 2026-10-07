import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductHtml, ProductImportService } from '../src/services/productImportService.js';

test('product parser prefers JSON-LD Product over OpenGraph', () => {
  const html = `<html><head><meta property="og:title" content="Fallback title"><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name: 'Relaxed Cardigan', brand: { name: 'COS' }, image: ['https://cdn.example/cardigan.jpg'], offers: { price: '2990', priceCurrency: 'TWD' }
  })}</script></head></html>`;
  assert.deepEqual(parseProductHtml(html, 'https://shop.example/products/cardigan'), {
    title: 'Relaxed Cardigan', brand: 'COS', image: 'https://cdn.example/cardigan.jpg',
    sourceUrl: 'https://shop.example/products/cardigan', sourceDomain: 'shop.example',
    price: '2990', currency: 'TWD', parser: 'json-ld', needsManualInput: false
  });
});

test('product parser falls back to OpenGraph and reports missing fields', () => {
  const parsed = parseProductHtml('<meta property="og:title" content="Blue Shirt"><meta property="og:site_name" content="Studio">', 'https://studio.example/item');
  assert.equal(parsed.title, 'Blue Shirt');
  assert.equal(parsed.brand, 'Studio');
  assert.equal(parsed.parser, 'opengraph');
  assert.equal(parsed.needsManualInput, true);
});

test('product import blocks private network targets before fetch', async () => {
  let fetchCalls = 0;
  const service = new ProductImportService({
    lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    fetchImpl: async () => { fetchCalls += 1; }
  });
  await assert.rejects(() => service.preview('http://example.test/product'), { code: 'PRODUCT_URL_BLOCKED' });
  assert.equal(fetchCalls, 0);
});
