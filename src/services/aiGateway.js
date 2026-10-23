import {privateMediaQueue} from './mediaQueue';
const DEFAULT_TIMEOUT_MS = 125_000;

export class AiGatewayError extends Error {
  constructor(code, message = code, status = 0, details = undefined) {
    super(message);
    this.name = 'AiGatewayError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const AI_ERROR_MESSAGE = Object.freeze({
  AUTH_REQUIRED: '請先登入 OOTIE 會員帳號。',
  MEMBER_REQUIRED: 'AI 圖像功能僅提供正式會員使用。',
  PROFILE_NOT_READY: '會員資料尚未完成，請稍後再試。',
  EMPTY_WARDROBE: '請先在「我的衣櫥」加入衣物。',
  IMAGE_GENERATION_DISABLED: 'AI 圖像功能目前暫停。',
  QUOTA_EXCEEDED: '今日 AI 圖像生成額度已用完，請明天再試。',
  INSUFFICIENT_POINTS: 'OOTIE 點數不足，請前往「方案與點數」查看可用點數與方案。',
  PROVIDER_UNAVAILABLE: 'Google Cloud AI 目前無法使用，請稍後由你手動重試。',
  PROVIDER_QUOTA: 'Google Cloud AI 額度目前不可用，請稍後再試。',
  SAFETY_REJECTION: 'Google 擋下了這次生成，尚未提供具體原因。請使用本人的成人單人照，讓臉部與身體清楚入鏡，並檢查衣物照片；照片已上傳成功，這次沒有生成結果。',
  ITEM_NOT_OWNED: '選取的衣物不存在於你的私人衣櫥。',
  INVALID_ITEM_IDS: '衣櫥資料剛完成同步，請重新選擇要試穿的衣物。',
  SINGLE_ITEM_REQUIRED: '單件虛擬試穿一次只能選擇一件衣物。',
  CLOTHING_IMAGE_REQUIRED: '選取的衣物缺少可用的商品照片。',
  CLOTHING_IMAGE_INVALID: '所選衣物的圖片目前無法用於 AI 生成，請更換該單品照片後再試。',
  CLOTHING_IMAGE_SOURCE_UNSUPPORTED: '這件衣物的照片來源不符合私人 AI 處理規則，請重新上傳衣物照片。',
  PERSON_IMAGE_NOT_OWNED: '請重新選擇你的私人人物照片。',
  PERSON_IMAGE_NOT_FOUND: '這張人物照已不存在，請重新選擇。',
  INVALID_IMAGE: '圖片格式無法辨識，請使用 JPEG 或 PNG。',
  INVALID_IMAGE_MIME: '圖片內容與檔案格式不符，請改用 JPEG 或 PNG。',
  IMAGE_TOO_LARGE: '處理後圖片仍超過 7 MB，請換一張照片。',
  IMAGE_RESOLUTION_TOO_SMALL: '圖片解析度太小，請使用至少 256 × 256 的照片。',
  IMAGE_RESOLUTION_TOO_LARGE: '圖片解析度過高，請重新選擇或壓縮照片。',
  DUPLICATE_IN_PROGRESS: '這次生成正在進行中，請不要重複送出。',
  INVALID_PROVIDER_OUTPUT: 'AI 回傳資料未通過 OOTIE 驗證，未採用這次結果。',
  NETWORK_TIMEOUT: '等待 AI 回應逾時；系統不會自動重送，以避免重複扣費。',
  NETWORK_ERROR: '無法連線到 OOTIE AI Gateway，請檢查網路後手動重試。'
});

export const getAiErrorMessage = (error) => {
  if (error?.code === 'SAFETY_REJECTION') {
    const reason = error?.details?.safetyReason;
    if (reason === 'AGE_RESTRICTED') return 'Google 將輸入或生成結果判為不符合成人限制，因此擋下這次生成。若照片中的人物是成人，請改用本人臉部清楚、光線均勻的照片；這次沒有生成結果。';
    if (reason === 'PUBLIC_FIGURE_RESTRICTED') return 'Google 將輸入或生成結果判為受限制的公眾人物影像，因此擋下這次生成。請使用本人的清楚照片；這次沒有生成結果。';
    if (reason === 'PERSON_RESTRICTED') return 'Google 的人物或臉部生成檢查未通過，因此擋下這次生成。請使用本人的成人單人照，讓臉部與身體清楚入鏡；這次沒有生成結果。';
    if (reason === 'CONTENT_FILTERED') return 'Google 的內容安全檢查擋下了這次生成，可能涉及人物照、衣物照或生成結果。請檢查選用的照片與文字需求；這次沒有生成結果。';
  }
  if (error?.code === 'CLOTHING_IMAGE_INVALID' && error?.details?.itemName) {
    return `「${error.details.itemName}」的圖片目前無法用於 AI 生成，請更換這件單品的照片後再試。`;
  }
  return AI_ERROR_MESSAGE[error?.code]
    || error?.message
    || 'AI 服務發生問題，請稍後手動重試。';
};

