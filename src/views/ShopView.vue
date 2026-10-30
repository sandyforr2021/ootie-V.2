<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import {fetchOotdPostsByIds} from '@/services/supabase';
import {studioPollDelay} from '@/services/studioPolling';
import { orderedOutfit, supportsTryOn } from '../../shared/outfitSelection.js';
import { generationQuote } from '../../shared/generationAllowance.js';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import ExtensionGuide from '@/components/bookmarks/ExtensionGuide.vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useClosetStore } from '@/stores/closet';
import { useOotdStore } from '@/stores/ootd';
import { listSavedOutfits } from '@/services/socialMetrics';
import { getPublicItemsByIds } from '@/services/clothingRepository';
import { resolvePostTaggedItems } from '@/services/ootdTaggedItems';
import { aiGateway, createGenerationId } from '@/services/aiGateway';
import { preprocessPersonImage } from '@/services/imageUpload';
import { prepareClothingImage } from '@/services/clothingMedia';
import { removeClothingBackground } from '@/services/clothingCutout';
import { commerceClient, safeCommerceUrl, wardrobeMatches, personalPalette, categoryFamily } from '@/services/commerce';
import { locale as language, setLocale, normalizeLocale, t, tf, formatDate } from '@/i18n';

const auth = useAuthStore(); const app = useAppStore(); const closet = useClosetStore(); const ootd = useOotdStore();
const route = useRoute(); const router = useRouter();
const token = computed(() => auth.session?.access_token || '');
const isCommunity=computed(()=>route.name==='TryonCommunity');
const tab = ref(['album','community','activity','wardrobe','saved','links'].includes(route.query.tab) ? route.query.tab : (isCommunity.value?'community':'wishlist'));
const products = ref([]); const jobs = ref([]); const photos = ref([]); const posts = ref([]);
const images = ref({}); const selected = ref([]); const selectedClothing = ref([]); const selectedSaved = ref([]); const savedEntries = ref([]); const selectionSource = ref('wishlist'); const selectedPhoto = ref(''); const consent = ref(false);
const savedClothing = ref([]),savedPostRows=ref([]);
const capabilities = ref({ enabled:false, remainingUnits:0, costs:{ try_on:2, skin_tone:20 } });
const metrics = ref(null); const busy = ref(''); const loading = ref(false); const error = ref(''); const notice = ref('');
let initialStepResolved = false;
const form = ref({ title:'', sourceUrl:'', imageUrl:'', imageData:'', category:'upper_body', color:'#c8bba9' });
const productLimit = ref(12); const jobLimit = ref(12); const matchingProduct = ref(null); const showPassed = ref(false);
const shareJob = ref(null); const shareCaption = ref(''); const shareConsent = ref(false);
const purchasedProduct = ref(null);
const step = ref(2); const importMode = ref('link'); const workflowTitle = ref(null);
const extensionOpen = ref(false); const manualImport = ref(false);
const choosePhoto=ref(false);
const steps = computed(() => [t('挑選試穿'), t('選擇模特兒'), t('模擬試穿')]);
const chosenProducts = computed(() => products.value.filter(p => selected.value.includes(p.id)));
const chosenClothing = computed(() => app.items.filter(item => selectedClothing.value.includes(item.id) && item.owner_id === auth.profileId));
const canTryOnClothing = item => ['upper_body','lower_body','full_body','outer'].includes(categoryFamily(item.category));
const savedItems = computed(() => {
  const found = new Map();
  for (const entry of savedEntries.value.filter(item=>item.target_type==='OOTD')) {
    const post=savedPostRows.value.find(item=>String(item.id)===String(entry.target_id))||app.ootdPosts.find(item=>String(item.id)===String(entry.target_id));
    for (const item of resolvePostTaggedItems(post, savedClothing.value)) if (item.id && item.can_try_on && !item.removed && !found.has(item.id)) found.set(item.id,{...item,postId:post.id});
  }
  return [...found.values()];
});
const chosenSaved = computed(() => savedItems.value.filter(item=>selectedSaved.value.some(entry=>entry.itemId===item.id)));
const selectedOutfit = computed(()=>orderedOutfit([...chosenProducts.value,...chosenClothing.value,...chosenSaved.value]));
const selectionCount = computed(() => selected.value.length + selectedClothing.value.length + selectedSaved.value.length);
async function goStep(value) {
  step.value = value;
  await nextTick();
  workflowTitle.value?.focus({preventScroll:true});
}
const generationAllowance = computed(() => generationQuote(capabilities.value, selectionCount.value));
const allowanceError = reason => t({DAILY_FREE_LIMIT:'今日免費額度已用完，可使用點數繼續生成。',DAILY_GENERATION_LIMIT:'已達每日 2 次生成上限。',POINTS_UNAVAILABLE:'點數紀錄暫時無法載入。',INSUFFICIENT_POINTS:'平台點數不足。'}[reason] || '平台點數不足。');
const submitHint = computed(() => !selectionCount.value ? t('選擇至少一件商品，再繼續。') : !selectedOutfit.value.valid ? t('整套試穿請各選最多一件上衣、下身與外套。') : !generationAllowance.value.allowed ? allowanceError(generationAllowance.value.reason) : capabilities.value.remainingUnits < selectionCount.value * capabilities.value.costs.try_on ? t('額度不足，請減少本次試穿商品。') : (!selectedPhoto.value || !consent.value) ? t('選擇一張私人照片，並同意本次處理後即可送出。') : '');
const comparisonIds = ref([]); const pendingBatch = ref(null); const sharedPost = ref(null);
let pollTimer; let disposed = false; let sessionVersion = 0;
const identityReady = () => auth.isMember && !!token.value && auth.user?.id === auth.session?.user?.id && (!auth.profileIdentity?.authUserId || auth.profileIdentity.authUserId === auth.session?.user?.id);
const identitySnapshot = () => ({ version:sessionVersion, userId:auth.session?.user?.id, profileId:auth.profileId, accessToken:token.value });
const identityCurrent = (identity) => !disposed && identity.version === sessionVersion && identity.userId === auth.session?.user?.id && identity.profileId === auth.profileId;
const urls = new Map(); const loadingImages = new Set();
const categories = computed(() => [['upper_body',t('上衣','Tops')],['lower_body',t('下身','Bottoms')],['full_body',t('連身服飾','Full outfit')],['shoes',t('鞋子','Shoes')],['auto',t('自動辨識','Auto')]]);
const tabs = computed(() => [['wishlist',t('試穿模擬')],['album',t('私人相簿','Private album')]]);
const visibleProducts = computed(() => products.value.filter((p) => supportsTryOn(p) && (showPassed.value || p.state !== 'dismissed')).slice(0,productLimit.value));
const activeJobs = computed(() => jobs.value.filter((j) => ['queued','preparing','submitting','processing'].includes(j.status)));
const albumJobs = computed(() => jobs.value.filter((j) => (j.sequence_index || 1)===(j.sequence_total || 1) && ['try_on','garment_cleanup'].includes(j.kind) && !j.result_deleted_at && (j.status !== 'succeeded' || j.result_path)).slice(0,jobLimit.value));
const palette = computed(() => personalPalette(jobs.value.find((j) => j.kind === 'skin_tone' && j.status === 'succeeded')?.result_data));
const toneJobs = computed(() => jobs.value.filter((j) => j.kind === 'skin_tone').slice(0,3));
const comparisons = computed(() => jobs.value.filter((j) => comparisonIds.value.includes(j.id)));
const matches = computed(() => matchingProduct.value ? wardrobeMatches(matchingProduct.value, app.items, auth.profileId) : []);
const canSubmit = computed(() => generationAllowance.value.allowed && selectedOutfit.value.valid && capabilities.value.enabled && capabilities.value.remainingUnits >= selectionCount.value * capabilities.value.costs.try_on && selectionCount.value && selectedPhoto.value && consent.value && !busy.value && !pendingBatch.value);
const jobTitle = (job) => job.kind==='garment_cleanup' ? t('整理結果') : job.sequence_total>1 ? t('整套試穿') : products.value.find((p) => p.id === job.product_id)?.title || job.product?.title || t('試穿結果','Try-on result');
const stateLabel = (status) => ({ queued:t('等待中','Queued'), preparing:t('準備圖片','Preparing'), submitting:t('送出中','Submitting'), processing:t('試穿製作中','Processing'), succeeded:t('已完成','Ready'), failed:t('未完成','Failed'), needs_review:t('等待服務核對','Needs review'), cancelled:t('已取消','Cancelled') })[status] || status;
const reasonLabel = (reason) => ({ neutral:t('中性色，容易搭配','A versatile neutral'), tonal:t('相近色系，柔和協調','Similar hues, a soft pairing'), contrast:t('對比色，增加層次','Contrasting hues, more definition'), category:t('可互補的衣物類別','A complementary garment category') })[reason];
const api = (path, body, accessToken=token.value, options) => options ? commerceClient.request(path, accessToken, body, options) : commerceClient.request(path, accessToken, body);
const login = () => auth.openAuthModal('login', null, '/shop');

const pendingKey = (userId) => `ootie-shop-pending:${userId}`;
function readPending(userId) {
  if (!userId) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey(userId)) || 'null');
    if (!value || !/^[\da-f-]{36}$/i.test(value.id) || !value.selection?.personPath) return null;
    return value;
  } catch { return null; }
}
function persistPending(value) {
  pendingBatch.value = value;
  try {
    const userId = auth.session?.user?.id;
    if (userId && value) sessionStorage.setItem(pendingKey(userId), JSON.stringify(value));
  } catch { /* Recovery remains available for this page session if storage is restricted. */ }
}
function clearPending() {
  try { const userId = auth.session?.user?.id; if (userId) sessionStorage.removeItem(pendingKey(userId)); } catch { /* Ignore restricted storage. */ }
  pendingBatch.value = null;
}

