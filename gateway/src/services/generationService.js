import { GatewayError, ProviderError, assert } from '../errors.js';
import { extensionForMime, parseImageDataUrl } from '../image.js';
import { isUuid } from './supabaseGateway.js';

const IMAGE_TYPES = new Set(['single_try_on', 'outfit_preview']);
const QUOTA_EXEMPT_DAILY_LIMIT = 2_147_483_647;

const mapStatusToDuplicateError = (status) => {
  if (['pending', 'processing'].includes(status)) {
    return new GatewayError('DUPLICATE_IN_PROGRESS', 409, 'This generation request is already running');
  }
  return new GatewayError('DUPLICATE_REQUEST', 409, 'This generation ID has already been used');
};

export class GenerationService {
  constructor({ config, supabase, provider, now = () => new Date() }) {
    this.config = config;
    this.supabase = supabase;
    this.provider = provider;
    this.now = now;
  }

  modelForType(type) {
    if (type === 'styling') return this.config.google.stylingModel;
    if (type === 'single_try_on') return this.config.google.vtoModel;
    if (type === 'outfit_preview') return this.config.google.imageModel;
    throw new GatewayError('INVALID_GENERATION_TYPE', 400, 'Unknown generation type');
  }

  estimatedCostForType(type) {
    if (type === 'single_try_on') return this.config.cost.estimatedVtoUsd;
    if (type === 'outfit_preview') return this.config.cost.estimatedPreviewUsd;
    return null;
  }

  pointsCostForType(type) {
    if (type === 'single_try_on') return this.config.cost.vtoPoints;
    if (type === 'outfit_preview') return this.config.cost.previewPoints;
    return 0;
  }

  isQuotaExempt(userId) {
    return this.config.cost.quotaExemptUserIds?.includes(userId) === true;
  }

  async claim({ generationId, userId, type, sourceItemIds }) {
    assert(isUuid(generationId), 'INVALID_GENERATION_ID', 400, 'generationId must be a UUID');
    const claim = await this.supabase.claimGeneration({
      id: generationId,
      userId,
      type,
      model: this.modelForType(type),
      sourceItemIds,
      dailyLimit: this.isQuotaExempt(userId)
        ? QUOTA_EXEMPT_DAILY_LIMIT
        : this.config.cost.maxImagesPerUserPerDay,
      quotaTimezone: this.config.cost.quotaTimezone,
      pointsCost: this.pointsCostForType(type)
    });
    if (claim?.claimed) return claim;
    if (claim?.reason === 'QUOTA_EXCEEDED') {
      throw new GatewayError('QUOTA_EXCEEDED', 429, 'Daily AI image quota reached', {
        used: claim.quotaUsed,
        limit: claim.quotaLimit
      });
    }
    if (claim?.reason === 'DUPLICATE') {
      const existing = await this.supabase.getGeneration(generationId, userId);
      if (type === 'styling' && existing?.status === 'succeeded' && existing.result_metadata?.recommendation) {
        return { duplicateResult: existing.result_metadata.recommendation };
      }
      if (existing?.status === 'succeeded' && existing.result_path) {
        return {
          duplicateResult: {
            generationId: existing.id,
            generationType: existing.generation_type,
            resultPath: existing.result_path,
            savedAt: existing.saved_at
          }
        };
      }
      throw mapStatusToDuplicateError(claim.status);
    }
    if (claim?.reason === 'INSUFFICIENT_POINTS') {
      throw new GatewayError('INSUFFICIENT_POINTS', 402, 'Not enough OOTIE demo points', {
        balance: claim.balance,
        required: claim.required
      });
    }
    throw new GatewayError('GENERATION_CLAIM_FAILED', 409, 'Generation could not be claimed');
  }

