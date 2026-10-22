import { randomUUID } from 'node:crypto';
import { assert, GatewayError } from '../errors.js';
import { parseImageDataUrl, normalizeGarmentImageForAi } from '../image.js';
import { isUuid } from '../services/supabaseGateway.js';
import { parseProductHtml } from '../services/productImportService.js';
import { publicHttpUrl, safeDownload } from './safeDownload.js';
import { YOUCAM_FEATURES } from './youcamClient.js';

const validPath = (path, prefix) => typeof path === 'string' && path.startsWith(prefix)
  && !path.split('/').some((part) => !part || part === '..' || part === '.' || /[%\\?#]/.test(part));
const categories = new Set(['upper_body','lower_body','full_body','shoes','auto']);

export class CommerceService {
  constructor({ repository, storage, enabled = false, download = safeDownload }) {
    this.repository = repository; this.storage = storage; this.enabled = enabled; this.download = download;
  }
  async capabilities() {
    const budget = await this.repository.budget();
    const remaining = Math.max(0, (budget?.unit_limit || 0) - (budget?.allocated_units || 0));
    const active = !!budget?.expires_at && Date.parse(budget.expires_at) > Date.now();
    return { enabled: this.enabled && active && remaining >= 2, remainingUnits: active ? remaining : 0,
      costs: { try_on: 2, skin_tone: 20 }, expiresAt: budget?.expires_at || null, provider: 'youcam', automaticTopUp: false };
  }
  async preview(body) {
    const page = await this.download(publicHttpUrl(body?.url), { maxBytes: 2 * 1024 * 1024 });
    assert(page.mimeType === 'text/html', 'PRODUCT_CONTENT_UNSUPPORTED', 422, '此頁面無法讀取，請手動填寫商品。');
    return parseProductHtml(page.buffer.toString('utf8'), page.url);
  }
  async createProduct(user, body) {
    const title = String(body?.title || '').trim();
    assert(title.length > 0 && title.length <= 160, 'INVALID_TITLE', 400, '請填寫 160 字以內的商品名稱。');
    assert(categories.has(body?.category), 'INVALID_CATEGORY', 400, '請選擇商品分類。');
    const sourceUrl = publicHttpUrl(body?.sourceUrl, { optional: true });
    assert(/^#[\da-f]{6}$/i.test(body?.color || ''), 'INVALID_COLOR', 400, '請選擇商品主要顏色。');
    let image;
    if (body?.imageData) image = parseImageDataUrl(body.imageData);
    else {
      const remote = await this.download(publicHttpUrl(body?.imageUrl));
      image = await normalizeGarmentImageForAi(remote.buffer, remote.mimeType);
    }
    image = await normalizeGarmentImageForAi(image.buffer, image.mimeType);
    const id = randomUUID();
    const imagePath = `shop/${user.id}/${id}.jpg`;
    await this.storage.uploadPrivate(imagePath, image);
    return this.repository.createProduct({ id, user_id: user.id, title, source_url: sourceUrl, image_path: imagePath, category: body.category, color: body.color });
  }
  async enqueue(user, body) {
    assert(this.enabled, 'YOUCAM_DISABLED', 503, '試穿服務尚未開啟。');
    assert(body?.consent === true, 'PHOTO_CONSENT_REQUIRED', 400, '請確認同意將選用照片交由 YouCam 處理。');
    assert(isUuid(body?.batchId), 'INVALID_BATCH', 400, '缺少有效的提交編號。');
    assert(Object.hasOwn(YOUCAM_FEATURES, body?.kind || ''), 'INVALID_JOB_KIND', 400, '請選擇試穿或配色分析。');
    assert(validPath(body?.personPath, `person/${user.id}/`), 'PERSON_IMAGE_NOT_OWNED', 403, '請選擇自己的私人照片。');
    const ids = body.productIds || [];
    assert(Array.isArray(ids) && ids.every(isUuid) && new Set(ids).size === ids.length
      && (body.kind === 'try_on' ? ids.length >= 1 && ids.length <= 3 : ids.length === 0), 'INVALID_BATCH', 400, '每批請選擇 1–3 件不同商品。');
    // Validate existence before reserving any credits. Ownership is checked again in SQL.
    await this.storage.downloadPrivate(body.personPath);
    return this.repository.rpc('enqueue_ootie_youcam', { p_batch_id: body.batchId, p_user_id: user.id, p_person_path: body.personPath, p_product_ids: ids, p_kind: body.kind });
  }
  async privateImage(user, path) {
    assert(validPath(path, `shop/${user.id}/`), 'PRIVATE_IMAGE_NOT_OWNED', 403, '無法讀取其他人的商品圖片。');
    return this.storage.downloadPrivate(path);
  }
  async updateProduct(user, id, body) {
    assert(isUuid(id), 'INVALID_PRODUCT', 400);
    assert(['wishlist','kept','dismissed','purchased'].includes(body?.state), 'INVALID_PRODUCT_STATE', 400);
    const product = await this.repository.updateProduct(id, user.id, { state: body.state });
    assert(product, 'PRODUCT_NOT_FOUND', 404, '找不到商品。');
    return product;
  }
  async cancel(user, id) {
    assert(isUuid(id), 'INVALID_JOB', 400);
    const cancelled = await this.repository.rpc('cancel_ootie_youcam_job', { p_id: id, p_user_id: user.id });
    assert(cancelled, 'JOB_ALREADY_STARTED', 409, '工作已開始，請等待結果。');
    return { cancelled };
  }
  async publish(user, body) {
    assert(isUuid(body?.jobId) && body?.consent === true, 'SHARE_CONSENT_REQUIRED', 400, '請確認公開分享這張試穿結果。');
    const job = await this.repository.job(body.jobId, user.id);
    assert(job?.status === 'succeeded' && job.kind === 'try_on' && job.result_path, 'RESULT_NOT_READY', 409, '試穿完成後才能分享。');
    const existing = await this.repository.post(job.id);
    if (existing) return existing;
    const product = await this.repository.product(job.product_id, user.id);
    assert(product, 'PRODUCT_NOT_FOUND', 404);
    const caption = String(body.caption || '').trim();
    assert(caption.length <= 800, 'CAPTION_TOO_LONG', 400, '分享文字請控制在 800 字內。');
    const image = await this.storage.downloadPrivate(job.result_path);
    const path = `${user.id}/${job.id}.jpg`;
    await this.storage.serviceRequest(`/storage/v1/object/ootie-shop-shares/${path}`, {
      method: 'POST', headers: { 'Content-Type': image.mimeType, 'x-upsert': 'true' }, body: image.buffer
    });
    return this.repository.publish({ id: job.id, job_id: job.id, user_id: user.id, title: product.title, caption,
      source_url: product.source_url, image_url: `${this.storage.url}/storage/v1/object/public/ootie-shop-shares/${path}` });
  }
  async recordEvent(user, body) {
    assert(isUuid(body?.id) && ['purchase_click','share_link'].includes(body?.type), 'INVALID_EVENT', 400);
    assert(Boolean(body.productId) !== Boolean(body.postId), 'INVALID_EVENT', 400);
    let target;
    if (body.productId) { assert(isUuid(body.productId), 'INVALID_PRODUCT', 400); target = await this.repository.product(body.productId, user.id); }
    else { assert(isUuid(body.postId), 'INVALID_POST', 400); target = await this.repository.post(body.postId); }
    assert(target, 'PRODUCT_NOT_FOUND', 404);
    await this.repository.event({ id: body.id, user_id: user.id, product_id: body.productId || null, post_id: body.postId || null, event_type: body.type });
    return { recorded: true };
  }
  async metrics(user) {
    const [jobs, events, products] = await Promise.all([this.repository.listJobs(user.id), this.repository.events(user.id), this.repository.listProducts(user.id)]);
    return { products: products.length, completedTryOns: jobs.filter((j) => j.kind === 'try_on' && j.status === 'succeeded').length,
      purchaseClicks: events.filter((e) => e.event_type === 'purchase_click').length,
      shareActions: events.filter((e) => e.event_type === 'share_link').length,
      scope: 'Your recent 200 products/jobs and 1000 actions; clicks are not confirmed purchases.' };
  }
}
