import { ProviderError } from '../errors.js';

const STYLING_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['outfitTitle', 'reason', 'style', 'occasion', 'weatherNote', 'items'],
  properties: {
    outfitTitle: { type: 'STRING' },
    reason: { type: 'STRING' },
    style: { type: 'STRING' },
    occasion: { type: 'STRING' },
    weatherNote: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'OBJECT',
        required: ['clothingItemId', 'role', 'reason'],
        properties: {
          clothingItemId: { type: 'STRING' },
          role: { type: 'STRING' },
          reason: { type: 'STRING' }
        }
      }
    }
  }
};

const parseStructuredText = (payload) => {
  const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
  if (!text) throw new ProviderError('INVALID_PROVIDER_OUTPUT', 'Styling response did not contain JSON');
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('INVALID_PROVIDER_OUTPUT', 'Styling response JSON was invalid');
  }
};

const requiredString = (value) => typeof value === 'string' && value.trim().length > 0;

const validateRecommendation = (recommendation, ownedItems) => {
  const ownedById = new Map(ownedItems.map((item) => [item.id, item]));
  if (!recommendation || !requiredString(recommendation.outfitTitle)
    || !requiredString(recommendation.reason)
    || !requiredString(recommendation.style)
    || !requiredString(recommendation.occasion)
    || typeof recommendation.weatherNote !== 'string'
    || !Array.isArray(recommendation.items)
    || recommendation.items.length < 1
    || recommendation.items.length > 5) {
    throw new ProviderError('INVALID_PROVIDER_OUTPUT', 'Styling result did not match the required schema');
  }

  const seen = new Set();
  const items = recommendation.items.map((entry) => {
    if (!requiredString(entry?.clothingItemId)
      || !requiredString(entry?.role)
      || !requiredString(entry?.reason)
      || !ownedById.has(entry.clothingItemId)
      || seen.has(entry.clothingItemId)) {
      throw new ProviderError('INVALID_PROVIDER_OUTPUT', 'Styling result referenced an invalid or unowned item');
    }
    seen.add(entry.clothingItemId);
    const item = ownedById.get(entry.clothingItemId);
    return {
      clothingItemId: entry.clothingItemId,
      role: entry.role.trim(),
      reason: entry.reason.trim(),
      clothingItem: {
        id: item.id,
        name: item.name,
        name_zh: item.name_zh,
        category: item.category,
        primary_color: item.primary_color,
        photo: item.photo
      }
    };
  });

  return {
    outfitTitle: recommendation.outfitTitle.trim(),
    reason: recommendation.reason.trim(),
    style: recommendation.style.trim(),
    occasion: recommendation.occasion.trim(),
    weatherNote: recommendation.weatherNote.trim(),
    items
  };
};

export class GoogleStylingProvider {
  constructor({ vertexClient, model, location }) {
    this.vertexClient = vertexClient;
    this.model = model;
    this.location = location;
  }

  async recommendOutfit({ wardrobeItems, occasion, style, weather, userRequest, itemLimit }) {
    if (!Array.isArray(wardrobeItems) || wardrobeItems.length === 0) {
      throw new ProviderError('INVALID_PROVIDER_OUTPUT', 'A real wardrobe is required for styling');
    }

    const allowedItems = wardrobeItems.map((item) => ({
      clothingItemId: item.id,
      name: item.name_zh || item.name,
      category: item.category || '',
      primaryColor: item.primary_color || '',
      secondaryColor: item.secondary_color || '',
      style: item.style || '',
      season: item.season || ''
    }));

    const prompt = [
      'You are OOTIE Personal\'s fashion stylist.',
      'Return exactly one practical outfit using only clothingItemId values from ALLOWED_WARDROBE.',
      `Use between 1 and ${Math.max(1, Math.min(Number(itemLimit) || 3, 5))} unique items.`,
      'Never invent, transform, or copy an ID that is not in the list.',
      `Occasion: ${occasion || 'not specified'}`,
      `Desired style: ${style || 'not specified'}`,
      `Weather: ${weather || 'not provided'}`,
      `User request: ${userRequest || 'none'}`,
      `ALLOWED_WARDROBE: ${JSON.stringify(allowedItems)}`
    ].join('\n');

    const payload = await this.vertexClient.postModel({
      location: this.location,
      model: this.model,
      action: 'generateContent',
      body: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          candidateCount: 1,
          responseMimeType: 'application/json',
          responseSchema: STYLING_RESPONSE_SCHEMA
        }
      }
    });

    return validateRecommendation(parseStructuredText(payload), wardrobeItems);
  }
}