  async recommend({ user, profile, body }) {
    const generationId = body?.generationId;
    const wardrobeItems = await this.supabase.listOwnedItems(profile.id);
    if (!wardrobeItems.length) throw new GatewayError('EMPTY_WARDROBE', 422, 'Add clothing to your wardrobe first');

    const claim = await this.claim({ generationId, userId: user.id, type: 'styling', sourceItemIds: [] });
    if (claim.duplicateResult) return claim.duplicateResult;
    await this.supabase.updateGeneration(generationId, user.id, { status: 'processing' });

    try {
      const recommendation = await this.provider.recommendOutfit({
        wardrobeItems,
        occasion: String(body?.occasion || '').slice(0, 80),
        style: String(body?.style || '').slice(0, 80),
        weather: String(body?.weather || '').slice(0, 160),
        userRequest: String(body?.userRequest || '').slice(0, 600),
        itemLimit: Math.max(1, Math.min(Number(body?.itemLimit) || 3, 5))
      });
      const sourceItemIds = recommendation.items.map((item) => item.clothingItemId);
      await this.supabase.updateGeneration(generationId, user.id, {
        status: 'succeeded',
        source_item_ids: sourceItemIds,
        result_metadata: { recommendation },
        completed_at: this.now().toISOString(),
        error_code: null
      });
      return { ...recommendation, generationId };
    } catch (error) {
      await this.failGeneration(generationId, user.id, error);
      throw error;
    }
  }

  async generateImage({ user, profile, body, type }) {
    if (!this.config.cost.imageGenerationEnabled) {
      throw new GatewayError('IMAGE_GENERATION_DISABLED', 503, 'AI image generation is currently paused');
    }

    const generationId = body?.generationId;
    const itemIds = Array.isArray(body?.clothingItemIds) ? [...new Set(body.clothingItemIds)] : [];
    if (type === 'single_try_on') {
      assert(itemIds.length === 1, 'SINGLE_ITEM_REQUIRED', 400, 'Virtual Try-On requires exactly one clothing item');
    } else {
      assert(itemIds.length >= 1 && itemIds.length <= 5, 'OUTFIT_ITEM_COUNT_INVALID', 400, 'Outfit preview accepts 1 to 5 clothing items');
    }
    assert(
      typeof body?.personPhotoPath === 'string'
        && body.personPhotoPath.startsWith(`person/${user.id}/`)
        && !body.personPhotoPath.includes('..'),
      'PERSON_IMAGE_NOT_OWNED',
      403,
      'Person image does not belong to the signed-in user'
    );

    const items = await this.supabase.findOwnedItems(profile.id, itemIds);
    const claim = await this.claim({ generationId, userId: user.id, type, sourceItemIds: itemIds });
    if (claim.duplicateResult) return claim.duplicateResult;

    await this.supabase.updateGeneration(generationId, user.id, {
      status: 'processing',
      person_image_path: body.personPhotoPath
    });

    try {
      const [personImage, ...garmentImages] = await Promise.all([
        this.supabase.downloadPrivate(body.personPhotoPath),
        ...items.map((item) => this.supabase.clothingImage(item, { userId: user.id }))
      ]);

      const pointDebit = await this.supabase.debitGenerationPoints({
        id: generationId,
        userId: user.id,
        pointsCost: this.pointsCostForType(type)
      });
      if (!pointDebit?.debited && pointDebit?.reason !== 'DUPLICATE') {
        throw new GatewayError('INSUFFICIENT_POINTS', 402, 'Not enough OOTIE demo points', {
          balance: pointDebit?.balance,
          required: pointDebit?.required
        });
      }

      const generated = type === 'single_try_on'
        ? await this.provider.generateSingleGarmentTryOn({ personImage, garmentImage: garmentImages[0] })
        : await this.provider.generateOutfitPreview({
          personImage,
          garmentImages,
          prompt: String(body?.prompt || '').slice(0, 600)
        });

      const extension = extensionForMime(generated.mimeType);
      const resultPath = `ai-generated/${user.id}/${generationId}/result.${extension}`;
      await this.supabase.uploadPrivate(resultPath, generated);
      const completed = await this.supabase.updateGeneration(generationId, user.id, {
        status: 'succeeded',
        result_path: resultPath,
        estimated_cost_usd: this.estimatedCostForType(type),
        completed_at: this.now().toISOString(),
        error_code: null
      });

      return {
        generationId,
        generationType: type,
        resultPath,
        sourceItemIds: itemIds,
        createdAt: completed.created_at,
        savedAt: completed.saved_at
      };
    } catch (error) {
      await this.failGeneration(generationId, user.id, error);
      throw error;
    }
  }

