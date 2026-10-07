import { ProviderError } from '../errors.js';
import { googleSafetyRejection, isGoogleSafetyRejection } from './googleSafety.js';

const endpointHost = (location) => location === 'global'
  ? 'aiplatform.googleapis.com'
  : `${location}-aiplatform.googleapis.com`;

const providerErrorFromResponse = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const providerMessage = payload?.error?.message || `Google provider returned HTTP ${response.status}`;
  if (response.status === 429) return new ProviderError('PROVIDER_QUOTA', 'Google provider quota is unavailable');
  if ([404, 503].includes(response.status)) return new ProviderError('PROVIDER_UNAVAILABLE', 'Google provider is unavailable');
  if (isGoogleSafetyRejection(providerMessage)) {
    return googleSafetyRejection(providerMessage);
  }
  return new ProviderError('PROVIDER_ERROR', 'Google provider request failed');
};

export class GoogleVertexClient {
  constructor({ projectId, tokenProvider, fetchImpl = fetch, timeoutMs = 120_000 }) {
    this.projectId = projectId;
    this.tokenProvider = tokenProvider;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  modelUrl(location, model, action) {
    return `https://${endpointHost(location)}/v1/projects/${encodeURIComponent(this.projectId)}`
      + `/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:${action}`;
  }

  async postModel({ location, model, action, body }) {
    const token = await this.tokenProvider.getToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(this.modelUrl(location, model, action), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ProviderError('PROVIDER_UNAVAILABLE', 'Google provider request timed out');
      }
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Google provider could not be reached');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw await providerErrorFromResponse(response);
    const payload = await response.json();
    const blockReason = payload?.promptFeedback?.blockReason;
    if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') {
      throw googleSafetyRejection(blockReason);
    }
    return payload;
  }
}
