import { ProviderError } from '../errors.js';

export class GoogleNanoBananaProvider {
  constructor({ vertexClient, model, location, outputSize = '1K' }) {
    this.vertexClient = vertexClient;
    this.model = model;
    this.location = location;
    this.outputSize = outputSize;
  }

  async generateOutfitPreview({ personImage, garmentImages, prompt }) {
    const parts = [
      {
        text: [
          'Create one realistic editorial outfit visualization of the person in the first image.',
          'Use the following garment reference images as the intended outfit. Preserve the person identity and avoid changing body proportions.',
          'This is a styling visualization, not a size or fit guarantee.',
          prompt ? `User direction: ${prompt}` : ''
        ].filter(Boolean).join('\n')
      },
      { inlineData: { mimeType: personImage.mimeType, data: personImage.buffer.toString('base64') } },
      ...garmentImages.map((image) => ({
        inlineData: { mimeType: image.mimeType, data: image.buffer.toString('base64') }
      }))
    ];

    const payload = await this.vertexClient.postModel({
      location: this.location,
      model: this.model,
      action: 'generateContent',
      body: {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          candidateCount: 1,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '3:4',
            imageSize: this.outputSize
          }
        },
        safetySettings: [{
          method: 'PROBABILITY',
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }]
      }
    });

    const imagePart = payload?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
    if (!imagePart) {
      const finishReason = payload?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        throw new ProviderError('SAFETY_REJECTION', 'Google safety filters rejected this request');
      }
      throw new ProviderError('INVALID_PROVIDER_OUTPUT', 'Outfit preview returned no image');
    }
    return {
      buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
      mimeType: imagePart.inlineData.mimeType || 'image/png'
    };
  }
}
