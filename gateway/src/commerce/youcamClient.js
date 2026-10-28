import { GatewayError } from '../errors.js';
import { safeDownload } from './safeDownload.js';
import { normalizeGarmentImageForAi } from '../image.js';

const API_ORIGIN = 'https://yce-api-01.makeupar.com';
export const YOUCAM_FEATURES = Object.freeze({ try_on: { endpoint: 'cloth-v3', units: 2 }, skin_tone: { endpoint: 'skin-tone-analysis', units: 20 }, garment_cleanup: { endpoint: 'image-to-image/youcam', units: 1 } });

export class YouCamClient {
  constructor({ apiKey, freeCreditExpiry = 0, fetchImpl = fetch, download = safeDownload, now = () => Date.now() }) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.download = download;
    this.freeCreditExpiry = freeCreditExpiry;
    this.now = now;
    this.balanceCache = null;
    this.balanceCacheAt = 0;
  }

  async request(path, body, version = 'v2.0') {
    if (!this.apiKey) throw new GatewayError('YOUCAM_NOT_CONFIGURED', 503, '試穿服務尚未設定。');
    let response;
    try {
      response = await this.fetch(`${API_ORIGIN}/s2s/${version}/${path}`, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${this.apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    } catch {
      throw new GatewayError('YOUCAM_CONNECTION_UNCERTAIN', 503, '服務回應未確認，系統不會自動重送產圖。');
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== 200) {
      throw new GatewayError('YOUCAM_REQUEST_FAILED', 502, '試穿服務未完成這次請求。', { httpStatus: response.status });
    }
    return payload.data ?? payload.result ?? payload.results;
  }

  async freeBalance() {
    if (!Number.isFinite(this.freeCreditExpiry) || this.freeCreditExpiry <= this.now()) {
      throw new GatewayError('YOUCAM_FREE_CREDITS_UNAVAILABLE', 503, '已確認的免費額度未設定或已到期。');
    }
    const credits = await this.request('client/credit', undefined, 'v1.0');
    if (!Array.isArray(credits)) throw new Error('Invalid credit response');
    // Only the bonus batch whose expiry was verified in the account console.
    // Ignore any other balance, including future paid purchases.
    return credits.filter((credit) => credit.type === 'ApiPaygToken' && credit.expiry === this.freeCreditExpiry)
      .reduce((total, credit) => total + (Number.isFinite(credit.amount_dec) && credit.amount_dec > 0 ? credit.amount_dec : 0), 0);
  }

  async balanceSnapshot(maxAgeMs = 30000) {
    if (this.balanceCache !== null && this.now() - this.balanceCacheAt < maxAgeMs) return this.balanceCache;
    const balance = await this.freeBalance();
    this.balanceCache = balance;
    this.balanceCacheAt = this.now();
    return balance;
  }

  async verifyCost(kind) {
    const feature = YOUCAM_FEATURES[kind];
    let token;
    const seen = new Set();
    for (let page = 0; page < 20; page++) {
      const result = await this.request('credit/feature-cost?page_size=20' + (token ? `&starting_token=${encodeURIComponent(token)}` : ''));
      if (!Array.isArray(result?.skus)) throw new Error('Invalid cost response');
      const matches = result.skus.filter((sku) => sku.run_task_url === `${API_ORIGIN}/s2s/v2.0/task/${feature.endpoint}`);
      if (matches.length) {
        if (matches.length !== 1 || matches[0].amount !== feature.units || matches[0].unit !== 'result_image' || matches[0].proc_unit !== 1) {
          throw new GatewayError('YOUCAM_COST_CHANGED', 503, '功能點數已變更，請先核對免費預算。');
        }
        return feature.units;
      }
      token = result.next_token;
      if (!token || seen.has(token)) break;
      seen.add(token);
    }
    throw new GatewayError('YOUCAM_COST_CHANGED', 503, '無法確認這項功能的點數。');
  }

  async preflight(kind, reviewerReserveUnits = 0) {
    try {
      const [balance, units] = await Promise.all([this.freeBalance(), this.verifyCost(kind)]);
      if (balance < units + Math.max(0, Number(reviewerReserveUnits) || 0)) throw new GatewayError('YOUCAM_FREE_CREDITS_UNAVAILABLE', 503, '保留評審額度後的可用點數不足，沒有送出產圖。');
      return { balance, units };
    } catch (error) {
      // Explicitly distinguish a failed GET preflight from an uncertain task POST.
      const safe = new GatewayError(error?.code === 'YOUCAM_COST_CHANGED' ? error.code : 'YOUCAM_FREE_CREDITS_UNAVAILABLE', 503, '免費額度核對未通過，沒有送出產圖。');
      safe.requestNotSent = true;
      throw safe;
    }
  }

  async upload(image, name) {
    const data = await this.request('file', { files: [{ content_type: image.mimeType, file_name: name, file_size: image.buffer.length }] });
    const file = data?.files?.[0];
    const target = file?.requests?.[0];
    const url = new URL(target?.url || 'https://invalid.invalid');
    // Signed upload destinations come from YouCam. Never forward the API key to storage.
    if (!file?.file_id || target?.method !== 'PUT' || url.protocol !== 'https:' || !url.hostname.endsWith('.amazonaws.com')) {
      throw new GatewayError('YOUCAM_INVALID_UPLOAD', 502, '無法取得安全的圖片上傳位置。');
    }
    const response = await this.fetch(url.href, { method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': image.mimeType }, body: image.buffer });
    if (!response.ok) throw new GatewayError('YOUCAM_UPLOAD_FAILED', 502, '圖片上傳未完成。');
    return file.file_id;
  }

  async submit(job, sourceId, referenceId) {
    const feature = YOUCAM_FEATURES[job.kind];
    if (!feature) throw new GatewayError('INVALID_JOB_KIND', 400);
    await this.preflight(job.kind, job.is_reviewer ? 0 : job.reviewer_reserve_units);
    const body = job.kind === 'garment_cleanup'
      ? {model:'youcam-image-v2',src_file_ids:[sourceId],size:'1024*1024',prompt_extend:false,
        prompt:'Create one clean product photograph of the exact single garment in the reference. Straighten and lay it flat, arrange sleeves naturally and smooth unnecessary creases. Remove the hanger, person, mannequin and background. Preserve color, fabric, buttons, seams, cut and proportions. Keep the entire garment visible centered on pure white. No extra objects, text or logos.',
        negative_prompt:'changed garment, changed color, altered details, cropped garment, person, mannequin, hanger, watermark'}
      : job.kind === 'skin_tone'
      ? { src_file_id: sourceId, face_angle_strictness_level: 'high' }
      : { src_file_id: sourceId, ref_file_id: referenceId, garment_category: job.garment_category, change_shoes: false };
    const data = await this.request(`task/${feature.endpoint}`, body);
    if (typeof data?.task_id !== 'string' || !data.task_id) throw new GatewayError('YOUCAM_CONNECTION_UNCERTAIN', 502, '未取得任務編號，請由管理者核對。');
    return data.task_id;
  }

  async poll(job) {
    return this.request(`task/${YOUCAM_FEATURES[job.kind].endpoint}/${encodeURIComponent(job.provider_task_id)}`);
  }

  async resultImage(data) {
    const url = data?.results?.url;
    if (typeof url !== 'string') throw new GatewayError('YOUCAM_INVALID_RESULT', 502, '試穿結果缺少圖片。');
    const image = await this.download(url);
    return normalizeGarmentImageForAi(image.buffer, image.mimeType);
  }
}
