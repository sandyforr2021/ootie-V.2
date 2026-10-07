import { ProviderError } from '../errors.js';
import { googleSafetyRejection } from './googleSafety.js';

export class GoogleVtoProvider {
  constructor({ vertexClient, model, location }) {
    this.vertexClient = vertexClient;
    this.model = model;
    this.location = location;
  }

  async generateSingleGarmentTryOn({ personImage, garmentImage }) {
    const payload = await this.vertexClient.postModel({
      location: this.location,
      model: this.model,
      action: 'predict',
      body: {
        instances: [{
          personImage: { image: { bytesBase64Encoded: personImage.buffer.toString('base64') } },
          productImages: [{ image: { bytesBase64Encoded: garmentImage.buffer.toString('base64') } }]
        }],
        parameters: {
          sampleCount: 1,
          addWatermark: true,
          safetySetting: 'block_medium_and_above',
          outputOptions: { mimeType: 'image/png' }
        }
      }
    });

    const prediction = payload?.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      const filtered = payload?.predictions?.find((entry) => entry?.raiFilteredReason);
      if (filtered) throw googleSafetyRejection(filtered.raiFilteredReason);
      throw new ProviderError('INVALID_PROVIDER_OUTPUT', 'Virtual Try-On returned no image');
    }
    return {
      buffer: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
      mimeType: prediction.mimeType || 'image/png'
    };
  }
}