const errorMessages = {
  AUTH_REQUIRED:['登入狀態已失效，請重新登入。','Your session has expired. Please sign in again.'],
  INSUFFICIENT_POINTS:['平台點數不足。','Not enough platform points.'],
  DAILY_FREE_LIMIT:['今日免費額度已用完，可使用點數繼續生成。','Your daily free images are used up. Use points to continue.'],
  DAILY_GENERATION_LIMIT:['已達每日 2 次生成上限。','Daily limit of 2 generations reached.'],
  FREE_BUDGET_EXHAUSTED:['免費額度不足，這次沒有送出新的產圖。','There are not enough available credits. No new image job was submitted.'],
  REVIEWER_RESERVE_PROTECTED:['這些點數已保留給評審使用。','These credits are reserved for the judges.'],
  USER_DAILY_LIMIT:['已達今日試穿上限，請明天再試。','You have reached today’s try-on limit. Try again tomorrow.'],
  USER_ACTIVE_LIMIT:['等待中的工作較多，完成或核對後再提交。','Too many jobs are waiting. Submit again after they finish or are reviewed.'],
  PERSON_IMAGE_IN_USE:['這張照片仍被工作使用，暫時不能刪除。','This photo is still used by a job and cannot be deleted yet.'],
  PERSON_IMAGE_DELETING:['照片正在刪除，請稍後重新整理再試。','This photo is being deleted. Refresh and try again shortly.'],
  JOB_STILL_ACTIVE:['工作尚未完成，完成後再刪除結果。','This job is still active. Delete the result after it finishes.'],
  POST_NOT_FOUND:['分享已撤回或不存在。','This post was retracted or no longer exists.'],
  YOUCAM_DISABLED:['試穿服務尚未開啟。','The try-on service is not available yet.'],
  PHOTO_CONSENT_REQUIRED:['請同意處理選用的照片。','Please consent to processing the selected photo.'],
  JOB_ALREADY_STARTED:['工作已開始，請等待結果。','This job has started. Wait for its result.'],
  INVALID_OUTFIT_LAYERS:['整套試穿請各選最多一件上衣、下身與外套。','Choose at most one top, one bottom and one outer layer for an outfit.'],
  INVALID_TITLE:['請填寫商品名稱。','Enter a product name.'],
  PRODUCT_URL_BLOCKED:['請使用有效的圖片或商品連結。','Use a valid product or image link.'],
  REMOTE_IMAGE_UNAVAILABLE:['目前無法讀取這個網站，請手動上傳商品圖片。','This site cannot be read right now. Upload the product image instead.']
};
function report(err) {
  // Pending-request recovery handles uncertain submissions without a global banner.
  if (err?.code === 'NETWORK_UNCERTAIN') { error.value=''; return; }
  const copy=errorMessages[err?.code] || ['暫時無法完成，請稍後再試。','Something went wrong. Please try again later.'];
  error.value=t(copy[0],copy[1]);
}
async function act(name, action) {
  if (busy.value || (name !== 'share' && !identityReady())) return;
  const identity = identitySnapshot();
  error.value=''; notice.value=''; busy.value=name;
  try { await action(identity); } catch(err) { if (identityCurrent(identity)) report(err); } finally { if (identityCurrent(identity)) busy.value=''; }
}
function selectTab(next) { tab.value=next; if(next==='wishlist') step.value=2; router.replace({ path:'/shop', query:{ tab:next, lang:language.value } }); }
function toggleProduct(id) {
  if(pendingBatch.value) return;
  if (selected.value.includes(id)) selected.value=selected.value.filter((value)=>value!==id);
  else if (selectionCount.value<3) selected.value.push(id);
  else notice.value=t('每批最多選擇 3 件商品。','Choose up to three products per batch.');
}
function toggleClothing(id) {
  if(pendingBatch.value) return;
  if (!canTryOnClothing(app.items.find(item => item.id === id) || {})) return;
  if (selectedClothing.value.includes(id)) selectedClothing.value=selectedClothing.value.filter(value=>value!==id);
  else if (selectedSaved.value.some(entry=>entry.itemId===id)) notice.value=t('這件衣物已從收藏穿搭選取。');
  else if (selectionCount.value<3) selectedClothing.value.push(id);
  else notice.value=t('每批最多選擇 3 件商品。');

}
function toggleSavedItem(item) {
  if(pendingBatch.value) return;
  if (!canTryOnClothing(item)) return;
  if (selectedSaved.value.some(entry=>entry.itemId===item.id)) selectedSaved.value=selectedSaved.value.filter(entry=>entry.itemId!==item.id);
  else if (selectedClothing.value.includes(item.id)) notice.value=t('這件衣物已從衣櫥選取。');
  else if (selectionCount.value<3) selectedSaved.value.push({postId:item.postId,itemId:item.id});
  else notice.value=t('每批最多選擇 3 件商品。');

}
async function hydrate(path) {
  if (!path || urls.has(path) || loadingImages.has(path) || !token.value) return;
  loadingImages.add(path); const version=sessionVersion;
  try {
    const url=await aiGateway.loadPrivateImage(token.value,path);
    if (disposed || version!==sessionVersion) { URL.revokeObjectURL(url); return; }
    urls.set(path,url); images.value={ ...images.value,[path]:url };
  } catch { /* Keep a labeled placeholder; a later refresh may restore the image. */ }
  finally { loadingImages.delete(path); }
}
async function hydrateVisible() {
  const paths=tab.value==='album'?albumJobs.value.map(j=>j.result_path):tab.value==='wishlist'?[
    ...(step.value===2?visibleProducts.value:chosenProducts.value).map(p=>p.image_path),
    ...(step.value===3?[selectedPhoto.value,...(choosePhoto.value?photos.value:photos.value.slice(0,8)).map(p=>p.path)]:[])
  ]:[];
  await Promise.all(paths.filter(Boolean).map(hydrate));
}
async function refreshJobs() {
  if (!identityReady()) return;
  const identity=identitySnapshot();
  const [jobData,caps]=await Promise.all([api('jobs',undefined,identity.accessToken),api('capabilities',undefined,identity.accessToken)]);
  if (!identityCurrent(identity)) return;
  jobs.value=jobData.jobs; capabilities.value=caps;
  if (pendingBatch.value) {
    const recovered=jobData.jobs.some((job)=>job.batch_id===pendingBatch.value.id);
    if (recovered) {
      clearPending(); tab.value='album';
      notice.value=t('已找到原提交的工作，已恢復進度。','Your original submission was found and its progress is restored.');
    }
  }
  await hydrateVisible();

}
async function refresh() {
  if (!identityReady()) return;
  loading.value=true; const identity=identitySnapshot();
  try {
    if (tab.value === 'activity') {
      const result = await api('metrics',undefined,identity.accessToken);
      if (identityCurrent(identity)) metrics.value = result;
      return;
    }
    const [productData,photoData]=await Promise.all([api('products',undefined,identity.accessToken),aiGateway.listPersonPhotos(identity.accessToken)]);
    if (!identityCurrent(identity)) return;
    products.value=productData.products; photos.value=photoData.photos;
    if (route.query.product && products.value.some(p => p.id === route.query.product)) selected.value = [String(route.query.product)];
    selectedPhoto.value=photos.value.some((p)=>p.path===selectedPhoto.value) ? selectedPhoto.value : photos.value[0]?.path || '';
    await refreshJobs();
    if (!identityCurrent(identity)) return;
    // The wardrobe store resolves private media through the existing ownership contract.
    await closet.loadRemoteItems(identity.profileId);
    if (!identityCurrent(identity)) return;
    try {
      const saved=await listSavedOutfits(identity.profileId);
      if (!identityCurrent(identity)) return;
      savedEntries.value = saved;
      const savedPostIds = new Set(saved.filter(entry => entry.target_type === 'OOTD').map(entry => String(entry.target_id)));
      savedPostRows.value=await fetchOotdPostsByIds([...savedPostIds]);
      const itemIds = [...new Set(savedPostRows.value.flatMap(post => post.item_ids || []))];
      const readableItems = [];
      for (let offset = 0; offset < itemIds.length; offset += 100) {
        readableItems.push(...await getPublicItemsByIds(itemIds.slice(offset, offset + 100),undefined,{defer:true}));
        if (!identityCurrent(identity)) return;
      }
      savedClothing.value = readableItems;
    } catch { if (!identityCurrent(identity)) return; savedEntries.value=[]; savedClothing.value=[];savedPostRows.value=[]; }
    const nextMetrics=await api('metrics',undefined,identity.accessToken);
    if (identityCurrent(identity)) metrics.value=nextMetrics;
  } catch(err) { if (identityCurrent(identity)) report(err); }
  finally { if(identityCurrent(identity)) loading.value=false; }
}
async function poll() {
  if(disposed) return;
  if(auth.isMember && !document.hidden && tab.value !== 'activity') {
    try { await refreshJobs(); } catch { /* Avoid repeated banners for a temporary offline state. */ }
  }
  if(!disposed) pollTimer=setTimeout(poll,studioPollDelay({hidden:document.hidden,pending:!!pendingBatch.value,jobs:jobs.value}));
}
async function preview() {
  if(!auth.isMember) return login();
  await act('preview',async()=>{
    let data;
    try { data=await api('preview',{url:form.value.sourceUrl}); }
    catch(err) {
      manualImport.value=true;
      if(['REMOTE_IMAGE_UNAVAILABLE','REMOTE_TIMEOUT','PRODUCT_CONTENT_UNSUPPORTED','REMOTE_DOWNLOAD_FAILED'].includes(err?.code)) {
        notice.value=t('商家限制自動讀取。請使用瀏覽器收藏助手，或上傳商品照片；購買連結會保留。');
        return;
      }
      throw err;
    }
    form.value.title=String(data.title || '').slice(0,160);
    form.value.imageUrl=safeCommerceUrl(data.image ? new URL(data.image,data.sourceUrl).href : '');
    form.value.imageData='';
    manualImport.value=!form.value.imageUrl;
    notice.value=t('請確認商品名稱、圖片與分類，再加入清單。','Review the image, name and category before saving.');
  });
}
async function uploadProduct(event) {
  const file=event.target.files?.[0]; if(!file) return;
  await act('image',async()=>{ form.value.imageData=(await preprocessPersonImage(file)).dataUrl; form.value.imageUrl=''; });
  event.target.value='';
}
async function saveProduct() {
  if(!auth.isMember) return login();
  await act('product',async()=>{
    const data=await api('products',form.value); products.value.unshift(data.product); await hydrate(data.product.image_path);
    form.value={ title:'',sourceUrl:'',imageUrl:'',imageData:'',category:'upper_body',color:'#c8bba9' };
    if (selected.value.length < 3) toggleProduct(data.product.id);
    await goStep(2);
    notice.value=t('已加入想買清單，還不會計入你的衣櫥。','Saved to your wishlist. Your owned wardrobe is unchanged.');
  });
}
async function uploadPerson(event) {
  const file=event.target.files?.[0]; if(!file) return;
  await act('photo',async(identity)=>{
    const image=await preprocessPersonImage(file);
    if (!identityCurrent(identity)) return;
    const photo=await aiGateway.uploadPersonPhoto(identity.accessToken,{photoId:createGenerationId(),imageData:image.dataUrl});
    if (!identityCurrent(identity)) return;
    photos.value.unshift(photo); selectedPhoto.value=photo.path; await hydrate(photo.path);
  }); event.target.value='';
}
async function submit(kind='try_on') {
  if(!auth.isMember) return login();
  if(kind==='try_on' && !canSubmit.value) return;
  if(pendingBatch.value) { error.value=t('先查詢或恢復待確認的提交，再建立新的工作。','Check or recover the pending request before starting another job.'); return; }
  await act('submit',async(identity)=>{
    const selection={kind,personPath:selectedPhoto.value,productIds:kind==='try_on'?[...selected.value]:[],clothingItemIds:kind==='try_on'?[...selectedClothing.value]:[],savedItems:kind==='try_on'?[...selectedSaved.value]:[]};
    const pending={ id:createGenerationId(),key:JSON.stringify(selection),selection };
    persistPending(pending);
    try { await api('jobs',{...selection,consent:consent.value,batchId:pending.id},identity.accessToken); if (!identityCurrent(identity)) return; }
    catch (err) {
      if (!identityCurrent(identity)) return;
      if (err.status>=400 && err.status<500) { clearPending(); throw err; }
      await refreshJobs().catch(()=>{});
      if (pendingBatch.value) throw err;
    }
    if (!identityCurrent(identity)) return;
    if (pendingBatch.value) clearPending();
    selected.value=[]; selectedClothing.value=[]; selectedSaved.value=[]; step.value=2; await refreshJobs(); if(!identityCurrent(identity)) return; selectTab('album');
    notice.value=t('已排入工作池。你可以離開頁面，稍後回相簿查看。','Added to the queue. You can leave and return to your album later.');
  });
}
async function retryPending() {
  if (!pendingBatch.value || !consent.value || busy.value) return;
  await act('recover', async (identity) => {
    const pending=pendingBatch.value;
    try {
      await api('jobs',{...pending.selection,consent:true,batchId:pending.id},identity.accessToken); if (!identityCurrent(identity)) return;
    } catch (err) {
      if (!identityCurrent(identity)) return;
      if (err.status>=400 && err.status<500) { clearPending(); throw err; }
      await refreshJobs().catch(()=>{});
      if (pendingBatch.value) throw err;
    }
    if (!identityCurrent(identity)) return;
    if (pendingBatch.value) clearPending();
    await refreshJobs(); if(!identityCurrent(identity)) return; selectTab('album');
    notice.value=t('已用原提交編號恢復這筆工作。','The original submission ID was reused to recover this job.');
  });
}
async function cancel(job) { await act('cancel',async(identity)=>{ await api(`jobs/${job.id}/cancel`,{},identity.accessToken); if(identityCurrent(identity)) await refreshJobs(); }); }
async function removePhoto(photo) {
  if (pendingBatch.value?.selection?.personPath===photo.path) { error.value=t('這張照片關聯一筆待確認提交，請先恢復或核對工作。','This photo is tied to a submission awaiting confirmation. Recover or check that job first.'); return; }
  if (!window.confirm(t('刪除這張私人照片？','Delete this private photo?'))) return;
  await act('photo-delete',async(identity)=>{
    await aiGateway.deletePersonPhoto(identity.accessToken,photo.id); if(!identityCurrent(identity)) return;
    photos.value=photos.value.filter((entry)=>entry.path!==photo.path);
    if(selectedPhoto.value===photo.path) selectedPhoto.value=photos.value[0]?.path || '';
    const url=urls.get(photo.path); if(url) URL.revokeObjectURL(url); urls.delete(photo.path);
    const next={...images.value}; delete next[photo.path]; images.value=next;
    notice.value=t('私人照片已刪除。','Private photo deleted.');
  });
}
async function setState(product,state) {
  await act('state',async(identity)=>{ const data=await api(`products/${product.id}/state`,{state},identity.accessToken); if (identityCurrent(identity)) Object.assign(product,data.product); });
}
async function addPurchasedToCloset(product) {
  await act('closet', async (identity) => {
    await closet.loadRemoteItems(identity.profileId);
    if (!identityCurrent(identity)) return;
    if (closet.dataMode !== 'REMOTE') throw new Error('Wardrobe unavailable');
    // Stable ID makes retries after a lost response resolve to the existing item.
    if (!app.items.some((item) => item.id === product.id && item.owner_id === auth.profileId)) {
      await hydrate(product.image_path);
      if (!identityCurrent(identity)) return;
      const imageUrl = images.value[product.image_path];
      if (!imageUrl) throw new Error('Product image unavailable');
      const image = await (await fetch(imageUrl)).blob();
      const prepared = await prepareClothingImage(new File([image], 'product.jpg', { type: image.type }));
      const cutout = await removeClothingBackground(prepared.displayBlob);
      Object.assign(prepared, cutout, { displayMimeType: cutout.displayBlob.type, displayBytes: cutout.displayBlob.size });
      if (!identityCurrent(identity)) return;
      const result = await closet.addItem({ id: product.id, name: product.title, name_zh: product.title,
        category: ({upper_body:'Tops',lower_body:'Bottoms',full_body:'Dresses',shoes:'Shoes',auto:'Other'})[product.category],
        color_hex: product.color, source_url: product.source_url,
        source_domain: safeCommerceUrl(product.source_url) ? new URL(product.source_url).hostname : '',
        __preparedMedia: prepared });
      if (!result.ok) throw result.error || new Error('Could not save item');
    }
    if (!identityCurrent(identity)) return;
    const data = await api(`products/${product.id}/state`, {state:'purchased'}, identity.accessToken);
    if (!identityCurrent(identity)) return;
    Object.assign(product, data.product); purchasedProduct.value = null;
    notice.value=t('已加入衣櫥。');
  });
}
function track(type,target) {
  if(!auth.isMember) return;
  void api('events',{id:createGenerationId(),type,...target}).catch(()=>{});
}
function compare(job) {
  comparisonIds.value=comparisonIds.value.includes(job.id) ? comparisonIds.value.filter((id)=>id!==job.id) : [...comparisonIds.value.slice(-2),job.id];
}
async function loadPosts() {
  try { posts.value=(await api('posts')).posts; } catch(err) { report(err); }
}
async function publish() {
  await act('publish',async()=>{
    const {post}=await api('posts',{jobId:shareJob.value.id,caption:shareCaption.value,consent:shareConsent.value});
    shareJob.value=null; shareConsent.value=false; sharedPost.value=post; await loadPosts(); selectTab('community');
    notice.value=t('已公開這張試穿結果與商品連結。','Your try-on result and product link are now public.');
  });
}
async function retract(post) {
  if (!window.confirm(t('撤回這則公開分享？','Retract this public post?'))) return;
  await act('retract',async(identity)=>{
    await api(`posts/${post.id}`,null,identity.accessToken,{method:'DELETE'});
    if(!identityCurrent(identity)) return;
    posts.value=posts.value.filter((entry)=>entry.id!==post.id);
    if(sharedPost.value?.id===post.id) sharedPost.value=null;
    notice.value=t('已撤回公開分享。','The public post has been retracted.');
  });
}
async function removeResult(job) {
  if (!window.confirm(t('刪除這筆試穿結果，也會撤回相對應的公開分享。','Delete this try-on result and retract its public post?'))) return;
  await act('result-delete',async(identity)=>{
    await api(`jobs/${job.id}/result`,null,identity.accessToken,{method:'DELETE'});
    if(!identityCurrent(identity)) return;
    jobs.value=jobs.value.filter(entry=>entry.id!==job.id);
    const url=urls.get(job.result_path); if(url) URL.revokeObjectURL(url); urls.delete(job.result_path);
    const next={...images.value}; delete next[job.result_path]; images.value=next;
    comparisonIds.value=comparisonIds.value.filter((id)=>id!==job.id);
    await refreshJobs();
    notice.value=t('試穿結果已刪除。','Try-on result deleted.');
  });
}
const productForJob = (job) => products.value.find((product)=>product.id===job.product_id) || null;
async function share(post) {
  await act('share',async()=>{
    const url=new URL('/community/tryons',window.location.origin); url.searchParams.set('post',post.id);
    const data={title:`OOTIE · ${post.title}`,text:post.caption,url:url.href};
    if(navigator.share) { try { await navigator.share(data); } catch(err) { if(err.name==='AbortError') return; throw err; } }
    else { await navigator.clipboard.writeText(url.href); notice.value=t('分享連結已複製。','Share link copied.'); }
    track('share_link',{postId:post.id});
  });
}
async function download(job) {
  const identity=identitySnapshot();
  await hydrate(job.result_path); if (!identityCurrent(identity)) return;
  const url=images.value[job.result_path]; if(!url) return;
  const anchor=document.createElement('a'); anchor.href=url; anchor.download=`ootie-tryon-${job.id}.jpg`; anchor.click();
}
watch(()=>route.query,async(query)=>{
  if(isCommunity.value) tab.value='community';
  if(query.tab==='community' && !isCommunity.value) { await router.replace({path:'/community/tryons',query:{...query,tab:undefined}}); return; }
  if(query.title || query.quick==='add-product') {
    await router.replace({path:'/closet',query:{...query,tab:'wishlist',quick:'add-product'}});
    return;
  }
  if (query.tab==='saved') { await router.replace({path:'/profile',query:{tab:'saved',lang:query.lang}}); return; }
  if (query.tab==='links') { await router.replace({path:'/closet',query:{tab:'wishlist',lang:query.lang}}); return; }
  if (query.tab==='wardrobe') { selectionSource.value='closet'; tab.value='wishlist'; await router.replace({path:'/shop',query:{lang:query.lang}}); return; }
  if(normalizeLocale(query.lang)) setLocale(query.lang);
  if(['wishlist','album','community','activity','wardrobe','saved','links'].includes(query.tab)) tab.value=query.tab;
  else tab.value=route.path==='/community/tryons'?'community':'wishlist';
  if(query.product && products.value.some(p => p.id === query.product)) { tab.value='wishlist'; selected.value=[String(query.product)]; step.value=2; }
  if(query.title) form.value={...form.value,title:String(query.title).slice(0,160),sourceUrl:safeCommerceUrl(query.url),imageUrl:safeCommerceUrl(query.image)};
  if(query.post && /^[\da-f-]{36}$/i.test(query.post)) { tab.value='community'; try { sharedPost.value=(await api(`posts/${query.post}`)).post; } catch(err) { report(err); } }
},{immediate:true});
watch(tab,async(value,previous)=>{
  error.value='';
  if(value==='community') await loadPosts();
  if(identityReady() && (value==='activity' || previous==='activity')) await refresh();
});
watch([productLimit,jobLimit,step,tab,choosePhoto],hydrateVisible);
watch(selectedPhoto,()=>{consent.value=false;});
watch(()=>[auth.session?.user?.id,auth.profileId],()=>{
  sessionVersion++; products.value=[]; jobs.value=[]; photos.value=[]; selected.value=[]; selectedClothing.value=[]; selectedSaved.value=[]; savedEntries.value=[]; selectedPhoto.value=''; pendingBatch.value=readPending(auth.session?.user?.id); metrics.value=null; matchingProduct.value=null; shareJob.value=null; purchasedProduct.value=null; consent.value=false; busy.value=''; loading.value=false; error.value=''; notice.value=''; comparisonIds.value=[]; form.value={title:'',sourceUrl:'',imageUrl:'',imageData:'',category:'upper_body',color:'#c8bba9'};
  savedClothing.value=[];savedPostRows.value=[];
  for(const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); images.value={};
},{flush:'sync',immediate:true});
watch(()=>[auth.session?.user?.id,auth.user?.id,auth.profileIdentity?.authUserId,auth.profileId,auth.isMember],()=>{if(identityReady()) void refresh();},{immediate:true});
const resumeJobs=()=>{if(!document.hidden&&identityReady())void refreshJobs().catch(()=>{});};
document.addEventListener('visibilitychange',resumeJobs);
void loadPosts(); pollTimer=setTimeout(poll,60000);
onBeforeUnmount(()=>{document.removeEventListener('visibilitychange',resumeJobs);disposed=true;sessionVersion++;clearTimeout(pollTimer);for(const url of urls.values()) URL.revokeObjectURL(url);});
</script>