  async failGeneration(generationId, userId, error) {
    const errorCode = error instanceof GatewayError ? error.code : 'INTERNAL_ERROR';
    const rejected = error instanceof ProviderError && error.code === 'SAFETY_REJECTION';
    try {
      await this.supabase.updateGeneration(generationId, userId, {
        status: rejected ? 'rejected' : 'failed',
        completed_at: this.now().toISOString(),
        error_code: errorCode,
        ...(rejected && error.details?.safetyReason ? {
          result_metadata: { providerSafety: error.details }
        } : {})
      });
    } catch {
      // Preserve the original provider/storage failure for the caller.
    }
  }

  async uploadPersonPhoto({ user, body }) {
    assert(isUuid(body?.photoId), 'INVALID_PHOTO_ID', 400, 'photoId must be a UUID');
    const image = parseImageDataUrl(body?.imageData);
    const path = `person/${user.id}/${body.photoId}.${extensionForMime(image.mimeType)}`;
    await this.supabase.uploadPrivate(path, image);
    return {
      id: body.photoId,
      path,
      width: image.width,
      height: image.height
    };
  }

  async listPersonPhotos(user) {
    return this.supabase.listPersonPhotos(user.id);
  }

  async deletePersonPhoto(user, photoId) {
    assert(
      typeof photoId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(photoId),
      'INVALID_PHOTO_ID',
      400,
      'Photo ID is invalid'
    );
    const removed = await this.supabase.deletePersonPhoto(user.id, photoId);
    return { id: removed.id, path: removed.path, deleted: true };
  }

  async listGenerations(user) {
    const rows = await this.supabase.listGenerations(user.id);
    return rows.map((row) => ({
      generationId: row.id,
      generationType: row.generation_type,
      sourceItemIds: row.source_item_ids,
      resultPath: row.result_path,
      createdAt: row.created_at,
      savedAt: row.saved_at
    }));
  }

  async privateImage(user, storagePath) {
    assert(
      typeof storagePath === 'string'
        && !storagePath.includes('..')
        && (storagePath.startsWith(`person/${user.id}/`) || storagePath.startsWith(`ai-generated/${user.id}/`)),
      'PRIVATE_IMAGE_NOT_OWNED',
      403,
      'Private image does not belong to the signed-in user'
    );
    return this.supabase.downloadPrivate(storagePath);
  }

  async saveGeneration(user, generationId) {
    assert(isUuid(generationId), 'INVALID_GENERATION_ID', 400, 'generationId must be a UUID');
    const existing = await this.supabase.getGeneration(generationId, user.id);
    if (!existing || existing.status !== 'succeeded' || !existing.result_path) {
      throw new GatewayError('GENERATION_NOT_READY', 409, 'Only completed results can be saved');
    }
    const savedAt = this.now().toISOString();
    await this.supabase.updateGeneration(generationId, user.id, { saved_at: savedAt });
    return { generationId, savedAt };
  }

  capabilities(user) {
    const quotaExempt = this.isQuotaExempt(user?.id);
    return {
      imageGenerationEnabled: this.config.cost.imageGenerationEnabled,
      maxImagesPerUserPerDay: quotaExempt ? null : this.config.cost.maxImagesPerUserPerDay,
      quotaExempt,
      outputSize: this.config.google.imageOutputSize,
      pointsCost: {
        singleTryOn: this.config.cost.vtoPoints,
        outfitPreview: this.config.cost.previewPoints
      },
      provider: 'google_cloud'
    };
  }
}
