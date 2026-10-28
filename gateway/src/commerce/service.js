import { randomUUID, createHash } from 'node:crypto';
import { assert, GatewayError } from '../errors.js';
import { parseImageDataUrl, normalizeGarmentImageForAi } from '../image.js';
import { isUuid } from '../services/supabaseGateway.js';
import { parseProductHtml } from '../services/productImportService.js';
import { publicHttpUrl, safeDownload } from './safeDownload.js';
import { YOUCAM_FEATURES } from './youcamClient.js';

const validPath = (path, prefix) => typeof path === 'string' && path.startsWith(prefix)
  && !path.split('/').some((part) => !part || part === '..' || part === '.' || /[%\\?#]/.test(part));
const categories = new Set(['upper_body','lower_body','full_body','shoes','auto']);
const snapshotId = (userId, batchId, itemId) => {
  const bytes = createHash('sha256').update(`ootie-closet:${userId}:${batchId}:${itemId}`).digest().subarray(0,16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex=bytes.toString('hex'); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
const categoryNames = {
  upper_body: ['upper_body', 'top', 'tops', 'shirt', 'shirts', 't-shirt', 't-shirts', 'blouse', 'blouses', 'knitwear', 'sweater', 'sweaters', 'jacket', 'jackets', 'coat', 'coats', 'outerwear', '上衣', '上身', '襯衫', '針織', '外套'],
  lower_body: ['lower_body', 'bottom', 'bottoms', 'pants', 'trouser', 'trousers', 'jeans', 'skirt', 'skirts', 'short', 'shorts', '下身', '褲子', '長褲', '短褲', '裙子', '短裙', '長裙'],
  full_body: ['full_body', 'dress', 'dresses', 'jumpsuit', 'jumpsuits', '洋裝', '連身裙', '連身褲'],
  shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', '鞋', '鞋子', '鞋履']
};
const garmentCategory = value => {
  const name = String(value || '').trim().toLowerCase();
  return Object.entries(categoryNames).find(([, names]) => names.includes(name))?.[0] || null;
};

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
  async withPublicAuthors(posts) {
    const users=[...new Set(posts.map(post=>post.user_id).filter(isUuid))];
    const profiles=await this.repository.publicAuthors(users);
    return posts.map(post=>{
      const profile=profiles.find(p=>p.user_id===post.user_id);
      return {id:post.id,title:post.title,caption:post.caption,image_url:post.image_url,source_url:post.source_url,created_at:post.created_at,
        author:profile?{id:profile.id,username:profile.username,displayName:profile.display_name,initials:profile.initials,avatarUrl:profile.avatar_url}:null};
    });
  }
  async publicPosts() { return this.withPublicAuthors(await this.repository.posts()); }
  async publicPost(id) {
    const post=await this.repository.post(id);
    return post?(await this.withPublicAuthors([post]))[0]:null;
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
    assert(body?.consent === true, 'PHOTO_CONSENT_REQUIRED', 400, '請確認同意將選用照片交由 OOTIE 及其影像處理服務供應商處理。');
    assert(isUuid(body?.batchId), 'INVALID_BATCH', 400, '缺少有效的提交編號。');
    assert(Object.hasOwn(YOUCAM_FEATURES, body?.kind || ''), 'INVALID_JOB_KIND', 400, '請選擇試穿或配色分析。');
    assert(validPath(body?.personPath, `person/${user.id}/`), 'PERSON_IMAGE_NOT_OWNED', 403, '請選擇自己的私人照片。');
    const ids = body.productIds || [], clothingIds = body.clothingItemIds || [], savedItems = body.savedItems || [];
    assert(Array.isArray(ids) && Array.isArray(clothingIds) && Array.isArray(savedItems)
      && [...ids,...clothingIds].every(isUuid) && savedItems.every(entry => isUuid(entry?.postId) && isUuid(entry?.itemId))
      && new Set(ids).size === ids.length && new Set([...clothingIds,...savedItems.map(entry=>entry.itemId)]).size === clothingIds.length + savedItems.length
      && (body.kind === 'try_on' ? ids.length + clothingIds.length + savedItems.length >= 1 && ids.length + clothingIds.length + savedItems.length <= 3 : ids.length + clothingIds.length + savedItems.length === 0), 'INVALID_BATCH', 400, '每批請選擇 1–3 件不同商品。');
    // Validate existence before reserving any credits. Ownership is checked again in SQL.
    await this.storage.downloadPrivate(body.personPath);
    // Reject an invalid wishlist selection before making any wardrobe snapshots.
    for (const id of ids) {
      const product = await this.repository.product(id, user.id);
      assert(product && categories.has(product.category) && product.state !== 'tryon_only', 'INVALID_PRODUCT', 400, '請重新選擇想買清單中的商品。');
    }
    const snapshots=[];
    if (clothingIds.length || savedItems.length) {
      const profile = await this.storage.findProfileForUser(user.id);
      const items = clothingIds.length ? await this.storage.findOwnedItems(profile.id, clothingIds) : [];
      for (const entry of savedItems) {
        const [saved, post] = await Promise.all([this.repository.savedOutfit(profile.id,entry.postId),this.repository.outfit(entry.postId)]);
        assert(saved && Array.isArray(post?.item_ids) && post.item_ids.includes(entry.itemId), 'ITEM_NOT_SAVED', 403, '請選擇已收藏穿搭中的衣物。');
        items.push({ ...(await this.storage.accessibleSharedClothing(user,entry.itemId)), shared:true });
      }
      // Check the complete mixed selection before copying any private image or
      // creating a snapshot. Accessories and unknown categories cannot be sent
      // to the clothing model as an assumed upper-body garment.
      for (const item of items) {
        item.tryonCategory = garmentCategory(item.category);
        assert(item.tryonCategory, 'UNSUPPORTED_GARMENT_CATEGORY', 400, '目前試穿支援衣服與鞋履；請移除包包、配件或無法辨識的分類。');
      }
      for (const item of items) {
        const id=snapshotId(user.id,body.batchId,item.id);
        const existing=await this.repository.product(id,user.id);
        if (existing) { assert(existing.state==='tryon_only', 'INVALID_PRODUCT', 409); snapshots.push(id); continue; }
        const source=item.shared ? await this.storage.sharedClothingImage(user,item.id) : await this.storage.clothingImage(item,{userId:user.id});
        const image=await normalizeGarmentImageForAi(source.buffer,source.mimeType);
        const imagePath=`shop/${user.id}/${id}.jpg`;
        await this.storage.uploadPrivate(imagePath,image,{upsert:true});
        try { await this.repository.createProduct({id,user_id:user.id,title:String(item.name_zh || item.name || 'Wardrobe item').slice(0,160),source_url:'',image_path:imagePath,category:item.tryonCategory,color:'#c8bba9',state:'tryon_only'}); }
        catch (error) {
          const raced=await this.repository.product(id,user.id);
          if (!raced || raced.state !== 'tryon_only' || raced.image_path !== imagePath) throw error;
        }
        snapshots.push(id);
      }
    }
    return this.repository.rpc('enqueue_ootie_youcam', { p_batch_id: body.batchId, p_user_id: user.id, p_person_path: body.personPath, p_product_ids: [...ids,...snapshots], p_kind: body.kind });
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
  async deleteResult(user, id) {
    assert(isUuid(id), 'INVALID_JOB', 400);
    const job = await this.repository.job(id, user.id);
    assert(job, 'JOB_NOT_FOUND', 404, '找不到這筆試穿結果。');
    assert(job.kind === 'try_on' && job.status === 'succeeded', 'RESULT_NOT_READY', 409, '只能刪除已完成的試穿結果。');
    if (!job.result_path) return { deleted: true };
    const path = `ai-generated/${user.id}/${id}.jpg`;
    assert(job.result_path === path, 'PRIVATE_IMAGE_NOT_OWNED', 403, '無法刪除此照片。');
    // Delete the Storage object through the Storage API. A retry is safe if
    // the database update fails after the object has already been removed.
    await this.storage.serviceRequest(`/storage/v1/object/${encodeURIComponent(this.storage.bucket)}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] })
    });
    const updated = await this.repository.clearJobResult(id, user.id, path);
    if (!updated) {
      const current = await this.repository.job(id, user.id);
      assert(current && !current.result_path, 'RESULT_DELETE_NOT_CONFIRMED', 409, '結果刪除尚未確認，請再試一次。');
    }
    return { deleted: true };
  }
  async publish(user, body) {
    assert(isUuid(body?.jobId) && body?.consent === true, 'SHARE_CONSENT_REQUIRED', 400, '請確認公開分享這張試穿結果。');
    const job = await this.repository.job(body.jobId, user.id);
    assert(job?.status === 'succeeded' && job.kind === 'try_on' && job.result_path, 'RESULT_NOT_READY', 409, '試穿完成後才能分享。');
    const existing = await this.repository.post(job.id);
    if (existing) return (await this.withPublicAuthors([existing]))[0];
    const product = await this.repository.product(job.product_id, user.id);
    assert(product, 'PRODUCT_NOT_FOUND', 404);
    const caption = String(body.caption || '').trim();
    assert(caption.length <= 800, 'CAPTION_TOO_LONG', 400, '分享文字請控制在 800 字內。');
    const image = await this.storage.downloadPrivate(job.result_path);
    const path = `${user.id}/${job.id}.jpg`;
    await this.storage.serviceRequest(`/storage/v1/object/ootie-shop-shares/${path}`, {
      method: 'POST', headers: { 'Content-Type': image.mimeType, 'x-upsert': 'true' }, body: image.buffer
    });
    const published = await this.repository.publish({ id: job.id, job_id: job.id, user_id: user.id, title: product.title, caption,
      source_url: product.source_url, image_url: `${this.storage.url}/storage/v1/object/public/ootie-shop-shares/${path}` });
    return (await this.withPublicAuthors([published]))[0];
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