<template>
  <div class="shop-view app-page">
    <header v-if="!isCommunity" class="shop-studio-heading ootie-page-heading">
      <h1>{{ t(tab === 'activity' ? '購物足跡' : '試穿工作室') }}</h1>
      <div v-if="tab !== 'activity'" class="studio-account">
        <div class="studio-account-row">
          <p v-if="auth.isMember" class="studio-credit-summary" role="status">{{ t('平台點數') }}: {{ loading ? '…' : capabilities.pointBalance ?? '—' }} · {{ t('每件 2 點，失敗退點。') }}</p>
          <router-link class="studio-points-link" to="/credits">{{ t('我的點數') }}<AppIcon name="chevron" :size="16" /></router-link>
        </div>
        <p v-if="auth.isMember && !loading && capabilities.pointBalance == null" class="studio-daily-note" role="status">{{ t('點數紀錄暫時無法載入。') }}</p>
        <p v-if="auth.isMember && !loading && capabilities.generationPolicyVersion === 2" class="studio-daily-note" role="status">{{ tf('今日免費額度 {remaining}／2 張・點數生成不限每日張數',{remaining:capabilities.dailyFreeGenerationRemaining}) }}</p>
        <p v-else-if="auth.isMember && !loading && capabilities.dailyGenerationRemaining != null" class="studio-daily-note" role="status">{{ tf('每天最多生成 {limit} 次，今天還可生成 {remaining} 次。',{limit:capabilities.dailyGenerationLimit || 2,remaining:capabilities.dailyGenerationRemaining}) }}</p>
      </div>
    </header>

    <router-link v-if="isCommunity" class="community-back" to="/explore">← {{ t('返回探索') }}</router-link>
    <nav v-if="!isCommunity && tab !== 'activity'" class="shop-tabs" :aria-label="t('購物試穿功能','Shopping studio')"><button v-for="[key,label] in tabs" :key="key" :class="{active:tab===key || (tab==='links' && key==='saved')}" :aria-current="tab===key?'page':undefined" @click="selectTab(key)">{{ label }}<span v-if="key==='album' && activeJobs.length" class="shop-count">{{ activeJobs.length }}</span></button></nav>
    <p v-if="error" class="shop-message error" role="alert">{{ error }}</p><p v-if="notice" class="shop-message" role="status">{{ notice }}</p>
    <section v-if="pendingBatch && auth.isMember" class="shop-pending-recovery" role="status"><div><strong>{{ t('有一筆提交尚待確認','One submission is waiting for confirmation') }}</strong><p>{{ t('重新整理後，先查詢原提交編號。若伺服器尚無這筆工作，可在同意處理照片後用相同編號恢復，避免重複扣點。','We first check the original request ID. If the server has no matching job, you can consent again and retry with that same ID to avoid duplicate charges.') }}</p></div><label class="shop-consent"><input v-model="consent" type="checkbox"><span>{{ t('我再次同意以這張私人照片恢復原提交。','I consent again to resume the original request with this private photo.') }}</span></label><div class="shop-result-actions"><button :disabled="!!busy" @click="refreshJobs">{{ t('查詢原工作','Check original job') }}</button><button class="shop-primary" :disabled="!!busy || !consent" @click="retryPending">{{ busy==='recover'?t('恢復中…','Recovering…'):t('用原編號恢復','Resume same request') }}</button></div></section>
    <p v-if="!auth.initialized && !auth.isMember && tab!=='community'" role="status">{{ t('載入中…') }}</p><div v-else-if="!auth.isMember && tab!=='community'" class="shop-login"><p>{{ t('登入後儲存你的商品、私人照片與試穿結果。','Sign in to save products, private photos and try-on results.') }}</p><button class="shop-primary" @click="login">{{ t('登入／註冊','Sign in / Sign up') }}</button></div>

    <section v-if="tab==='wishlist'" class="shop-studio">
      <nav class="studio-steps" :aria-label="t('試穿工作室')">
        <button v-for="(label,index) in steps" :key="label" :class="{active:step===index+2,done:step>index+2}" :aria-current="step===index+2?'step':undefined" :disabled="(index>0 && !selectionCount) || (index===2 && !selectedPhoto)" @click="goStep(index+2)"><span>{{ String(index+1).padStart(2,'0') }}</span>{{ label }}<AppIcon v-if="step>index+2" name="check" :size="16" /></button>
      </nav>
      <h2 ref="workflowTitle" class="sr-only" tabindex="-1">{{ steps[step-2] }}</h2>
      <div class="studio-layout">
        <section v-if="step===2" class="studio-shortlist">
          <div class="shop-section-title"><div><h2>{{ t('挑選試穿') }}</h2><p>{{ generationAllowance.mode === 'daily_free' ? t('本次使用 1 張免費額度，不扣點。') : t('單件 2 點，三件整套 6 點。') }}</p></div></div>
        <div class="studio-source-tabs" role="group" :aria-label="t('選擇衣物來源')"><button type="button" :aria-pressed="selectionSource==='wishlist'" @click="selectionSource='wishlist'">{{ t('想買清單') }}</button><button type="button" :aria-pressed="selectionSource==='closet'" @click="selectionSource='closet'">{{ t('我的衣櫥') }}</button><button type="button" :aria-pressed="selectionSource==='saved'" @click="selectionSource='saved'">{{ t('收藏穿搭') }}</button></div>
        <template v-if="selectionSource==='wishlist'">
        <div v-if="!visibleProducts.length" class="shop-empty"><AppIcon name="Shop" :size="34" /><h3>{{ t('想買清單目前沒有商品') }}</h3><p>{{ t('先在想買清單加入商品，或切換到我的衣櫥挑選衣物。') }}</p></div>
        <div v-else class="shop-product-grid">
          <article v-for="product in visibleProducts" :key="product.id" :class="['shop-product',{selected:selected.includes(product.id)}]">
            <button class="shop-product-image" :disabled="!!busy || !!pendingBatch" :aria-pressed="selected.includes(product.id)" :aria-label="`${t('選擇試穿','Select for try-on')} ${product.title}`" @click="toggleProduct(product.id)"><MediaImage v-if="images[product.image_path]" :src="images[product.image_path]" :alt="product.title" loading="lazy" /><span v-else class="shop-image-placeholder">{{ t('商品照片','Product photo') }}</span><span class="shop-select-mark">{{ selected.includes(product.id)?'✓':'＋' }}</span></button>
            <div class="shop-product-info">
              <small>{{ product.state==='dismissed'?t('已放下'):product.state==='purchased'?t('已購買','Purchased'):product.state==='kept'?t('保留候選','Shortlisted'):t('想買','Wishlist') }}</small>
              <h3>{{ product.title }}</h3>
              <div class="shop-product-tools">
                <div class="shop-product-actions">
                  <button type="button" class="shop-icon-action" :aria-label="t('搭我的衣櫥')" :title="t('搭我的衣櫥')" @click="matchingProduct=product"><AppIcon name="Closet" /></button>
                  <a v-if="safeCommerceUrl(product.source_url)" class="shop-icon-action" :href="safeCommerceUrl(product.source_url)" target="_blank" rel="noopener noreferrer" :aria-label="t('前往購買 ↗')" :title="t('前往購買 ↗')" @click="track('purchase_click',{productId:product.id})"><AppIcon name="Shop" /></a>
                </div>
                <div class="shop-secondary-actions">
                  <button v-if="product.state==='dismissed'" type="button" class="shop-icon-action" :disabled="!!busy" :aria-label="t('放回想買清單')" :title="t('放回想買清單')" @click="setState(product,'wishlist')"><AppIcon name="restore" /></button>
                  <button type="button" class="shop-icon-action" :disabled="!!busy" :aria-pressed="product.state==='kept'" :aria-label="t('保留')" :title="t('保留')" @click="setState(product,'kept')"><AppIcon name="bookmark" /></button>
                  <button type="button" class="shop-icon-action" :disabled="!!busy" :aria-pressed="product.state==='dismissed'" :aria-label="t('先放下')" :title="t('先放下')" @click="setState(product,'dismissed')"><AppIcon name="pass" /></button>
                  <button type="button" class="shop-icon-action" :disabled="!!busy" :aria-label="t('買到了，加入衣櫥')" :title="t('買到了，加入衣櫥')" @click="purchasedProduct=product"><AppIcon name="purchased" /></button>
                </div>
              </div>
            </div>
          </article>
        </div><button v-if="products.filter(p=>showPassed || p.state!=='dismissed').length>productLimit" class="shop-load-more" @click="productLimit+=12">{{ t('顯示更多','Show more') }}</button>

        </template>
        <template v-else-if="selectionSource==='closet'">
          <div v-if="!app.items.length" class="shop-empty"><p>{{ t('衣櫥目前沒有衣物') }}</p><router-link to="/closet">{{ t('新增單品') }}</router-link></div>
          <div v-else class="shop-product-grid"><article v-for="item in app.items.filter(i=>i.owner_id===auth.profileId && !i.hidden && canTryOnClothing(i))" :key="item.id" :class="['shop-product',{selected:selectedClothing.includes(item.id)}]"><button class="shop-product-image" :disabled="!canTryOnClothing(item)" :aria-pressed="selectedClothing.includes(item.id)" :aria-label="`${t('選擇試穿')} ${item.name_zh || item.name}`" @click="toggleClothing(item.id)"><MediaImage v-if="item.photo" :src="item.photo" :alt="item.name_zh || item.name" /><span v-if="canTryOnClothing(item)" class="shop-select-mark">{{ selectedClothing.includes(item.id)?'✓':'＋' }}</span></button><div class="shop-product-info"><h3>{{ item.name_zh || item.name }}</h3><p v-if="!canTryOnClothing(item)" class="shop-hint">{{ t('這個品類暫不支援試穿。') }}</p></div></article></div>
        </template>
        <template v-else>
          <div v-if="!savedItems.length" class="shop-empty"><p>{{ t('收藏的穿搭目前沒有可選擇的公開衣物。') }}</p><router-link to="/profile?tab=saved">{{ t('我的收藏') }}</router-link></div>
          <div v-else class="shop-product-grid"><article v-for="item in savedItems.filter(canTryOnClothing)" :key="item.id" :class="['shop-product',{selected:selectedSaved.some(entry=>entry.itemId===item.id)}]"><button class="shop-product-image" :disabled="!canTryOnClothing(item)" :aria-pressed="selectedSaved.some(entry=>entry.itemId===item.id)" :aria-label="`${t('選擇試穿')} ${item.name}`" @click="toggleSavedItem(item)"><MediaImage v-if="item.photo" :src="item.photo" :alt="item.name" /><span v-if="canTryOnClothing(item)" class="shop-select-mark">{{ selectedSaved.some(entry=>entry.itemId===item.id)?'✓':'＋' }}</span></button><div class="shop-product-info"><h3>{{ item.name }}</h3><p v-if="!canTryOnClothing(item)" class="shop-hint">{{ t('這個品類暫不支援試穿。') }}</p></div></article></div>
        </template>

        </section>
        <section v-if="step===3" class="shop-fitting shop-panel">
        <h2>{{ t('選擇模特兒') }}</h2><p>{{ t('選擇本人的單人正面照，讓身體與衣物清楚入鏡。','Choose your own front-facing photo, with your body and clothing clearly visible.') }}</p>
        <label class="shop-person-upload">＋ {{ busy==='photo'?t('處理照片中…','Preparing photo…'):t('上傳私人照片','Add a private photo') }}<input type="file" accept="image/jpeg,image/png" :disabled="!auth.isMember || !!busy || !!pendingBatch" @change="uploadPerson"></label>
        <div v-if="selectedPhoto && images[selectedPhoto]" class="selected-person-preview"><MediaImage :src="images[selectedPhoto]" :alt="t('本次選用的私人照片','Selected private photo')" /></div><button v-if="photos.length" type="button" @click="choosePhoto=!choosePhoto">{{ choosePhoto?t('完成'):t('更換或管理照片','Change or manage photos') }}</button>
        <div v-if="choosePhoto || !selectedPhoto" class="shop-person-list"><div v-for="photo in photos" :key="photo.path" class="shop-person-entry"><button :disabled="!!pendingBatch" :class="{selected:selectedPhoto===photo.path}" :aria-pressed="selectedPhoto===photo.path" :aria-label="t('選用這張照片','Use this photo')" @click="selectedPhoto=photo.path;choosePhoto=false;hydrate(photo.path)"><MediaImage v-if="images[photo.path]" :src="images[photo.path]" :alt="t('我的私人照片','My private photo')" /><span v-else>{{ t('照片','Photo') }}</span></button><button class="shop-photo-delete" :disabled="!!busy || pendingBatch?.selection?.personPath===photo.path" :aria-label="t('刪除這張照片','Delete this photo')" @click="removePhoto(photo)">×</button></div></div>
        <button class="shop-primary shop-wide" :disabled="!selectedPhoto" @click="goStep(4)">{{ t('下一步：模擬試穿') }}</button>
        </section>
        <section v-if="step===4" class="shop-fitting shop-panel">
        <h2>{{ t('模擬試穿') }}</h2>
        <label class="shop-consent"><input v-model="consent" type="checkbox"><span>{{ t('我有權使用選用的照片，同意由 OOTIE 及其影像處理服務供應商進行這次試穿或色彩分析。原始照片保持私人。') }}</span></label>
        <div class="shop-selection-summary"><strong>{{ selectionCount }} / 3</strong><span>{{ t('件候選商品','selected products') }}</span><small v-if="generationAllowance.mode === 'daily_free'">{{ t('免費額度 1 張') }}</small><small v-else>{{ selectionCount * 2 }} {{ t('平台點數') }}</small></div>
        <p v-if="submitHint" id="submit-hint" class="shop-hint">{{ submitHint }}</p><button :aria-describedby="submitHint ? 'submit-hint' : undefined" class="shop-primary shop-wide" :disabled="!canSubmit" @click="submit()">{{ busy==='submit'?t('加入工作池…','Adding to queue…'):t('送出試穿工作','Queue try-ons') }}</button>
        <p v-if="auth.isMember && !capabilities.enabled" class="shop-hint">{{ t('試穿尚未開放或免費額度不足，仍可整理商品與搭配。','Try-on is not available or free credits are exhausted. You can still organize and pair products.') }}</p>
        <p class="shop-hint">{{ t('送出後可離開頁面，完成的圖片會保存在私人相簿。AI 圖片僅供視覺參考，尺寸請查看商品資訊。','Leave the page after submitting; results will appear in your private album. AI previews illustrate a look, not sizing or fit.') }}</p>

        </section>
        <aside v-if="step>=2" class="studio-selection"><p class="shop-hint">{{ t('整套試穿請各選最多一件上衣、下身與外套。') }}</p><h3>{{ t('這次選擇') }} <span>{{ selectionCount }} / 3</span></h3><div v-for="product in chosenProducts" :key="product.id" class="studio-selected-product"><MediaImage v-if="images[product.image_path]" :src="images[product.image_path]" :alt="product.title" /><span>{{ product.title }}</span><button type="button" :aria-label="t('移除')+' '+product.title" @click="toggleProduct(product.id)"><AppIcon name="close" :size="17"/></button></div><div v-for="item in chosenClothing" :key="item.id" class="studio-selected-product"><MediaImage v-if="item.photo" :src="item.photo" :alt="item.name_zh || item.name" /><span>{{ item.name_zh || item.name }}</span><button type="button" :aria-label="t('移除')+' '+(item.name_zh||item.name)" @click="toggleClothing(item.id)"><AppIcon name="close" :size="17"/></button></div><div v-for="item in chosenSaved" :key="item.id" class="studio-selected-product"><MediaImage v-if="item.photo" :src="item.photo" :alt="item.name" /><span>{{ item.name }}</span><button type="button" :aria-label="t('移除')+' '+item.name" @click="toggleSaved(item)"><AppIcon name="close" :size="17"/></button></div><div v-if="step===2" class="studio-sidebar-next"><p v-if="!selectionCount" class="shop-hint">{{ t('選擇至少一件商品，再繼續。') }}</p><button class="shop-primary" :disabled="!selectionCount" @click="goStep(3)">{{ t('下一步：選擇模特兒') }}<AppIcon name="chevron" :size="18"/></button></div><button v-if="step>2" @click="goStep(2)"><AppIcon name="back" :size="16" />{{ t('返回商品清單') }}</button></aside>
      </div>
    </section>

    <section v-else-if="tab==='album'" class="shop-album">
      <div class="shop-section-title"><div><h2>{{ t('私人相簿') }}</h2><p>{{ t('最多選取三張照片比較。') }}</p></div><button :disabled="loading" @click="refresh">{{ t('更新進度','Refresh') }}</button></div>
      <div v-if="toneJobs.length" class="shop-panel shop-tone-results"><h3>{{ t('個人色彩分析','Personal color analysis') }}</h3><p v-for="job in toneJobs" :key="job.id">{{ stateLabel(job.status) }} · {{ formatDate(job.created_at,{dateStyle:'medium'}) }} <span v-if="job.status==='failed'" class="shop-hint">{{ t('請改用光線均勻、臉部清晰的正面近照。') }}</span> <span v-if="job.result_data?.skin_color" class="shop-skin-swatch" :style="{background:job.result_data.skin_color}"></span></p><div class="shop-palette"><div v-for="color in palette" :key="color.key"><i :style="{background:color.color}"></i><span>{{ t({soft:'柔和',contrast:'對比',neutral:'中性'}[color.key]) }}</span></div></div></div>
      <div v-if="comparisons.length" class="shop-comparison"><figure v-for="job in comparisons" :key="job.id"><MediaImage :src="images[job.result_path]" :alt="jobTitle(job)" /><figcaption>{{ jobTitle(job) }}</figcaption></figure></div>
      <p v-if="loading && !albumJobs.length" role="status">{{ t('載入中…') }}</p><div v-else-if="!albumJobs.length && !toneJobs.length" class="shop-empty"><AppIcon name="album" :size="34" /><h3>{{ t('尚無試穿結果') }}</h3><button @click="selectTab('wishlist')">{{ t('去挑選商品','Choose products') }} →</button></div>
      <div class="shop-album-grid"><article v-for="job in albumJobs" :key="job.id" class="shop-result shop-panel"><div class="shop-result-media"><MediaImage v-if="job.result_path && images[job.result_path]" :src="images[job.result_path]" :alt="jobTitle(job)" loading="lazy" /><div v-else class="shop-job-placeholder"><AppIcon name="sparkle" :size="34" :class="{working:['preparing','submitting','processing'].includes(job.status)}" /><strong>{{ stateLabel(job.status) }}</strong></div><span class="shop-job-state">{{ stateLabel(job.status) }}</span></div><small>{{ formatDate(job.created_at,{dateStyle:'medium',timeStyle:'short'}) }}</small><h3>{{ jobTitle(job) }}</h3><p v-if="job.sequence_total>1" class="shop-hint">{{ $tf('已完成 {done} / {total} 件', {done:jobs.filter(entry=>entry.batch_id===job.batch_id &amp;&amp; entry.status==='succeeded').length,total:job.sequence_total}) }}</p><p v-if="['needs_review','failed'].includes(job.status)" class="shop-hint">{{ job.status==='needs_review'?t('服務正在核對這筆工作，請勿重送相同生成。','The service must reconcile this job. Please do not submit it again.'):t('這次未能完成，請檢查人物照與商品圖。','This job did not finish. Please check the portrait and garment image.') }}</p><div v-if="job.status==='succeeded'" class="shop-result-actions"><button :aria-pressed="comparisonIds.includes(job.id)" @click="compare(job)">{{ comparisonIds.includes(job.id)?'✓ ':'' }}{{ t('比較','Compare') }}</button><button @click="download(job)">{{ t('下載','Download') }}</button><button :disabled="!!busy" @click="removeResult(job)">{{ t('刪除') }}</button></div><button v-if="job.status==='queued' &amp;&amp; jobs.filter(entry=>entry.batch_id===job.batch_id).every(entry=>entry.status==='queued')" :disabled="!!busy" @click="cancel(job)">{{ t('取消等待','Cancel queued job') }}</button></article></div>
      <button v-if="jobs.filter(j=>j.kind==='try_on').length>jobLimit" class="shop-load-more" @click="jobLimit+=12">{{ t('顯示更多','Show more') }}</button>

    </section>

    <section v-else-if="tab==='community'">
      <div class="shop-section-title"><div><h2>{{ t('穿搭分享') }}</h2><p>{{ t('這裡是大家主動公開的試穿動態。你的私人相簿只有你能查看。') }}</p></div><button @click="loadPosts">{{ t('重新整理','Refresh') }}</button></div>
      <div v-if="!posts.length && !sharedPost" class="shop-empty"><AppIcon name="Explore" :size="34" /><h3>{{ t('成為第一位分享穿搭的人','Share the first look') }}</h3><p>{{ t('試穿完成後，在私人相簿選擇你願意公開的一張。','After a try-on finishes, choose one result from your album to publish.') }}</p></div>
      <div class="shop-album-grid"><article v-for="post in sharedPost?[sharedPost,...posts.filter(p=>p.id!==sharedPost.id)]:posts" :key="post.id" class="shop-result shop-panel"><router-link v-if="post.author?.username" class="studio-share-author" :to="{path:'/profile',query:{user:post.author.username}}"><MediaImage v-if="post.author.avatarUrl" :src="post.author.avatarUrl" alt="" /><span v-else class="studio-author-initials">{{ post.author.initials }}</span><span>{{ tf('由 {name} 分享',{name:post.author.displayName || post.author.username}) }}</span></router-link><p v-else class="studio-share-author">{{ t('公開分享') }}</p><MediaImage class="shop-shared-image" :src="post.image_url" :alt="post.title" loading="lazy" /><small>{{ t('AI 試穿','AI try-on') }}</small><h3>{{ post.title }}</h3><p class="shop-caption">{{ post.caption }}</p><div class="shop-product-actions"><a v-if="safeCommerceUrl(post.source_url)" :href="safeCommerceUrl(post.source_url)" target="_blank" rel="noopener noreferrer" @click="track('purchase_click',{postId:post.id})">{{ t('查看商品 ↗','View product ↗') }}</a><button :disabled="!!busy" @click="share(post)">{{ t('分享連結','Share link') }}</button><button v-if="jobs.some(job=>job.id===post.id)" :disabled="!!busy" @click="retract(post)">{{ t('取消公開','Unpublish') }}</button></div></article></div>
    </section>

    <section v-else-if="tab==='activity'" class="shop-panel"><h2>{{ t('從心動到行動','From discovery to action') }}</h2><p v-if="loading" role="status">{{ t('正在載入購物紀錄…') }}</p><div v-if="metrics" class="shop-metrics"><div><strong>{{ metrics.products }}</strong><span>{{ t('收藏商品','Saved products') }}</span></div><div><strong>{{ metrics.completedTryOns }}</strong><span>{{ t('完成試穿','Completed try-ons') }}</span></div><div><strong>{{ metrics.purchaseClicks }}</strong><span>{{ t('購買連結點擊','Product link clicks') }}</span></div><div><strong>{{ metrics.shareActions }}</strong><span>{{ t('分享操作','Share actions') }}</span></div></div><p>{{ t('這裡整理你近期收藏商品、完成試穿、前往商店和分享穿搭的紀錄。點開商品連結會記為前往商店，不代表已購買。') }}</p></section>

    <div v-if="extensionOpen" class="shop-modal-backdrop" @click.self="extensionOpen=false"><section class="shop-modal" role="dialog" aria-modal="true" :aria-label="t('瀏覽器收藏助手')" v-accessible-modal="{onClose:()=>extensionOpen=false}"><button class="shop-modal-close modal-close" @click="extensionOpen=false" :aria-label="t('關閉')">×</button><ExtensionGuide /></section></div>
    <div v-if="purchasedProduct" class="shop-modal-backdrop" @click.self="!busy && (purchasedProduct=null)"><section class="shop-modal" role="dialog" aria-modal="true" :aria-label="t('確認已購買')" v-accessible-modal><button class="shop-modal-close modal-close" :disabled="!!busy" @click="purchasedProduct=null" :aria-label="t('關閉')">×</button><h2>{{ t('確認已購買') }}</h2><p>{{ purchasedProduct.title }}</p><p>{{ t('確認你已擁有這件商品，將照片與名稱加入衣櫥。') }}</p><button class="shop-primary" :disabled="!!busy" @click="addPurchasedToCloset(purchasedProduct)">{{ busy==='closet'?t('加入衣櫥中…'):t('完成並加入衣櫥') }}</button></section></div>
    <div v-if="matchingProduct" class="shop-modal-backdrop" @click.self="matchingProduct=null"><section class="shop-modal" role="dialog" aria-modal="true" :aria-label="t('衣櫥搭配','Wardrobe pairings')" v-accessible-modal="{onClose:()=>matchingProduct=null}"><button class="shop-modal-close modal-close" @click="matchingProduct=null" :aria-label="t('關閉','Close')">×</button><h2>{{ t('衣櫥搭配') }}</h2><p>{{ matchingProduct.title }}</p><label v-if="palette.length" class="shop-consent"><input v-model="useColorIdeas" type="checkbox"><span>{{ t('使用我選用的色彩分析作為搭配偏好','Use my optional color analysis as a pairing preference') }}</span></label><div v-if="matches.length" class="shop-match-list"><article v-for="match in matches" :key="match.item.id"><MediaImage v-if="match.item.photo" :src="match.item.photo" :alt="match.item.name_zh || match.item.name" /><div><h3>{{ match.item.name_zh || match.item.name }}</h3><p>{{ reasonLabel(match.reason) }}</p></div></article></div><p v-else>{{ t('還沒有合適的衣物資料。先加入幾件自己的衣服，再來看看搭配。','No complementary wardrobe pieces yet. Add a few items you own and try again.') }}</p><p class="shop-hint">{{ t('依衣物分類與你填寫的顏色提供搭配靈感，可依個人喜好調整。','Pairing ideas use garment categories and saved colors. Your preferences come first.') }}</p><router-link to="/closet" @click="matchingProduct=null">{{ t('查看我的衣櫥','Open my wardrobe') }} →</router-link></section></div>
    <div v-if="shareJob" class="shop-modal-backdrop" @click.self="shareJob=null"><form class="shop-modal" role="dialog" aria-modal="true" :aria-label="t('公開分享試穿','Publish try-on')" v-accessible-modal="{onClose:()=>shareJob=null}" @submit.prevent="publish"><button type="button" class="shop-modal-close modal-close" @click="shareJob=null" :aria-label="t('關閉','Close')">×</button><h2>{{ t('分享這張穿搭','Share this look') }}</h2><MediaImage class="shop-share-preview" :src="images[shareJob.result_path]" :alt="jobTitle(shareJob)" /><label>{{ t('想和大家說什麼？','What would you like to share?') }}<textarea v-model="shareCaption" maxlength="800" rows="3"></textarea></label><label class="shop-consent"><input v-model="shareConsent" type="checkbox" required><span>{{ t('我同意公開這張 AI 試穿結果、文字與商品連結，讓任何人都能查看。原始人物照與其他私人相簿不公開。','I agree to publish this AI try-on image, caption and product link for anyone to view. My original photo and other private results stay private.') }}</span></label><button class="shop-primary" :disabled="!shareConsent || !!busy">{{ busy==='publish'?t('發布中…','Publishing…'):t('確認公開發布','Publish this look') }}</button></form></div>
  </div>
