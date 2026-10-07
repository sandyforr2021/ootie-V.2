import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerationService } from '../src/services/generationService.js';
import { GatewayError, ProviderError } from '../src/errors.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const GENERATION_ID = '44444444-4444-4444-8444-444444444444';

const config = (enabled = true) => ({
  google: {
    stylingModel: 'text-model-from-env',
    vtoModel: 'vto-model-from-env',
    imageModel: 'image-model-from-env',
    imageOutputSize: '1K'
  },
  cost: {
    imageGenerationEnabled: enabled,
    maxImagesPerUserPerDay: 2,
    quotaExemptUserIds: [],
    quotaTimezone: 'Asia/Taipei',
    estimatedVtoUsd: 0.01,
    estimatedPreviewUsd: 0.02,
    vtoPoints: 8,
    previewPoints: 12
  }
});

function createSupabaseFake({ claimResult = null, owned = true } = {}) {
  const generations = new Map();
  const uploads = [];
  const updates = [];
  const debits = [];
  return {
    generations,
    uploads,
    updates,
    debits,
    async claimGeneration(input) {
      if (claimResult) return claimResult;
      const existing = generations.get(input.id);
      if (existing) return { claimed: false, reason: 'DUPLICATE', status: existing.status };
      generations.set(input.id, { id: input.id, user_id: input.userId, generation_type: input.type, status: 'pending' });
      return { claimed: true, status: 'pending', quotaUsed: 1, quotaLimit: input.dailyLimit };
    },
    async getGeneration(id) { return generations.get(id) || null; },
    async updateGeneration(id, userId, changes) {
      updates.push(changes);
      const current = generations.get(id) || { id, user_id: userId, created_at: '2026-09-30T00:00:00.000Z' };
      const next = { ...current, ...changes };
      generations.set(id, next);
      return next;
    },
    async listOwnedItems() {
      return [{ id: ITEM_ID, name: 'White shirt', owner_id: PROFILE_ID, photo: 'data:image/jpeg;base64,/9j/2Q==' }];
    },
    async findOwnedItems() {
      if (!owned) throw new GatewayError('ITEM_NOT_OWNED', 403);
      return [{ id: ITEM_ID, name: 'White shirt', owner_id: PROFILE_ID, photo: 'photo' }];
    },
    async downloadPrivate() { return { buffer: Buffer.from('person'), mimeType: 'image/jpeg' }; },
    async clothingImage() { return { buffer: Buffer.from('garment'), mimeType: 'image/jpeg' }; },
    async debitGenerationPoints(input) { debits.push(input); return { debited: true, balance: 92 }; },
    async uploadPrivate(path, image) { uploads.push({ path, image }); },
    async listGenerations() { return []; },
    async listPersonPhotos() { return []; },
    async deletePersonPhoto(userId, photoId) { return { id: photoId, path: `person/${userId}/${photoId}.jpg` }; }
  };
}

test('private image service rejects another user path before Storage access', async () => {
  const supabase = createSupabaseFake();
  let downloads = 0;
  supabase.downloadPrivate = async () => { downloads += 1; return { buffer: Buffer.from('x'), mimeType: 'image/png' }; };
  const service = new GenerationService({ config: config(), supabase, provider: {} });
  await assert.rejects(
    service.privateImage({ id: USER_ID }, 'person/99999999-9999-4999-8999-999999999999/photo.jpg'),
    (error) => error.code === 'PRIVATE_IMAGE_NOT_OWNED'
  );
  assert.equal(downloads, 0);
});

test('kill switch blocks image generation before claim or provider call', async () => {
  const supabase = createSupabaseFake();
  let calls = 0;
  const provider = { async generateSingleGarmentTryOn() { calls += 1; } };
  const service = new GenerationService({ config: config(false), supabase, provider });
  await assert.rejects(
    service.generateImage({
      user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'single_try_on',
      body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
    }),
    (error) => error.code === 'IMAGE_GENERATION_DISABLED'
  );
  assert.equal(calls, 0);
  assert.equal(supabase.generations.size, 0);
});

test('quota claim blocks provider before a paid request', async () => {
  const supabase = createSupabaseFake({ claimResult: { claimed: false, reason: 'QUOTA_EXCEEDED', quotaUsed: 2, quotaLimit: 2 } });
  let calls = 0;
  const provider = { async generateSingleGarmentTryOn() { calls += 1; } };
  const service = new GenerationService({ config: config(), supabase, provider });
  await assert.rejects(
    service.generateImage({
      user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'single_try_on',
      body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
    }),
    (error) => error.code === 'QUOTA_EXCEEDED'
  );
  assert.equal(calls, 0);
});