export const createGenerationId = () => {
  if (!globalThis.crypto?.randomUUID) throw new AiGatewayError('BROWSER_UNSUPPORTED', 'Browser UUID support is required');
  return globalThis.crypto.randomUUID();
};

export function createAiGatewayClient({
  baseUrl = import.meta.env.VITE_OOTIE_AI_GATEWAY_URL,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/$/, '');

  const request = async (path, { accessToken, method = 'GET', body } = {}) => {
    if (!normalizedBaseUrl) {
      throw new AiGatewayError('GATEWAY_NOT_CONFIGURED', 'OOTIE AI Gateway 尚未設定。');
    }
    if (!accessToken) throw new AiGatewayError('AUTH_REQUIRED', AI_ERROR_MESSAGE.AUTH_REQUIRED, 401);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new AiGatewayError('NETWORK_TIMEOUT', AI_ERROR_MESSAGE.NETWORK_TIMEOUT);
      }
      throw new AiGatewayError('NETWORK_ERROR', AI_ERROR_MESSAGE.NETWORK_ERROR);
    } finally {
      clearTimeout(timeout);
    }

    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const providerError = payload?.error || {};
      throw new AiGatewayError(
        providerError.code || 'GATEWAY_ERROR',
        providerError.message || `Gateway returned HTTP ${response.status}`,
        response.status,
        providerError.details
      );
    }
    return payload;
  };

  const performLoadImage = async (accessToken, route) => {
    if (!normalizedBaseUrl) {
      throw new AiGatewayError('GATEWAY_NOT_CONFIGURED', 'OOTIE AI Gateway 尚未設定。');
    }
    if (!accessToken) throw new AiGatewayError('AUTH_REQUIRED', AI_ERROR_MESSAGE.AUTH_REQUIRED, 401);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(
        `${normalizedBaseUrl}${route}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal }
      );
    } catch (error) {
      if (error?.name === 'AbortError') throw new AiGatewayError('NETWORK_TIMEOUT', AI_ERROR_MESSAGE.NETWORK_TIMEOUT);
      throw new AiGatewayError('NETWORK_ERROR', AI_ERROR_MESSAGE.NETWORK_ERROR);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      throw new AiGatewayError(
        payload?.error?.code || 'PRIVATE_IMAGE_UNAVAILABLE',
        payload?.error?.message || 'Private image could not be loaded',
        response.status
      );
    }
    return URL.createObjectURL(await response.blob());
  };

  const loadImage=(token,route)=>privateMediaQueue.run(()=>performLoadImage(token,route));
  return Object.freeze({
    healthCheck: (accessToken) => request('/v1/capabilities', { accessToken }),
    recommendOutfit: (accessToken, input) => request('/v1/recommendations', {
      accessToken,
      method: 'POST',
      body: input
    }),
    uploadPersonPhoto: (accessToken, input) => request('/v1/person-photos', {
      accessToken,
      method: 'POST',
      body: input
    }),
    listPersonPhotos: (accessToken) => request('/v1/person-photos', { accessToken }),
    deletePersonPhoto: (accessToken, photoId) => request(`/v1/person-photos/${encodeURIComponent(photoId)}`, {
      accessToken,
      method: 'DELETE'
    }),
    loadPrivateImage: (token, path) => loadImage(token, `/v1/private-images/${encodeURIComponent(path)}`),
    loadSharedClothingImage: (token, id) => loadImage(token, `/v1/shared-clothing/${encodeURIComponent(id)}/image`),
    generateSingleGarmentTryOn: (accessToken, input) => request('/v1/generations/single-try-on', {
      accessToken,
      method: 'POST',
      body: input
    }),
    generateOutfitPreview: (accessToken, input) => request('/v1/generations/outfit-preview', {
      accessToken,
      method: 'POST',
      body: input
    }),
    listGenerations: (accessToken) => request('/v1/generations', { accessToken }),
    saveGeneration: (accessToken, generationId) => request(`/v1/generations/${encodeURIComponent(generationId)}/save`, {
      accessToken,
      method: 'POST'
    })
  });
}

export const aiGateway = createAiGatewayClient();
