import { AiGatewayError } from './aiGateway';

const baseUrl = String(import.meta.env.VITE_OOTIE_AI_GATEWAY_URL || '').replace(/\/$/, '');

export async function previewExternalProduct(url, accessToken, fetchImpl = fetch) {
  if (!baseUrl) throw new AiGatewayError('GATEWAY_NOT_CONFIGURED', 'OOTIE Gateway 尚未設定。');
  if (!accessToken) throw new AiGatewayError('AUTH_REQUIRED', '請先登入會員帳號。', 401);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/v1/product-import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  } catch {
    throw new AiGatewayError('NETWORK_ERROR', '目前無法連線到商品解析服務。');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new AiGatewayError(payload?.error?.code || 'PRODUCT_FETCH_FAILED', payload?.error?.message || '無法讀取商品頁。', response.status);
  return payload;
}
