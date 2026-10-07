import { GatewayError } from './errors.js';

const METADATA_TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

export class MetadataAccessTokenProvider {
  constructor({ fetchImpl = fetch, now = () => Date.now() } = {}) {
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.cached = null;
  }

  async getToken() {
    if (this.cached && this.cached.expiresAt - this.now() > 60_000) return this.cached.token;

    let response;
    try {
      response = await this.fetchImpl(METADATA_TOKEN_URL, {
        headers: { 'Metadata-Flavor': 'Google' }
      });
    } catch (error) {
      throw new GatewayError('GOOGLE_ADC_UNAVAILABLE', 503, 'Cloud Run service account token is unavailable');
    }

    if (!response.ok) {
      throw new GatewayError('GOOGLE_ADC_UNAVAILABLE', 503, 'Cloud Run service account token is unavailable');
    }

    const payload = await response.json();
    if (!payload?.access_token) {
      throw new GatewayError('GOOGLE_ADC_UNAVAILABLE', 503, 'Metadata token response is invalid');
    }
    this.cached = {
      token: payload.access_token,
      expiresAt: this.now() + Number(payload.expires_in || 300) * 1000
    };
    return this.cached.token;
  }
}