</template>

<style scoped>
.studio-source-tabs{display:flex;gap:8px;margin:0 0 18px}.studio-source-tabs button[aria-pressed=true]{background:var(--accent-pink-soft);border-color:var(--accent)}

.shop-wake-note{flex:1;max-width:520px;margin:0;padding:12px 16px;border:1px solid var(--shop-line);border-radius:14px;background:#fff8e9;color:var(--shop-muted);font-size:12px;line-height:1.7}
.shop-pending-recovery{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr);gap:12px;align-items:center;margin:14px 0 20px;padding:18px;border:1px solid #d6b98a;border-radius:16px;background:#fff8e9}
.shop-pending-recovery p{margin:5px 0;color:var(--shop-muted);font-size:12px}
.shop-pending-recovery .shop-result-actions{grid-column:1/-1}
.shop-credit-status{padding:10px 12px;border-radius:10px;background:#f5f2ed;font-size:12px}
.shop-sample-link{margin:0 0 18px;background:#f8eee8!important}
.shop-person-entry{position:relative;flex:none;width:65px;height:83px}
.shop-person-entry>button:first-child{width:100%;height:100%;padding:2px;overflow:hidden}
.shop-person-entry .shop-photo-delete{position:absolute;top:-5px;right:-5px;width:23px!important;height:23px!important;min-height:23px;padding:0!important;border-radius:50%;background:#fff!important;color:#8b423b!important;line-height:1}
.shop-triptych{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:14px}
.shop-triptych figure{min-width:0;margin:0;text-align:center}
.shop-triptych img{display:block;width:100%;aspect-ratio:3/4;object-fit:contain;background:#f4eee6;border-radius:8px}
.shop-triptych figure>span{display:grid;place-items:center;aspect-ratio:3/4;border-radius:8px;background:#f4eee6;color:var(--shop-muted);font-size:10px}
.shop-triptych figcaption{padding-top:5px;font-size:10px;color:var(--shop-muted)}
.studio-share-author{display:flex;align-items:center;gap:10px;margin-bottom:16px;font-size:13px;text-decoration:none}.studio-share-author img,.studio-author-initials{width:36px;height:36px;border-radius:50%;object-fit:cover}.studio-author-initials{display:grid;place-items:center;background:var(--accent-lavender-soft)}.studio-saved{padding-bottom:24px}
.studio-extension-entry{margin-bottom:16px;display:flex;align-items:center;gap:8px}.studio-product-preview{display:block;max-width:220px;max-height:260px;object-fit:contain;margin:16px auto}

.shop-view{--shop-ink:#35312e;--shop-muted:#766d66;--shop-line:#e7ded4;--shop-pink:#f6d9df;--shop-cream:#fffaf3;color:var(--shop-ink);max-width:1400px;margin:auto;padding:8px 0 56px}.shop-view button,.shop-view input,.shop-view select,.shop-view textarea{font:inherit}.shop-view button{cursor:pointer;border:1px solid var(--shop-line);background:#fffdf9;color:var(--shop-ink);border-radius:12px;padding:10px 14px;transition:background .15s,transform .15s}.shop-view button:hover:not(:disabled){background:#f8e9e7}.shop-view button:disabled{opacity:.48;cursor:not-allowed}.shop-view :focus-visible{outline:3px solid #6d8d9c;outline-offset:3px}.shop-view a{color:#57453f;text-underline-offset:4px}.shop-view h2{font-size:23px;margin:7px 0 12px;letter-spacing:-.6px}.shop-view h3{font-size:16px;line-height:1.5;margin:8px 0}.shop-view p{line-height:1.75}.shop-view label{display:block;font-size:13px;font-weight:600}.shop-view input:not([type=checkbox]):not([type=file]),.shop-view select,.shop-view textarea{width:100%;border:1px solid var(--shop-line);border-radius:10px;background:#fff;padding:12px;box-sizing:border-box;margin-top:7px;color:var(--shop-ink);min-height:44px}.shop-view input[type=color]{padding:5px!important}.shop-view input[type=checkbox]{accent-color:#78534e;width:18px;height:18px;flex-shrink:0}.shop-view .shop-primary{background:#433934;color:#fff;border-color:#433934;font-weight:600}.shop-view .shop-primary:hover:not(:disabled){background:#67504a}.shop-hero{display:grid;grid-template-columns:1fr 250px;gap:40px;background:var(--shop-cream);border:1px solid var(--shop-line);border-radius:28px;padding:40px 44px;margin-bottom:24px;overflow:hidden}.shop-kicker,.shop-eyebrow{font-size:10px;letter-spacing:2px;font-weight:700;color:#7f635b}.shop-kicker{display:flex;align-items:center;gap:18px}.shop-view .language-toggle{padding:5px 9px;border-radius:7px;font-size:11px}.shop-hero h1{font-size:clamp(28px,3.2vw,46px);line-height:1.4;letter-spacing:-1.5px;margin:20px 0 14px;font-weight:650}.shop-hero h1 em{font-style:normal;color:#8d5c58}.shop-hero-copy>p{color:var(--shop-muted);max-width:550px;font-size:14px;margin:0}.shop-journey{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.shop-journey span{padding:8px 12px;background:#fff;border:1px solid #ede4da;border-radius:99px;font-size:11px}.shop-hero-note{align-self:center;background:#f4e4c2;border-radius:120px 120px 16px 16px;padding:30px 24px 25px;transform:rotate(3deg);text-align:center;box-shadow:8px 9px 0 #f6dce1}.shop-note-star{display:block;font-size:36px;color:#8d6752;margin-bottom:12px}.shop-hero-note strong{font-size:22px;line-height:1.7}.shop-hero-note p{font-size:11px;margin-top:16px}.shop-color-dots{display:flex;justify-content:center;margin-top:18px}.shop-color-dots i{width:22px;height:22px;border-radius:50%;background:#ead0cd;border:2px solid #fff;margin-left:-5px}.shop-color-dots i:nth-child(2){background:#a4b9c7}.shop-color-dots i:nth-child(3){background:#725b51}.shop-tabs{display:flex;border-bottom:1px solid var(--shop-line);gap:20px;margin-bottom:28px;overflow:auto}.shop-tabs button{border:0;border-radius:0;white-space:nowrap;padding:14px 2px;background:transparent;color:var(--shop-muted);font-size:14px;position:relative}.shop-tabs button.active{color:#774f49;font-weight:700;border-bottom:3px solid #bc837e}.shop-count{display:inline-grid;place-items:center;margin-left:7px;background:var(--shop-pink);border-radius:20px;min-width:20px;height:20px;font-size:10px}.shop-message{border-radius:12px;padding:14px 18px;background:#eef2e8;color:#445c40;font-size:14px}.shop-message.error{background:#fbe5e2;color:#893e37}.shop-login{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:18px 22px;background:#f5ece6;border-radius:16px;margin-bottom:22px}.shop-login p{font-size:14px;margin:0}.shop-workspace{display:grid;grid-template-columns:minmax(0,1fr) 290px;align-items:start;gap:24px}.shop-panel{border:1px solid var(--shop-line);border-radius:20px;background:#fffefb;padding:24px}.shop-section-title{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:18px}.shop-section-title p{font-size:13px;color:var(--shop-muted);margin:0}.shop-tag{font-size:10px;border:1px solid var(--shop-line);border-radius:30px;padding:7px 10px;white-space:nowrap}.shop-url-row{display:flex;align-items:end;gap:8px}.shop-url-row button{white-space:nowrap;height:44px;font-size:12px}.shop-import-details{display:grid;grid-template-columns:150px 1fr;gap:18px;margin-top:20px}.shop-image-upload{border:1px dashed #cdbbb0;border-radius:14px;background:#f8f2eb;min-height:200px;display:flex!important;flex-direction:column;align-items:center;justify-content:center;padding:10px;cursor:pointer;text-align:center;overflow:hidden;position:relative}.shop-image-upload>span{font-size:40px;font-weight:300;color:#9e7c70}.shop-image-upload img{width:100%;height:145px;object-fit:contain}.shop-image-upload strong{font-size:12px;margin:8px 0}.shop-image-upload small{color:var(--shop-muted);font-size:10px}.shop-image-upload input,.shop-person-upload input{position:absolute;opacity:0;width:100%;height:100%;inset:0;cursor:pointer}.shop-fields{display:grid;gap:13px}.shop-field-pair{display:grid;grid-template-columns:1fr 80px;gap:12px}.shop-hint{font-size:11px!important;color:var(--shop-muted);line-height:1.8;display:block}.shop-import>.shop-primary{margin-top:5px}.shop-list-heading{margin:30px 0 16px}.shop-list-heading button{font-size:11px}.shop-empty{padding:42px 20px;text-align:center;border:1px dashed var(--shop-line);border-radius:20px;background:#fcf8f2}.shop-empty>span{font-size:38px;color:#ad8d80}.shop-empty p{font-size:13px;color:var(--shop-muted);max-width:420px;margin:auto}.shop-empty button{margin-top:15px}.shop-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.shop-product{border:1px solid var(--shop-line);border-radius:16px;overflow:hidden;background:#fffefb}.shop-product.selected{border:2px solid #b78078}.shop-view .shop-product-image{position:relative;padding:10px;border:0;border-radius:0;width:100%;height:190px;background:#f5f0e9;display:grid;place-items:center}.shop-product-image img{width:100%;height:100%;object-fit:contain}.shop-image-placeholder{font-size:11px;color:var(--shop-muted)}.shop-select-mark{position:absolute;right:10px;top:10px;background:#fff;border:1px solid var(--shop-line);border-radius:50%;width:26px;height:26px;display:grid;place-items:center}.selected .shop-select-mark{background:#a6746d;color:#fff}.shop-product-info{padding:13px}.shop-product-info>small{font-size:10px;color:#9b7267}.shop-product-info h3{font-size:13px;overflow-wrap:anywhere}.shop-product-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:12px}.shop-product-actions button{padding:7px 9px;font-size:11px}.shop-secondary-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px;border-top:1px solid #efe7df;padding-top:10px}.shop-secondary-actions button{border:0;padding:0;background:none;font-size:10px;color:var(--shop-muted)}.shop-fitting{position:sticky;top:22px}.shop-fitting>p,.shop-tone p{font-size:12px;color:var(--shop-muted)}.shop-person-upload{position:relative;text-align:center;border:1px dashed #bda99e;border-radius:12px;padding:16px 8px;margin:18px 0;overflow:hidden}.shop-person-list{display:flex;gap:8px;overflow:auto;margin-bottom:16px}.shop-person-list button{flex-shrink:0;width:65px;height:83px;padding:2px;overflow:hidden}.shop-person-list img{width:100%;height:100%;object-fit:cover;border-radius:8px}.shop-person-list .selected{border:2px solid #9c6b63}.shop-consent{display:flex!important;align-items:start;gap:9px;font-size:11px!important;line-height:1.7;font-weight:400!important;margin:16px 0}.shop-consent input{margin-top:1px}.shop-selection-summary{display:flex;align-items:center;gap:8px;background:#f8eee8;border-radius:10px;padding:12px;margin-top:20px;font-size:11px}.shop-selection-summary strong{font-size:20px}.shop-selection-summary small{margin-left:auto}.shop-wide{width:100%;margin-top:10px}.shop-tone{border-top:1px solid var(--shop-line);padding-top:22px;margin-top:24px}.shop-tone button{font-size:11px;padding:10px}.shop-tone small{display:block;color:var(--shop-muted);font-size:10px;line-height:1.7;margin-top:12px}.shop-palette{display:flex;gap:18px;margin-top:18px}.shop-palette div{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10px}.shop-palette i{width:36px;height:36px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--shop-line)}.shop-album-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.shop-result{padding:15px;overflow:hidden}.shop-result-media{position:relative;aspect-ratio:3/4;background:#f4eee6;border-radius:12px;overflow:hidden;margin-bottom:12px}.shop-result-media img{width:100%;height:100%;object-fit:contain}.shop-job-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#9b8170;font-size:13px}.shop-job-placeholder>span{font-size:45px}.working{animation:shop-breathe 2s ease-in-out infinite}.shop-job-state{position:absolute;bottom:10px;left:10px;background:#fffcf3e8;border:1px solid #e6d8cc;border-radius:30px;padding:6px 12px;font-size:10px}.shop-result>small{font-size:10px;color:var(--shop-muted)}.shop-result-actions{display:flex;gap:6px;flex-wrap:wrap}.shop-result-actions button{font-size:11px;padding:8px}.shop-result-actions button[aria-pressed=true]{background:var(--shop-pink)}.shop-comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;background:#f7eae7;padding:20px;border-radius:20px;margin-bottom:24px}.shop-comparison figure{margin:0}.shop-comparison img{width:100%;aspect-ratio:3/4;object-fit:contain;background:#fff;border-radius:10px}.shop-comparison figcaption{font-size:12px;text-align:center;padding:8px}.shop-tone-results{margin-top:22px}.shop-skin-swatch{display:inline-block;width:20px;height:20px;border-radius:50%;vertical-align:middle}.shop-shared-image{width:100%;aspect-ratio:3/4;object-fit:contain;background:#f8f2ea;border-radius:12px;margin-bottom:12px}.shop-caption{font-size:13px;white-space:pre-line;overflow-wrap:anywhere}.shop-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}.shop-metrics>div{display:flex;flex-direction:column;gap:8px;background:#f7eee7;padding:20px;border-radius:14px}.shop-metrics strong{font-size:30px}.shop-metrics span{font-size:12px}.shop-load-more{display:block;margin:24px auto}.shop-modal-backdrop{position:fixed;inset:0;background:#332a2566;backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}.shop-modal{background:#fffaf3;border-radius:24px;padding:30px;max-width:520px;width:100%;max-height:85vh;overflow:auto;position:relative;box-shadow:0 24px 80px #2a221c30}.shop-modal-close{position:absolute;right:15px;top:15px;padding:3px 11px!important;font-size:24px!important}.shop-match-list article{display:flex;gap:16px;align-items:center;background:#fff;border:1px solid var(--shop-line);border-radius:12px;padding:12px;margin:10px 0}.shop-match-list img{width:80px;height:85px;object-fit:contain}.shop-match-list p{font-size:12px;margin:0}.shop-share-preview{height:220px;max-width:100%;object-fit:contain;display:block;margin:14px auto}.shop-modal textarea{resize:vertical}.shop-modal h2{padding-right:25px}
@keyframes shop-breathe{50%{opacity:.4;transform:scale(.9)}}
@media(max-width:1150px){.shop-workspace{grid-template-columns:minmax(0,1fr) 260px}.shop-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shop-hero{grid-template-columns:1fr 200px;padding:30px}.shop-import-details{grid-template-columns:120px 1fr}.shop-panel{padding:18px}}
@media(max-width:850px){.shop-workspace{grid-template-columns:1fr}.shop-fitting{position:static;max-width:none}.shop-hero{grid-template-columns:1fr 170px;gap:20px}.shop-hero-note strong{font-size:18px}.shop-album-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shop-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.shop-person-list button{width:75px;height:95px}}
@media(max-width:560px){.shop-view{padding-top:0}.shop-hero{padding:25px 20px;border-radius:20px;grid-template-columns:1fr;margin-bottom:12px}.shop-hero-note{display:none}.shop-hero h1{font-size:29px}.shop-hero-copy>p{font-size:13px}.shop-journey{gap:5px}.shop-journey span{font-size:10px;padding:7px 9px}.shop-tabs{gap:18px;margin-bottom:20px}.shop-tabs button{font-size:12px}.shop-import-details{grid-template-columns:1fr}.shop-image-upload{min-height:125px}.shop-fields{gap:12px}.shop-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.shop-product-image{height:165px!important}.shop-product-info{padding:11px}.shop-album-grid{gap:12px;grid-template-columns:1fr}.shop-section-title{align-items:start}.shop-section-title h2{font-size:21px}.shop-tag{display:none}.shop-login{align-items:start;flex-direction:column;padding:16px}.shop-comparison{padding:10px;gap:6px;overflow:auto}.shop-comparison figcaption{font-size:10px}.shop-result-media{max-height:500px}.shop-metrics{grid-template-columns:repeat(2,1fr)}.shop-modal{padding:24px 18px}.shop-url-row button{padding:10px;font-size:11px}}
@media(max-width:560px){.shop-pending-recovery{grid-template-columns:1fr}.shop-wake-note{margin-top:12px}.shop-triptych{gap:4px}.shop-triptych figcaption{font-size:9px}}
@media(prefers-reduced-motion:reduce){.working{animation:none}.shop-view button{transition:none}}
</style>
<style scoped>
.shop-product{display:flex;flex-direction:column}
.shop-view .shop-product-info{display:flex;flex-direction:column;flex:1;padding:12px}
.shop-product-info h3{margin-bottom:16px}
.shop-product-tools{margin-top:auto}
.shop-product-tools .shop-product-actions{min-height:44px;gap:8px}
.shop-product-tools .shop-secondary-actions{gap:6px;padding-top:10px;margin-top:10px}
.shop-view .shop-product-tools .shop-icon-action{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;min-height:44px;padding:0;border:1px solid var(--shop-line);border-radius:10px;background:transparent;color:var(--shop-ink);text-decoration:none;transition:background .15s ease,color .15s ease,border-color .15s ease}
.shop-view .shop-product-tools .shop-icon-action:hover:not(:disabled){background:var(--shop-pink);border-color:var(--shop-muted)}
.shop-view .shop-product-tools .shop-icon-action[aria-pressed=true]{background:var(--shop-pink);border-color:var(--shop-muted);color:var(--ink)}
.shop-icon-action[aria-pressed=true] :deep(.app-icon){fill:currentColor;fill-opacity:.14}
@media(prefers-reduced-motion:reduce){.shop-view .shop-product-tools .shop-icon-action{transition:none}}
</style>
<style scoped src="@/assets/shop-studio.css"></style>

<style scoped>.community-back{display:inline-block;padding:16px 0}.shop-product-info{min-width:0}.shop-product-info h3{overflow-wrap:anywhere}.shop-product-actions,.shop-secondary-actions{flex-wrap:wrap}
.shop-studio-heading{grid-template-columns:minmax(0,1fr) auto;align-items:center;background:var(--gradient-celebration)}
.shop-studio-heading h1{margin:0}
.studio-account{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0;max-width:100%}
.studio-account-row{display:flex;align-items:center;justify-content:flex-end;gap:4px 18px;flex-wrap:wrap}
.shop-studio-heading .studio-credit-summary{margin:0;padding:0;background:none;border-radius:0;font-size:13px;line-height:1.7;color:var(--ink)}
.studio-points-link{display:inline-flex;align-items:center;gap:6px;min-height:44px;color:var(--ink);font-size:13px;text-decoration:none}
.studio-points-link:hover{text-decoration:underline;text-underline-offset:4px}
.shop-studio-heading .studio-daily-note{font-size:12px;line-height:1.6;max-width:46ch;text-align:right;color:var(--muted)}
@media(max-width:760px){.shop-studio-heading{grid-template-columns:1fr;gap:12px}.studio-account{align-items:flex-start}.studio-account-row{justify-content:flex-start;gap:2px 14px}.shop-studio-heading .studio-daily-note{text-align:left}}
</style>

<style scoped>.garment-source-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.garment-source-tabs button[aria-pressed=true]{background:var(--ink);color:white}.garment-source-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:14px;margin-bottom:24px}.garment-source-grid button{min-width:0;padding:10px}.garment-source-grid img{width:100%;height:150px;object-fit:contain}.garment-source-grid span,.garment-source-grid small{display:block;overflow-wrap:anywhere;margin-top:8px}.selected-person-preview{max-width:240px;margin:20px 0}.selected-person-preview img{width:100%;max-height:320px;object-fit:contain}.selected-person-preview p{font-size:13px}</style>

<style scoped>
.studio-top-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.studio-add-product{display:grid;place-items:center;min-width:44px;min-height:44px;border:1px solid var(--line);border-radius:8px;color:var(--ink)}.studio-top-actions .studio-next{margin:0;padding:0;border:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap}.studio-top-actions .studio-next>div{display:none}.studio-top-actions .studio-next button{display:inline-flex;align-items:center;gap:12px;min-height:44px;white-space:normal;text-align:left}.studio-selected-product>span{flex:1;min-width:0}.studio-selected-product>button{display:grid;place-items:center;flex:none;padding:7px;min-width:36px;min-height:44px;border:0;background:none;color:var(--muted)}.studio-selected-product>button:hover{color:var(--accent);background:var(--accent-pink-soft)}.shop-tone-results{margin:0 0 24px}@media(max-width:700px){.studio-shortlist>.shop-section-title{flex-wrap:wrap}.studio-top-actions{width:100%}.studio-top-actions .studio-next{margin-left:auto}.studio-top-actions .studio-next button{font-size:12px}}
</style>

<style scoped>.studio-sidebar-next{display:grid;gap:12px;margin-top:22px}.studio-sidebar-next button{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:46px}.studio-sidebar-next p{margin:0}</style>
