import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleStylingProvider } from '../src/providers/googleStylingProvider.js';
import { GoogleVtoProvider } from '../src/providers/googleVtoProvider.js';
import { GoogleNanoBananaProvider } from '../src/providers/googleNanoBananaProvider.js';

const ITEM_ID = '33333333-3333-4333-8333-333333333333';

test('styling adapter rejects a model-invented clothing item ID', async () => {
  const vertexClient = {
    async postModel() {
      return { candidates: [{ content: { parts: [{ text: JSON.stringify({
        outfitTitle: 'Invented', reason: 'bad', style: 'x', occasion: 'y', weatherNote: '',
        items: [{ clothingItemId: '99999999-9999-4999-8999-999999999999', role: 'top', reason: 'bad' }]
      }) }] } }] };
    }
  };
  const provider = new GoogleStylingProvider({ vertexClient, model: 'env-model', location: 'global' });
  await assert.rejects(
    provider.recommendOutfit({ wardrobeItems: [{ id: ITEM_ID, name: 'Owned' }], itemLimit: 3 }),
    (error) => error.code === 'INVALID_PROVIDER_OUTPUT'
  );
});

test('Virtual Try-On adapter always requests exactly one image', async () => {
  let request;
  const vertexClient = { async postModel(input) { request = input; return { predictions: [{ bytesBase64Encoded: Buffer.from('result').toString('base64'), mimeType: 'image/png' }] }; } };
  const provider = new GoogleVtoProvider({ vertexClient, model: 'vto-from-env', location: 'asia-southeast1' });
  await provider.generateSingleGarmentTryOn({ personImage: { buffer: Buffer.from('p') }, garmentImage: { buffer: Buffer.from('g') } });
  assert.equal(request.model, 'vto-from-env');
  assert.equal(request.location, 'asia-southeast1');
  assert.equal(request.body.parameters.sampleCount, 1);
});

test('outfit preview adapter fixes development output to 1K and one candidate', async () => {
  let request;
  const vertexClient = { async postModel(input) { request = input; return { candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from('result').toString('base64'), mimeType: 'image/png' } }] } }] }; } };
  const provider = new GoogleNanoBananaProvider({ vertexClient, model: 'image-from-env', location: 'global', outputSize: '1K' });
  await provider.generateOutfitPreview({ personImage: { buffer: Buffer.from('p'), mimeType: 'image/jpeg' }, garmentImages: [{ buffer: Buffer.from('g'), mimeType: 'image/jpeg' }], prompt: '' });
  assert.equal(request.body.generationConfig.imageConfig.imageSize, '1K');
  assert.equal(request.body.generationConfig.candidateCount, 1);
  assert.equal(request.model, 'image-from-env');
});
