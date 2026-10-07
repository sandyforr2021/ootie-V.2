import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleVertexClient } from '../src/providers/googleVertexClient.js';
import { GoogleVtoProvider } from '../src/providers/googleVtoProvider.js';
import { googleSafetyRejection } from '../src/providers/googleSafety.js';

const clientForResponse = (status, payload) => new GoogleVertexClient({
  projectId: 'test-project', tokenProvider: { async getToken() { return 'test-token'; } },
  fetchImpl: async () => ({ ok: status < 400, status, async json() { return payload; } })
});
const request = { location: 'test-region', model: 'test-model', action: 'predict', body: {} };

test('HTTP input safety rejection preserves only documented support codes', async () => {
  const client = clientForResponse(400, { error: {
    message: 'Responsible AI rejected private input text. Support codes: 58061214, 12345678'
  } });
  await assert.rejects(client.postModel(request), (error) => {
    assert.equal(error.code, 'SAFETY_REJECTION');
    assert.deepEqual(error.details, { safetyReason: 'AGE_RESTRICTED', supportCodes: ['58061214'] });
    assert.doesNotMatch(JSON.stringify(error), /private input|12345678/);
    return true;
  });
});

test('an invalid safety setting is a provider configuration error', async () => {
  await assert.rejects(clientForResponse(400, { error: {
    message: 'Invalid safety setting value'
  } }).postModel(request), (error) => error.code === 'PROVIDER_ERROR');
});

test('a request blocked by IAM is not misreported as an unsafe photo', async () => {
  await assert.rejects(clientForResponse(403, { error: {
    message: 'Request blocked by organization policy: permission denied'
  } }).postModel(request), (error) => error.code === 'PROVIDER_ERROR');
});

test('HTTP 200 with a filtered VTO prediction returns a safety rejection', async () => {
  const provider = new GoogleVtoProvider({
    vertexClient: clientForResponse(200, { predictions: [{ raiFilteredReason: 'Support codes: 15236754' }] }),
    model: 'test-model', location: 'test-region'
  });
  await assert.rejects(provider.generateSingleGarmentTryOn({
    personImage: { buffer: Buffer.from('person') }, garmentImage: { buffer: Buffer.from('garment') }
  }), (error) => error.code === 'SAFETY_REJECTION'
    && error.details.safetyReason === 'PUBLIC_FIGURE_RESTRICTED');
});

test('an empty VTO response without a reason remains an invalid output', async () => {
  const provider = new GoogleVtoProvider({
    vertexClient: clientForResponse(200, { predictions: [] }), model: 'test-model', location: 'test-region'
  });
  await assert.rejects(provider.generateSingleGarmentTryOn({
    personImage: { buffer: Buffer.from('person') }, garmentImage: { buffer: Buffer.from('garment') }
  }), (error) => error.code === 'INVALID_PROVIDER_OUTPUT');
});

test('an unspecified or mixed reason does not invent a specific cause', () => {
  assert.equal(googleSafetyRejection('Google safety filter').details.safetyReason, 'UNSPECIFIED');
  assert.equal(googleSafetyRejection('Support codes: 58061214, 15236754').details.safetyReason, 'UNSPECIFIED');
});