test('configured presentation account bypasses only the daily image quota', async () => {
  const supabase = createSupabaseFake();
  let claimedDailyLimit = 0;
  supabase.claimGeneration = async (input) => {
    claimedDailyLimit = input.dailyLimit;
    return { claimed: true, status: 'pending', quotaUsed: 4, quotaLimit: input.dailyLimit };
  };
  const exemptConfig = config();
  exemptConfig.cost.quotaExemptUserIds = [USER_ID];
  const service = new GenerationService({ config: exemptConfig, supabase, provider: {} });

  await service.claim({ generationId: GENERATION_ID, userId: USER_ID, type: 'single_try_on', sourceItemIds: [ITEM_ID] });

  assert.equal(claimedDailyLimit, 2_147_483_647);
  assert.deepEqual(service.capabilities({ id: USER_ID }), {
    imageGenerationEnabled: true,
    maxImagesPerUserPerDay: null,
    quotaExempt: true,
    outputSize: '1K',
    pointsCost: { singleTryOn: 8, outfitPreview: 12 },
    provider: 'google_cloud'
  });
  assert.equal(service.capabilities({ id: '99999999-9999-4999-8999-999999999999' }).maxImagesPerUserPerDay, 2);
});

test('unowned clothing is rejected before provider invocation', async () => {
  const supabase = createSupabaseFake({ owned: false });
  let calls = 0;
  const provider = { async generateSingleGarmentTryOn() { calls += 1; } };
  const service = new GenerationService({ config: config(), supabase, provider });
  await assert.rejects(
    service.generateImage({
      user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'single_try_on',
      body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
    }),
    (error) => error.code === 'ITEM_NOT_OWNED'
  );
  assert.equal(calls, 0);
});

test('successful image generation uploads bytes while ledger stores only a path', async () => {
  const supabase = createSupabaseFake();
  let calls = 0;
  const provider = {
    async generateSingleGarmentTryOn() {
      calls += 1;
      return { buffer: Buffer.from('generated-image-bytes'), mimeType: 'image/png' };
    }
  };
  const service = new GenerationService({ config: config(), supabase, provider, now: () => new Date('2026-09-30T10:00:00Z') });
  const result = await service.generateImage({
    user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'single_try_on',
    body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
  });
  assert.equal(calls, 1);
  assert.equal(supabase.debits.length, 1);
  assert.equal(supabase.debits[0].pointsCost, 8);
  assert.equal(supabase.uploads.length, 1);
  assert.match(result.resultPath, new RegExp(`^ai-generated/${USER_ID}/${GENERATION_ID}/result\\.png$`));
  const ledger = supabase.generations.get(GENERATION_ID);
  assert.equal(ledger.status, 'succeeded');
  assert.equal(ledger.result_path, result.resultPath);
  assert.equal(JSON.stringify(ledger).includes('generated-image-bytes'), false);
});

for (const type of ['single_try_on', 'outfit_preview']) {
  test(`${type} passes verified member identity when reading newly uploaded closet media`, async () => {
    const supabase = createSupabaseFake();
    const item = {
      id: ITEM_ID, owner_id: PROFILE_ID, photo: null,
      photo_display_path: `closet/${USER_ID}/${ITEM_ID}/operation/display.webp`
    };
    supabase.findOwnedItems = async () => [item];
    let imageRead = false;
    supabase.clothingImage = async (receivedItem, identity) => {
      assert.equal(receivedItem, item);
      assert.deepEqual(identity, { userId: USER_ID });
      imageRead = true;
      return { buffer: Buffer.from('garment'), mimeType: 'image/jpeg' };
    };
    const provider = {
      async generateSingleGarmentTryOn() { return { buffer: Buffer.from('result'), mimeType: 'image/png' }; },
      async generateOutfitPreview() { return { buffer: Buffer.from('result'), mimeType: 'image/png' }; }
    };
    const service = new GenerationService({ config: config(), supabase, provider });
    await service.generateImage({
      user: { id: USER_ID }, profile: { id: PROFILE_ID }, type,
      body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
    });
    assert.equal(imageRead, true);
    assert.equal(supabase.generations.get(GENERATION_ID).status, 'succeeded');
  });
}

test('duplicate generation ID returns prior success without a second provider charge', async () => {
  const supabase = createSupabaseFake();
  let calls = 0;
  const provider = {
    async generateSingleGarmentTryOn() {
      calls += 1;
      return { buffer: Buffer.from('generated'), mimeType: 'image/png' };
    }
  };
  const service = new GenerationService({ config: config(), supabase, provider });
  const input = {
    user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'single_try_on',
    body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
  };
  const first = await service.generateImage(input);
  const second = await service.generateImage(input);
  assert.equal(calls, 1);
  assert.equal(supabase.debits.length, 1);
  assert.equal(second.resultPath, first.resultPath);
});

test('insufficient points blocks provider before image download and debit', async () => {
  const supabase = createSupabaseFake({ claimResult: { claimed: false, reason: 'INSUFFICIENT_POINTS', balance: 3, required: 8 } });
  let calls = 0;
  const provider = { async generateSingleGarmentTryOn() { calls += 1; } };
  const service = new GenerationService({ config: config(), supabase, provider });
  await assert.rejects(
    service.generateImage({
      user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'single_try_on',
      body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
    }),
    (error) => error.code === 'INSUFFICIENT_POINTS' && error.status === 402
  );
  assert.equal(calls, 0);
  assert.equal(supabase.debits.length, 0);
});

test('provider safety rejection is recorded and returned explicitly', async () => {
  const supabase = createSupabaseFake();
  const details = { safetyReason: 'AGE_RESTRICTED', supportCodes: ['58061214'] };
  const provider = { async generateOutfitPreview() { throw new ProviderError('SAFETY_REJECTION', 'blocked', details); } };
  const service = new GenerationService({ config: config(), supabase, provider });
  await assert.rejects(
    service.generateImage({
      user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'outfit_preview',
      body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
    }),
    (error) => error.code === 'SAFETY_REJECTION'
  );
  assert.equal(supabase.generations.get(GENERATION_ID).status, 'rejected');
  assert.equal(supabase.generations.get(GENERATION_ID).error_code, 'SAFETY_REJECTION');
  assert.deepEqual(supabase.generations.get(GENERATION_ID).result_metadata, { providerSafety: details });
});

test('deletes only a person photo resolved under the verified member identity', async () => {
  const supabase = createSupabaseFake();
  const calls = [];
  supabase.deletePersonPhoto = async (userId, photoId) => {
    calls.push({ userId, photoId });
    return { id: photoId, path: `person/${userId}/${photoId}.png` };
  };
  const service = new GenerationService({ config: config(), supabase, provider: {} });

  const result = await service.deletePersonPhoto({ id: USER_ID }, 'demo-full-body');

  assert.deepEqual(calls, [{ userId: USER_ID, photoId: 'demo-full-body' }]);
  assert.deepEqual(result, {
    id: 'demo-full-body',
    path: `person/${USER_ID}/demo-full-body.png`,
    deleted: true
  });
});

test('a clothing image preparation failure is recorded precisely before provider billing', async () => {
  const supabase = createSupabaseFake();
  let providerCalls = 0;
  supabase.clothingImage = async () => {
    throw new GatewayError('CLOTHING_IMAGE_INVALID', 422, 'bad WebP', {
      itemId: ITEM_ID,
      itemName: '條紋針織上衣'
    });
  };
  const provider = { async generateSingleGarmentTryOn() { providerCalls += 1; } };
  const service = new GenerationService({ config: config(), supabase, provider });

  await assert.rejects(
    service.generateImage({
      user: { id: USER_ID }, profile: { id: PROFILE_ID }, type: 'single_try_on',
      body: { generationId: GENERATION_ID, personPhotoPath: `person/${USER_ID}/photo.jpg`, clothingItemIds: [ITEM_ID] }
    }),
    (error) => error.code === 'CLOTHING_IMAGE_INVALID' && error.details.itemName === '條紋針織上衣'
  );

  assert.equal(providerCalls, 0);
  assert.equal(supabase.debits.length, 0);
  assert.equal(supabase.generations.get(GENERATION_ID).status, 'failed');
  assert.equal(supabase.generations.get(GENERATION_ID).error_code, 'CLOTHING_IMAGE_INVALID');
});
