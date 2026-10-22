<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useClosetStore } from '@/stores/closet';
import { aiGateway, createGenerationId } from '@/services/aiGateway';
import { preprocessPersonImage } from '@/services/imageUpload';
import { prepareClothingImage } from '@/services/clothingMedia';
import { commerceClient, safeCommerceUrl, wardrobeMatches, personalPalette } from '@/services/commerce';
import { locale as language, setLocale, normalizeLocale, t, formatDate } from '@/i18n';

const auth = useAuthStore(); const app = useAppStore(); const closet = useClosetStore();
const route = useRoute(); const router = useRouter();
const token = computed(() => auth.session?.access_token || '');
const tab = ref(['album','community','activity'].includes(route.query.tab) ? route.query.tab : 'wishlist');
const products = ref([]); const jobs = ref([]); const photos = ref([]); const posts = ref([]);
const images = ref({}); const selected = ref([]); const selectedPhoto = ref(''); const consent = ref(false);
const capabilities = ref({ enabled:false, remainingUnits:0, costs:{ try_on:2, skin_tone:20 } });
const metrics = ref(null); const busy = ref(''); const loading = ref(false); const error = ref(''); const notice = ref('');
const form = ref({ title:'', sourceUrl:'', imageUrl:'', imageData:'', category:'upper_body', color:'#c8bba9' });
const productLimit = ref(12); const jobLimit = ref(12); const matchingProduct = ref(null); const showPassed = ref(false);
const shareJob = ref(null); const shareCaption = ref(''); const shareConsent = ref(false);
const purchasedProduct = ref(null);
const step = ref(1); const importMode = ref('link'); const workflowTitle = ref(null);
const steps = computed(() => [t('新增商品'), t('挑選試穿'), t('照片與試穿')]);
const chosenProducts = computed(() => products.value.filter(p => selected.value.includes(p.id)));
async function goStep(value) {
  if (value === 3 && !selected.value.length) return;
  step.value = value;
  await nextTick();
  workflowTitle.value?.focus({preventScroll:true});
}
const submitHint = computed(() => !selected.value.length ? t('選擇至少一件商品，再繼續。') : capabilities.value.remainingUnits < selected.value.length * capabilities.value.costs.try_on ? t('額度不足，請減少本次試穿商品。') : (!selectedPhoto.value || !consent.value) ? t('選擇一張私人照片，並同意本次處理後即可送出。') : '');
const comparisonIds = ref([]); const pendingBatch = ref(null); const sharedPost = ref(null);
let pollTimer; let disposed = false; let sessionVersion = 0;
const urls = new Map(); const loadingImages = new Set();
const categories = computed(() => [['upper_body',t('上衣','Tops')],['lower_body',t('下身','Bottoms')],['full_body',t('連身服飾','Full outfit')],['shoes',t('鞋子','Shoes')],['auto',t('自動辨識','Auto')]]);
const tabs = computed(() => [['wishlist',t('想買清單','Wishlist')],['album',t('私人相簿','Private album')],['community',t('穿搭分享','Style community')],['activity',t('我的購物足跡','My activity')]]);
const visibleProducts = computed(() => products.value.filter((p) => showPassed.value || p.state !== 'dismissed').slice(0,productLimit.value));
const activeJobs = computed(() => jobs.value.filter((j) => ['queued','preparing','submitting','processing'].includes(j.status)));
const albumJobs = computed(() => jobs.value.filter((j) => j.kind === 'try_on').slice(0,jobLimit.value));
const palette = computed(() => personalPalette(jobs.value.find((j) => j.kind === 'skin_tone' && j.status === 'succeeded')?.result_data));
const toneJobs = computed(() => jobs.value.filter((j) => j.kind === 'skin_tone').slice(0,3));
const comparisons = computed(() => jobs.value.filter((j) => comparisonIds.value.includes(j.id)));
const matches = computed(() => matchingProduct.value ? wardrobeMatches(matchingProduct.value, app.items, auth.profileId) : []);
const canSubmit = computed(() => capabilities.value.enabled && capabilities.value.remainingUnits >= selected.value.length * capabilities.value.costs.try_on && selected.value.length && selectedPhoto.value && consent.value && !busy.value);
const jobTitle = (job) => products.value.find((p) => p.id === job.product_id)?.title || t('試穿結果','Try-on result');
const stateLabel = (status) => ({ queued:t('等待中','Queued'), preparing:t('準備圖片','Preparing'), submitting:t('送出中','Submitting'), processing:t('試穿製作中','Processing'), succeeded:t('已完成','Ready'), failed:t('未完成','Failed'), needs_review:t('等待服務核對','Needs review'), cancelled:t('已取消','Cancelled') })[status] || status;
const reasonLabel = (reason) => ({ neutral:t('中性色，容易搭配','A versatile neutral'), tonal:t('相近色系，柔和協調','Similar hues, a soft pairing'), contrast:t('對比色，增加層次','Contrasting hues, more definition'), category:t('可互補的衣物類別','A complementary garment category') })[reason];
const api = (path, body) => commerceClient.request(path, token.value, body);
const login = () => auth.openAuthModal('login', null, '/shop');

function report(err) {
  error.value = t(({ FREE_BUDGET_EXHAUSTED:'免費額度不足，這次沒有送出新的產圖。', NETWORK_UNCERTAIN:'連線中斷，請先更新相簿，再視需要重試同一筆提交。', YOUCAM_DISABLED:'試穿服務尚未開啟。', PHOTO_CONSENT_REQUIRED:'請同意處理選用的照片。', JOB_ALREADY_STARTED:'工作已開始，請等待結果。', INVALID_TITLE:'請填寫商品名稱。', PRODUCT_URL_BLOCKED:'請使用有效的圖片或商品連結。', REMOTE_IMAGE_UNAVAILABLE:'目前無法讀取這個網站，請手動上傳商品圖片。' })[err?.code] || '暫時無法完成，請稍後再試。');
}
async function act(name, action) {
  if (busy.value) return;
  error.value=''; notice.value=''; busy.value=name;
  try { await action(); } catch(err) { report(err); } finally { busy.value=''; }
}
function selectTab(next) { tab.value=next; router.replace({ path:'/shop', query:{ tab:next, lang:language.value } }); }
function toggleProduct(id) {
  if (selected.value.includes(id)) selected.value=selected.value.filter((value)=>value!==id);
  else if (selected.value.length<3) selected.value.push(id);
  else notice.value=t('每批最多選擇 3 件商品。','Choose up to three products per batch.');
  pendingBatch.value=null;
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
  await Promise.all([...visibleProducts.value.map((p)=>p.image_path),...albumJobs.value.map((j)=>j.result_path),...photos.value.slice(0,8).map((p)=>p.path)].filter(Boolean).map(hydrate));
}
async function refreshJobs() {
  if (!auth.isMember) return;
  const version=sessionVersion;
  const [jobData,caps]=await Promise.all([api('jobs'),api('capabilities')]);
  if (disposed || version!==sessionVersion) return;
  jobs.value=jobData.jobs; capabilities.value=caps; await hydrateVisible();
}
async function refresh() {
  if (!auth.isMember) return;
  loading.value=true; const version=sessionVersion;
  try {
    const [productData,photoData]=await Promise.all([api('products'),aiGateway.listPersonPhotos(token.value)]);
    if (disposed || version!==sessionVersion) return;
    products.value=productData.products; photos.value=photoData.photos;
    selectedPhoto.value=photos.value.some((p)=>p.path===selectedPhoto.value) ? selectedPhoto.value : photos.value[0]?.path || '';
    await refreshJobs();
    // The wardrobe store resolves private media through the existing ownership contract.
    await closet.loadRemoteItems(auth.profileId);
    const nextMetrics=await api('metrics');
    if (!disposed && version===sessionVersion) metrics.value=nextMetrics;
  } catch(err) { if (version===sessionVersion) report(err); }
  finally { if(version===sessionVersion) loading.value=false; }
}
async function poll() {
  if(disposed) return;
  if(auth.isMember && !document.hidden) {
    try { await refreshJobs(); } catch { /* Avoid repeated banners for a temporary offline state. */ }
  }
  if(!disposed) pollTimer=setTimeout(poll,15000);
}
async function preview() {
  if(!auth.isMember) return login();
  await act('preview',async()=>{
    const data=await api('preview',{url:form.value.sourceUrl});
    form.value.title=String(data.title || '').slice(0,160);
    form.value.imageUrl=safeCommerceUrl(data.image ? new URL(data.image,data.sourceUrl).href : '');
    form.value.imageData='';
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
  await act('photo',async()=>{
    const image=await preprocessPersonImage(file);
    const photo=await aiGateway.uploadPersonPhoto(token.value,{photoId:createGenerationId(),imageData:image.dataUrl});
    photos.value.unshift(photo); selectedPhoto.value=photo.path; await hydrate(photo.path);
  }); event.target.value='';
}
async function submit(kind='try_on') {
  if(!auth.isMember) return login();
  await act('submit',async()=>{
    const selection={kind,personPath:selectedPhoto.value,productIds:kind==='try_on'?[...selected.value]:[],consent:consent.value};
    const key=JSON.stringify(selection);
    if(!pendingBatch.value || pendingBatch.value.key!==key) pendingBatch.value={ key,id:createGenerationId() };
    await api('jobs',{...selection,batchId:pendingBatch.value.id});
    pendingBatch.value=null; selected.value=[]; step.value=2; await refreshJobs(); selectTab('album');
    notice.value=t('已排入工作池。你可以離開頁面，稍後回相簿查看。','Added to the queue. You can leave and return to your album later.');
  });
}
async function cancel(job) { await act('cancel',async()=>{ await api(`jobs/${job.id}/cancel`,{}); await refreshJobs(); }); }
async function setState(product,state) {
  await act('state',async()=>{ const data=await api(`products/${product.id}/state`,{state}); Object.assign(product,data.product); });
}
async function addPurchasedToCloset(product) {
  await act('closet', async () => {
    await closet.loadRemoteItems(auth.profileId);
    if (closet.dataMode !== 'REMOTE') throw new Error('Wardrobe unavailable');
    // Stable ID makes retries after a lost response resolve to the existing item.
    if (!app.items.some((item) => item.id === product.id && item.owner_id === auth.profileId)) {
      await hydrate(product.image_path);
      const imageUrl = images.value[product.image_path];
      if (!imageUrl) throw new Error('Product image unavailable');
      const image = await (await fetch(imageUrl)).blob();
      const prepared = await prepareClothingImage(new File([image], 'product.jpg', { type: image.type }));
      const result = await closet.addItem({ id: product.id, name: product.title, name_zh: product.title,
        category: ({upper_body:'Tops',lower_body:'Bottoms',full_body:'Dresses',shoes:'Shoes',auto:'Other'})[product.category],
        color_hex: product.color, source_url: product.source_url,
        source_domain: safeCommerceUrl(product.source_url) ? new URL(product.source_url).hostname : '',
        __preparedMedia: prepared });
      if (!result.ok) throw result.error || new Error('Could not save item');
    }
    const data = await api(`products/${product.id}/state`, {state:'purchased'});
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
async function share(post) {
  await act('share',async()=>{
    const url=new URL('/shop',window.location.origin); url.searchParams.set('post',post.id);
    const data={title:`OOTIE · ${post.title}`,text:post.caption,url:url.href};
    if(navigator.share) { try { await navigator.share(data); } catch(err) { if(err.name==='AbortError') return; throw err; } }
    else { await navigator.clipboard.writeText(url.href); notice.value=t('分享連結已複製。','Share link copied.'); }
    track('share_link',{postId:post.id});
  });
}
async function download(job) {
  await hydrate(job.result_path); const url=images.value[job.result_path]; if(!url) return;
  const anchor=document.createElement('a'); anchor.href=url; anchor.download=`ootie-tryon-${job.id}.jpg`; anchor.click();
}
watch(()=>route.query,async(query)=>{
  if(normalizeLocale(query.lang)) setLocale(query.lang);
  if(['wishlist','album','community','activity'].includes(query.tab)) tab.value=query.tab;
  if(query.title) form.value={...form.value,title:String(query.title).slice(0,160),sourceUrl:safeCommerceUrl(query.url),imageUrl:safeCommerceUrl(query.image)};
  if(query.post && /^[\da-f-]{36}$/i.test(query.post)) { tab.value='community'; try { sharedPost.value=(await api(`posts/${query.post}`)).post; } catch(err) { report(err); } }
},{immediate:true});
watch(tab,async(value)=>{ error.value=''; if(value==='community') await loadPosts(); if(value==='activity' && auth.isMember) try {metrics.value=await api('metrics');} catch(err){report(err);} });
watch([productLimit,jobLimit],hydrateVisible);
watch(selectedPhoto,()=>{pendingBatch.value=null;consent.value=false;});
watch(()=>auth.session?.user?.id,async()=>{
  sessionVersion++; products.value=[]; jobs.value=[]; photos.value=[]; selected.value=[]; selectedPhoto.value=''; pendingBatch.value=null; metrics.value=null; matchingProduct.value=null; shareJob.value=null; consent.value=false;
  for(const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); images.value={};
});
watch(()=>auth.isMember,(member)=>{if(member) void refresh();},{immediate:true});
void loadPosts(); pollTimer=setTimeout(poll,15000);
onBeforeUnmount(()=>{disposed=true;sessionVersion++;clearTimeout(pollTimer);for(const url of urls.values()) URL.revokeObjectURL(url);});
</script>

<template>
  <div class="shop-view">
    <header class="shop-studio-heading">
      <div><h1>{{ t('試穿工作室') }}</h1><p>{{ t('先收藏商品，再選照片。完成的試穿會留在私人相簿。') }}</p></div>
      <span class="shop-powered"><AppIcon name="sparkle" :size="16" /> YouCam AI</span>
    </header>

    <nav class="shop-tabs" :aria-label="t('購物試穿功能','Shopping studio')"><button v-for="[key,label] in tabs" :key="key" :class="{active:tab===key}" :aria-current="tab===key?'page':undefined" @click="selectTab(key)">{{ label }}<span v-if="key==='album' && activeJobs.length" class="shop-count">{{ activeJobs.length }}</span></button></nav>
    <p v-if="error" class="shop-message error" role="alert">{{ error }}</p><p v-if="notice" class="shop-message" role="status">{{ notice }}</p>
    <div v-if="!auth.isMember && tab!=='community'" class="shop-login"><p>{{ t('登入後儲存你的商品、私人照片與試穿結果。','Sign in to save products, private photos and try-on results.') }}</p><button class="shop-primary" @click="login">{{ t('登入／註冊','Sign in / Sign up') }}</button></div>

    <section v-if="tab==='wishlist'" class="shop-studio">
      <nav class="studio-steps" :aria-label="t('試穿工作室')">
        <button v-for="(label,index) in steps" :key="label" :class="{active:step===index+1,done:step>index+1}" :aria-current="step===index+1?'step':undefined" :disabled="index===2 && !selected.length" @click="goStep(index+1)"><span>{{ String(index+1).padStart(2,'0') }}</span>{{ label }}<AppIcon v-if="step>index+1" name="check" :size="16" /></button>
      </nav>
      <h2 ref="workflowTitle" class="sr-only" tabindex="-1">{{ steps[step-1] }}</h2>
      <div class="studio-layout" :class="{'studio-layout-wide':step===2}">
        <form v-if="step===1" class="shop-import shop-panel" @submit.prevent="saveProduct">
          <div class="shop-section-title"><h2>{{ t('把喜歡的商品放進來') }}</h2></div>
          <div class="studio-import-method" role="group" :aria-label="t('連結或圖片')"><button type="button" :aria-pressed="importMode==='link'" @click="importMode='link'"><AppIcon name="link" :size="17" />{{ t('貼上連結') }}</button><button type="button" :aria-pressed="importMode==='photo'" @click="importMode='photo'"><AppIcon name="upload" :size="17" />{{ t('上傳圖片') }}</button></div>
          <label v-if="importMode==='link'">{{ t('商品購買連結（可稍後補）') }}<div class="shop-url-row"><input v-model.trim="form.sourceUrl" type="url" placeholder="https://…" maxlength="4096"><button type="button" :disabled="!!busy || !form.sourceUrl" @click="preview">{{ busy==='preview'?t('讀取中…'):t('讀取商品') }}</button></div></label>
          <label v-if="importMode==='photo' || form.imageData" class="shop-image-upload"><img v-if="form.imageData" :src="form.imageData" :alt="t('待加入的商品')"><AppIcon v-else name="upload" :size="30" /><strong>{{ t('上傳商品照片') }}</strong><small>JPG / PNG</small><input type="file" accept="image/jpeg,image/png" :disabled="!!busy" @change="uploadProduct"></label>
          <div class="shop-fields">
            <label>{{ t('商品名稱') }}<input v-model.trim="form.title" required maxlength="160" :placeholder="t('例如：奶油白針織上衣')"></label>
            <div class="shop-field-pair"><label>{{ t('類別') }}<select v-model="form.category"><option v-for="[value,label] in categories" :key="value" :value="value">{{ label }}</option></select></label><label>{{ t('主要顏色') }}<input v-model="form.color" type="color"></label></div>
          </div>
          <details class="studio-details"><summary>{{ t('商品細節') }}</summary><label v-if="importMode==='photo'">{{ t('商品購買連結（可稍後補）') }}<input v-model.trim="form.sourceUrl" type="url" placeholder="https://…" maxlength="4096"></label><label>{{ t('直接使用圖片網址') }}<input v-model.trim="form.imageUrl" type="url" :disabled="!!form.imageData" placeholder="https://…" maxlength="4096"></label></details>
          <p class="shop-hint">{{ t('選擇單件、正面的商品圖。下身試穿請使用真人穿著的參考圖。網站無法讀取時，可以直接上傳照片。') }}</p>
          <div class="studio-form-actions"><button class="shop-primary" :disabled="!!busy || (!form.imageData && !form.imageUrl)">{{ busy==='product'?t('儲存中…'):t('加入想買清單') }}<AppIcon name="arrow" :size="18" /></button><button type="button" @click="goStep(2)">{{ t('查看候選清單') }}<span v-if="products.length"> ({{ products.length }})</span></button></div>
        </form>
        <aside v-if="step===1" class="studio-guide">
          <img src="/assets/ootie-home-hero-v2-720.webp" :alt="t('在明亮衣櫥前挑選柔黃色針織衫的穿搭情境')" width="720" height="1080">
          <div><h3>{{ t('每件新衣，都有更多可能。') }}</h3><p>{{ t('收藏、試穿、搭配，再回到商家做決定。') }}</p></div>
        </aside>
        <section v-if="step===2" class="studio-shortlist">
          <div class="shop-section-title"><div><h2>{{ t('值得再看一眼的心動') }}</h2><p>{{ t('加入後可繼續收藏，或選擇最多三件一起試穿。') }}</p></div><button @click="goStep(1)"><AppIcon name="plus" :size="16" />{{ t('新增商品') }}</button></div>
        <label class="shop-consent"><input v-model="showPassed" type="checkbox">{{ t('顯示先前放下的商品') }}</label><div v-if="!visibleProducts.length" class="shop-empty"><AppIcon name="Shop" :size="34" /><h3>{{ t('第一件心動，從這裡開始','Your first find starts here') }}</h3><p>{{ t('貼上商品連結或上傳照片，挑選最多三件一起比較。','Paste a product link or upload a photo. Compare up to three at a time.') }}</p><button class="shop-primary" @click="goStep(1)">{{ t('新增商品') }}<AppIcon name="plus" :size="16" /></button></div>
        <div v-else class="shop-product-grid">
          <article v-for="product in visibleProducts" :key="product.id" :class="['shop-product',{selected:selected.includes(product.id)}]">
            <button class="shop-product-image" :aria-pressed="selected.includes(product.id)" :aria-label="`${t('選擇試穿','Select for try-on')} ${product.title}`" @click="toggleProduct(product.id)"><img v-if="images[product.image_path]" :src="images[product.image_path]" :alt="product.title" loading="lazy"><span v-else class="shop-image-placeholder">{{ t('商品照片','Product photo') }}</span><span class="shop-select-mark">{{ selected.includes(product.id)?'✓':'＋' }}</span></button>
            <div class="shop-product-info"><small>{{ product.state==='dismissed'?t('已放下'):product.state==='purchased'?t('已購買','Purchased'):product.state==='kept'?t('保留候選','Shortlisted'):t('想買','Wishlist') }}</small><h3>{{ product.title }}</h3><div class="shop-product-actions"><button @click="matchingProduct=product">{{ t('搭我的衣櫥','Pair with mine') }}</button><a v-if="safeCommerceUrl(product.source_url)" :href="safeCommerceUrl(product.source_url)" target="_blank" rel="noopener noreferrer" @click="track('purchase_click',{productId:product.id})">{{ t('前往購買 ↗','Shop ↗') }}</a></div><div class="shop-secondary-actions"><button v-if="product.state==='dismissed'" :disabled="!!busy" @click="setState(product,'wishlist')">{{ t('放回想買清單') }}</button><button :disabled="!!busy" @click="setState(product,'kept')">{{ t('保留','Keep') }}</button><button :disabled="!!busy" @click="setState(product,'dismissed')">{{ t('先放下','Pass') }}</button><button :disabled="!!busy" @click="purchasedProduct=product">{{ t('買到了，加入衣櫥','Bought it') }}</button></div></div>
          </article>
        </div><button v-if="products.filter(p=>showPassed || p.state!=='dismissed').length>productLimit" class="shop-load-more" @click="productLimit+=12">{{ t('顯示更多','Show more') }}</button>

          <div class="studio-next"><div><strong>{{ selected.length }} / 3</strong><span>{{ t('件候選商品') }}</span><p v-if="!selected.length" class="shop-hint">{{ t('選擇至少一件商品，再繼續。') }}</p></div><button class="shop-primary" :disabled="!selected.length" @click="goStep(3)">{{ t('繼續：選擇照片') }}<AppIcon name="arrow" :size="18" /></button></div>
        </section>
        <section v-if="step===3" class="shop-fitting shop-panel">
        <h2>{{ t('把想像穿上身','See it on you') }}</h2><p>{{ t('選擇本人的單人正面照，讓身體與衣物清楚入鏡。','Choose your own front-facing photo, with your body and clothing clearly visible.') }}</p>
        <label class="shop-person-upload">＋ {{ busy==='photo'?t('處理照片中…','Preparing photo…'):t('上傳私人照片','Add a private photo') }}<input type="file" accept="image/jpeg,image/png" :disabled="!auth.isMember || !!busy" @change="uploadPerson"></label>
        <div class="shop-person-list"><button v-for="photo in photos.slice(0,8)" :key="photo.path" :class="{selected:selectedPhoto===photo.path}" :aria-pressed="selectedPhoto===photo.path" :aria-label="t('選用這張照片','Use this photo')" @click="selectedPhoto=photo.path"><img v-if="images[photo.path]" :src="images[photo.path]" :alt="t('我的私人照片','My private photo')"><span v-else>{{ t('照片','Photo') }}</span></button></div>
        <label class="shop-consent"><input v-model="consent" type="checkbox"><span>{{ t('我有權使用選用的照片，同意傳送至 YouCam 進行這次試穿或色彩分析。原始照片保持私人。','I have permission to use this photo and consent to sending it to YouCam for this try-on or color analysis. The original stays private.') }}</span></label>
        <div class="shop-selection-summary"><strong>{{ selected.length }} / 3</strong><span>{{ t('件候選商品','selected products') }}</span><small>{{ selected.length * capabilities.costs.try_on }} {{ t('額度') }}</small></div>
        <p v-if="submitHint" id="submit-hint" class="shop-hint">{{ submitHint }}</p><button :aria-describedby="submitHint ? 'submit-hint' : undefined" class="shop-primary shop-wide" :disabled="!canSubmit" @click="submit()">{{ busy==='submit'?t('加入工作池…','Adding to queue…'):t('送出試穿工作','Queue try-ons') }}</button>
        <p v-if="auth.isMember && !capabilities.enabled" class="shop-hint">{{ t('試穿尚未開放或免費額度不足，仍可整理商品與搭配。','Try-on is not available or free credits are exhausted. You can still organize and pair products.') }}</p>
        <p class="shop-hint">{{ t('送出後可離開頁面，完成的圖片會保存在私人相簿。AI 圖片僅供視覺參考，尺寸請查看商品資訊。','Leave the page after submitting; results will appear in your private album. AI previews illustrate a look, not sizing or fit.') }}</p>
        <details class="shop-tone"><summary>{{ t('額外配色靈感（選用）') }}</summary><span class="shop-eyebrow">{{ t('個人色彩筆記') }}</span><h3>{{ t('讓配色多一點個人感','Make color personal') }}</h3><p>{{ t('色彩分析請選用光線均勻、臉部清晰的正面近照。分析一次，後續搭配沿用結果。','For color analysis, select a well-lit, close-up portrait. Reuse your result for future pairings.') }}</p><button :disabled="!capabilities.enabled || !selectedPhoto || !consent || !!busy || capabilities.remainingUnits<20" @click="submit('skin_tone')">{{ t('分析選用照片的色彩','Analyze selected portrait') }} · 20 {{ t('額度') }}</button><div v-if="palette.length" class="shop-palette"><div v-for="color in palette" :key="color.key"><i :style="{background:color.color}"></i><span>{{ color.key==='soft'?t('柔和','Soft'):color.key==='contrast'?t('對比','Contrast'):t('中性','Neutral') }}</span></div></div><small>{{ t('這些是可自由選擇的配色靈感，不是四季色彩鑑定。','These are optional color ideas, not a seasonal color diagnosis.') }}</small></details>

        </section>
        <aside v-if="step===3" class="studio-selection"><h3>{{ t('這次選擇') }} <span>{{ selected.length }} / 3</span></h3><div v-for="product in chosenProducts" :key="product.id" class="studio-selected-product"><img v-if="images[product.image_path]" :src="images[product.image_path]" :alt="product.title"><span>{{ product.title }}</span></div><button @click="goStep(2)"><AppIcon name="back" :size="16" />{{ t('返回商品清單') }}</button><p class="shop-hint"><AppIcon name="lock" :size="14" /> {{ t('照片只屬於你，分享由你決定。') }}</p></aside>
      </div>
    </section>

    <section v-else-if="tab==='album'" class="shop-album">
      <div class="shop-section-title"><div><span class="shop-eyebrow">{{ t('私人收藏') }}</span><h2>{{ t('先看見，再決定','See it. Then decide.') }}</h2><p>{{ t('工作進度會自動更新。選取最多三張完成結果，並排比較。','Progress updates automatically. Select up to three finished results to compare.') }}</p></div><button :disabled="loading" @click="refresh">{{ t('更新進度','Refresh') }}</button></div>
      <div v-if="comparisons.length" class="shop-comparison"><figure v-for="job in comparisons" :key="job.id"><img :src="images[job.result_path]" :alt="jobTitle(job)"><figcaption>{{ jobTitle(job) }}</figcaption></figure></div>
      <div v-if="!albumJobs.length && !toneJobs.length" class="shop-empty"><AppIcon name="album" :size="34" /><h3>{{ t('你的試穿相簿還在等第一張照片','Your album is waiting for its first look') }}</h3><button @click="selectTab('wishlist')">{{ t('去挑選商品','Choose products') }} →</button></div>
      <div class="shop-album-grid"><article v-for="job in albumJobs" :key="job.id" class="shop-result shop-panel"><div class="shop-result-media"><img v-if="job.result_path && images[job.result_path]" :src="images[job.result_path]" :alt="jobTitle(job)" loading="lazy"><div v-else class="shop-job-placeholder"><AppIcon name="sparkle" :size="34" :class="{working:['preparing','submitting','processing'].includes(job.status)}" /><strong>{{ stateLabel(job.status) }}</strong></div><span class="shop-job-state">{{ stateLabel(job.status) }}</span></div><small>{{ t('批次','Batch') }} {{ job.batch_id.slice(0,8) }} · {{ formatDate(job.created_at,{dateStyle:'medium',timeStyle:'short'}) }}</small><h3>{{ jobTitle(job) }}</h3><p v-if="['needs_review','failed'].includes(job.status)" class="shop-hint">{{ job.status==='needs_review'?t('服務正在核對這筆工作，請勿重送相同生成。','The service must reconcile this job. Please do not submit it again.'):t('這次未能完成，請檢查人物照與商品圖。','This job did not finish. Please check the portrait and garment image.') }}</p><div v-if="job.status==='succeeded'" class="shop-result-actions"><button :aria-pressed="comparisonIds.includes(job.id)" @click="compare(job)">{{ comparisonIds.includes(job.id)?'✓ ':'' }}{{ t('比較','Compare') }}</button><button @click="download(job)">{{ t('下載','Download') }}</button><button @click="shareJob=job;shareCaption='';shareConsent=false">{{ t('分享穿搭','Share look') }}</button></div><button v-if="job.status==='queued'" :disabled="!!busy" @click="cancel(job)">{{ t('取消等待','Cancel queued job') }}</button><small v-if="job.status==='succeeded'" class="shop-hint">{{ t('YouCam AI 試穿模擬','YouCam AI try-on simulation') }}</small></article></div>
      <button v-if="jobs.filter(j=>j.kind==='try_on').length>jobLimit" class="shop-load-more" @click="jobLimit+=12">{{ t('顯示更多','Show more') }}</button>
      <div v-if="toneJobs.length" class="shop-panel shop-tone-results"><h3>{{ t('個人色彩分析','Personal color analysis') }}</h3><p v-for="job in toneJobs" :key="job.id">{{ stateLabel(job.status) }} · {{ formatDate(job.created_at,{dateStyle:'medium'}) }} <span v-if="job.result_data?.skin_color" class="shop-skin-swatch" :style="{background:job.result_data.skin_color}"></span></p><div class="shop-palette"><div v-for="color in palette" :key="color.key"><i :style="{background:color.color}"></i><span>{{ t({soft:'柔和',contrast:'對比',neutral:'中性'}[color.key]) }}</span></div></div></div>
    </section>

    <section v-else-if="tab==='community'">
      <div class="shop-section-title"><div><span class="shop-eyebrow">{{ t('好物分享') }}</span><h2>{{ t('心動，也可以一起討論','Good finds are better shared') }}</h2><p>{{ t('由使用者主動公開的 AI 試穿，每張都能回到商品來源。','AI try-ons deliberately shared by their owners, linked to the original product.') }}</p></div><button @click="loadPosts">{{ t('重新整理','Refresh') }}</button></div>
      <div v-if="!posts.length && !sharedPost" class="shop-empty"><AppIcon name="Explore" :size="34" /><h3>{{ t('成為第一位分享穿搭的人','Share the first look') }}</h3><p>{{ t('試穿完成後，在私人相簿選擇你願意公開的一張。','After a try-on finishes, choose one result from your album to publish.') }}</p></div>
      <div class="shop-album-grid"><article v-for="post in sharedPost?[sharedPost,...posts.filter(p=>p.id!==sharedPost.id)]:posts" :key="post.id" class="shop-result shop-panel"><img class="shop-shared-image" :src="post.image_url" :alt="post.title" loading="lazy"><small>OOTIE × YouCam · {{ t('AI 試穿','AI try-on') }}</small><h3>{{ post.title }}</h3><p class="shop-caption">{{ post.caption }}</p><div class="shop-product-actions"><a v-if="safeCommerceUrl(post.source_url)" :href="safeCommerceUrl(post.source_url)" target="_blank" rel="noopener noreferrer" @click="track('purchase_click',{postId:post.id})">{{ t('查看商品 ↗','View product ↗') }}</a><button :disabled="!!busy" @click="share(post)">{{ t('分享連結','Share link') }}</button></div></article></div>
    </section>

    <section v-else-if="tab==='activity'" class="shop-panel"><h2>{{ t('從心動到行動','From discovery to action') }}</h2><div v-if="metrics" class="shop-metrics"><div><strong>{{ metrics.products }}</strong><span>{{ t('收藏商品','Saved products') }}</span></div><div><strong>{{ metrics.completedTryOns }}</strong><span>{{ t('完成試穿','Completed try-ons') }}</span></div><div><strong>{{ metrics.purchaseClicks }}</strong><span>{{ t('購買連結點擊','Product link clicks') }}</span></div><div><strong>{{ metrics.shareActions }}</strong><span>{{ t('分享操作','Share actions') }}</span></div></div><p>{{ t('呈現你最近 200 件商品／工作與 1,000 次操作。購買連結點擊不等於已成交；尚未追蹤退貨或實際營收。','Shows your most recent 200 products/jobs and 1,000 actions. Clicks are not confirmed purchases; returns and revenue are not tracked.') }}</p><p>{{ t('免費額度用於試穿及選用的配色分析，沒有付款或自動加值。','Free credits fund try-ons and optional color analysis. No payments or automatic top-ups.') }}</p></section>

    <div v-if="purchasedProduct" class="shop-modal-backdrop" @click.self="!busy && (purchasedProduct=null)"><section class="shop-modal" role="dialog" aria-modal="true" :aria-label="t('確認已購買')" v-accessible-modal><button class="shop-modal-close modal-close" :disabled="!!busy" @click="purchasedProduct=null" :aria-label="t('關閉')">×</button><h2>{{ t('確認已購買') }}</h2><p>{{ purchasedProduct.title }}</p><p>{{ t('確認你已擁有這件商品，將照片與名稱加入衣櫥。') }}</p><button class="shop-primary" :disabled="!!busy" @click="addPurchasedToCloset(purchasedProduct)">{{ busy==='closet'?t('加入衣櫥中…'):t('完成並加入衣櫥') }}</button></section></div>
    <div v-if="matchingProduct" class="shop-modal-backdrop" @click.self="matchingProduct=null"><section class="shop-modal" role="dialog" aria-modal="true" :aria-label="t('衣櫥搭配','Wardrobe pairings')" v-accessible-modal="{onClose:()=>matchingProduct=null}"><button class="shop-modal-close modal-close" @click="matchingProduct=null" :aria-label="t('關閉','Close')">×</button><span class="shop-eyebrow">{{ t('已在你的衣櫥中') }}</span><h2>{{ t('和這些舊愛一起穿','Pair it with pieces you own') }}</h2><p>{{ matchingProduct.title }}</p><div v-if="matches.length" class="shop-match-list"><article v-for="match in matches" :key="match.item.id"><img v-if="match.item.photo" :src="match.item.photo" :alt="match.item.name_zh || match.item.name"><div><h3>{{ match.item.name_zh || match.item.name }}</h3><p>{{ reasonLabel(match.reason) }}</p></div></article></div><p v-else>{{ t('還沒有合適的衣物資料。先加入幾件自己的衣服，再來看看搭配。','No complementary wardrobe pieces yet. Add a few items you own and try again.') }}</p><p class="shop-hint">{{ t('依衣物分類與你填寫的顏色提供搭配靈感，可依個人喜好調整。','Pairing ideas use garment categories and saved colors. Your preferences come first.') }}</p><router-link to="/closet" @click="matchingProduct=null">{{ t('查看我的衣櫥','Open my wardrobe') }} →</router-link></section></div>
    <div v-if="shareJob" class="shop-modal-backdrop" @click.self="shareJob=null"><form class="shop-modal" role="dialog" aria-modal="true" :aria-label="t('公開分享試穿','Publish try-on')" v-accessible-modal="{onClose:()=>shareJob=null}" @submit.prevent="publish"><button type="button" class="shop-modal-close modal-close" @click="shareJob=null" :aria-label="t('關閉','Close')">×</button><h2>{{ t('分享這張穿搭','Share this look') }}</h2><img class="shop-share-preview" :src="images[shareJob.result_path]" :alt="jobTitle(shareJob)"><label>{{ t('想和大家說什麼？','What would you like to share?') }}<textarea v-model="shareCaption" maxlength="800" rows="3"></textarea></label><label class="shop-consent"><input v-model="shareConsent" type="checkbox" required><span>{{ t('我同意公開這張 AI 試穿結果、文字與商品連結，讓任何人都能查看。原始人物照與其他私人相簿不公開。','I agree to publish this AI try-on image, caption and product link for anyone to view. My original photo and other private results stay private.') }}</span></label><button class="shop-primary" :disabled="!shareConsent || !!busy">{{ busy==='publish'?t('發布中…','Publishing…'):t('確認公開發布','Publish this look') }}</button></form></div>
  </div>
</template>

<style scoped>
.shop-view{--shop-ink:#35312e;--shop-muted:#766d66;--shop-line:#e7ded4;--shop-pink:#f6d9df;--shop-cream:#fffaf3;color:var(--shop-ink);max-width:1400px;margin:auto;padding:8px 0 56px}.shop-view button,.shop-view input,.shop-view select,.shop-view textarea{font:inherit}.shop-view button{cursor:pointer;border:1px solid var(--shop-line);background:#fffdf9;color:var(--shop-ink);border-radius:12px;padding:10px 14px;transition:background .15s,transform .15s}.shop-view button:hover:not(:disabled){background:#f8e9e7}.shop-view button:disabled{opacity:.48;cursor:not-allowed}.shop-view :focus-visible{outline:3px solid #6d8d9c;outline-offset:3px}.shop-view a{color:#57453f;text-underline-offset:4px}.shop-view h2{font-size:23px;margin:7px 0 12px;letter-spacing:-.6px}.shop-view h3{font-size:16px;line-height:1.5;margin:8px 0}.shop-view p{line-height:1.75}.shop-view label{display:block;font-size:13px;font-weight:600}.shop-view input:not([type=checkbox]):not([type=file]),.shop-view select,.shop-view textarea{width:100%;border:1px solid var(--shop-line);border-radius:10px;background:#fff;padding:12px;box-sizing:border-box;margin-top:7px;color:var(--shop-ink);min-height:44px}.shop-view input[type=color]{padding:5px!important}.shop-view input[type=checkbox]{accent-color:#78534e;width:18px;height:18px;flex-shrink:0}.shop-view .shop-primary{background:#433934;color:#fff;border-color:#433934;font-weight:600}.shop-view .shop-primary:hover:not(:disabled){background:#67504a}.shop-hero{display:grid;grid-template-columns:1fr 250px;gap:40px;background:var(--shop-cream);border:1px solid var(--shop-line);border-radius:28px;padding:40px 44px;margin-bottom:24px;overflow:hidden}.shop-kicker,.shop-eyebrow{font-size:10px;letter-spacing:2px;font-weight:700;color:#7f635b}.shop-kicker{display:flex;align-items:center;gap:18px}.shop-view .language-toggle{padding:5px 9px;border-radius:7px;font-size:11px}.shop-hero h1{font-size:clamp(28px,3.2vw,46px);line-height:1.4;letter-spacing:-1.5px;margin:20px 0 14px;font-weight:650}.shop-hero h1 em{font-style:normal;color:#8d5c58}.shop-hero-copy>p{color:var(--shop-muted);max-width:550px;font-size:14px;margin:0}.shop-journey{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.shop-journey span{padding:8px 12px;background:#fff;border:1px solid #ede4da;border-radius:99px;font-size:11px}.shop-hero-note{align-self:center;background:#f4e4c2;border-radius:120px 120px 16px 16px;padding:30px 24px 25px;transform:rotate(3deg);text-align:center;box-shadow:8px 9px 0 #f6dce1}.shop-note-star{display:block;font-size:36px;color:#8d6752;margin-bottom:12px}.shop-hero-note strong{font-size:22px;line-height:1.7}.shop-hero-note p{font-size:11px;margin-top:16px}.shop-color-dots{display:flex;justify-content:center;margin-top:18px}.shop-color-dots i{width:22px;height:22px;border-radius:50%;background:#ead0cd;border:2px solid #fff;margin-left:-5px}.shop-color-dots i:nth-child(2){background:#a4b9c7}.shop-color-dots i:nth-child(3){background:#725b51}.shop-tabs{display:flex;border-bottom:1px solid var(--shop-line);gap:20px;margin-bottom:28px;overflow:auto}.shop-tabs button{border:0;border-radius:0;white-space:nowrap;padding:14px 2px;background:transparent;color:var(--shop-muted);font-size:14px;position:relative}.shop-tabs button.active{color:#774f49;font-weight:700;border-bottom:3px solid #bc837e}.shop-count{display:inline-grid;place-items:center;margin-left:7px;background:var(--shop-pink);border-radius:20px;min-width:20px;height:20px;font-size:10px}.shop-message{border-radius:12px;padding:14px 18px;background:#eef2e8;color:#445c40;font-size:14px}.shop-message.error{background:#fbe5e2;color:#893e37}.shop-login{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:18px 22px;background:#f5ece6;border-radius:16px;margin-bottom:22px}.shop-login p{font-size:14px;margin:0}.shop-workspace{display:grid;grid-template-columns:minmax(0,1fr) 290px;align-items:start;gap:24px}.shop-panel{border:1px solid var(--shop-line);border-radius:20px;background:#fffefb;padding:24px}.shop-section-title{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:18px}.shop-section-title p{font-size:13px;color:var(--shop-muted);margin:0}.shop-tag{font-size:10px;border:1px solid var(--shop-line);border-radius:30px;padding:7px 10px;white-space:nowrap}.shop-url-row{display:flex;align-items:end;gap:8px}.shop-url-row button{white-space:nowrap;height:44px;font-size:12px}.shop-import-details{display:grid;grid-template-columns:150px 1fr;gap:18px;margin-top:20px}.shop-image-upload{border:1px dashed #cdbbb0;border-radius:14px;background:#f8f2eb;min-height:200px;display:flex!important;flex-direction:column;align-items:center;justify-content:center;padding:10px;cursor:pointer;text-align:center;overflow:hidden;position:relative}.shop-image-upload>span{font-size:40px;font-weight:300;color:#9e7c70}.shop-image-upload img{width:100%;height:145px;object-fit:contain}.shop-image-upload strong{font-size:12px;margin:8px 0}.shop-image-upload small{color:var(--shop-muted);font-size:10px}.shop-image-upload input,.shop-person-upload input{position:absolute;opacity:0;width:100%;height:100%;inset:0;cursor:pointer}.shop-fields{display:grid;gap:13px}.shop-field-pair{display:grid;grid-template-columns:1fr 80px;gap:12px}.shop-hint{font-size:11px!important;color:var(--shop-muted);line-height:1.8;display:block}.shop-import>.shop-primary{margin-top:5px}.shop-list-heading{margin:30px 0 16px}.shop-list-heading button{font-size:11px}.shop-empty{padding:42px 20px;text-align:center;border:1px dashed var(--shop-line);border-radius:20px;background:#fcf8f2}.shop-empty>span{font-size:38px;color:#ad8d80}.shop-empty p{font-size:13px;color:var(--shop-muted);max-width:420px;margin:auto}.shop-empty button{margin-top:15px}.shop-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.shop-product{border:1px solid var(--shop-line);border-radius:16px;overflow:hidden;background:#fffefb}.shop-product.selected{border:2px solid #b78078}.shop-view .shop-product-image{position:relative;padding:10px;border:0;border-radius:0;width:100%;height:190px;background:#f5f0e9;display:grid;place-items:center}.shop-product-image img{width:100%;height:100%;object-fit:contain}.shop-image-placeholder{font-size:11px;color:var(--shop-muted)}.shop-select-mark{position:absolute;right:10px;top:10px;background:#fff;border:1px solid var(--shop-line);border-radius:50%;width:26px;height:26px;display:grid;place-items:center}.selected .shop-select-mark{background:#a6746d;color:#fff}.shop-product-info{padding:13px}.shop-product-info>small{font-size:10px;color:#9b7267}.shop-product-info h3{font-size:13px;overflow-wrap:anywhere}.shop-product-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:12px}.shop-product-actions button{padding:7px 9px;font-size:11px}.shop-secondary-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px;border-top:1px solid #efe7df;padding-top:10px}.shop-secondary-actions button{border:0;padding:0;background:none;font-size:10px;color:var(--shop-muted)}.shop-fitting{position:sticky;top:22px}.shop-fitting>p,.shop-tone p{font-size:12px;color:var(--shop-muted)}.shop-person-upload{position:relative;text-align:center;border:1px dashed #bda99e;border-radius:12px;padding:16px 8px;margin:18px 0;overflow:hidden}.shop-person-list{display:flex;gap:8px;overflow:auto;margin-bottom:16px}.shop-person-list button{flex-shrink:0;width:65px;height:83px;padding:2px;overflow:hidden}.shop-person-list img{width:100%;height:100%;object-fit:cover;border-radius:8px}.shop-person-list .selected{border:2px solid #9c6b63}.shop-consent{display:flex!important;align-items:start;gap:9px;font-size:11px!important;line-height:1.7;font-weight:400!important;margin:16px 0}.shop-consent input{margin-top:1px}.shop-selection-summary{display:flex;align-items:center;gap:8px;background:#f8eee8;border-radius:10px;padding:12px;margin-top:20px;font-size:11px}.shop-selection-summary strong{font-size:20px}.shop-selection-summary small{margin-left:auto}.shop-wide{width:100%;margin-top:10px}.shop-tone{border-top:1px solid var(--shop-line);padding-top:22px;margin-top:24px}.shop-tone button{font-size:11px;padding:10px}.shop-tone small{display:block;color:var(--shop-muted);font-size:10px;line-height:1.7;margin-top:12px}.shop-palette{display:flex;gap:18px;margin-top:18px}.shop-palette div{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10px}.shop-palette i{width:36px;height:36px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--shop-line)}.shop-album-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.shop-result{padding:15px;overflow:hidden}.shop-result-media{position:relative;aspect-ratio:3/4;background:#f4eee6;border-radius:12px;overflow:hidden;margin-bottom:12px}.shop-result-media img{width:100%;height:100%;object-fit:contain}.shop-job-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#9b8170;font-size:13px}.shop-job-placeholder>span{font-size:45px}.working{animation:shop-breathe 2s ease-in-out infinite}.shop-job-state{position:absolute;bottom:10px;left:10px;background:#fffcf3e8;border:1px solid #e6d8cc;border-radius:30px;padding:6px 12px;font-size:10px}.shop-result>small{font-size:10px;color:var(--shop-muted)}.shop-result-actions{display:flex;gap:6px;flex-wrap:wrap}.shop-result-actions button{font-size:11px;padding:8px}.shop-result-actions button[aria-pressed=true]{background:var(--shop-pink)}.shop-comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;background:#f7eae7;padding:20px;border-radius:20px;margin-bottom:24px}.shop-comparison figure{margin:0}.shop-comparison img{width:100%;aspect-ratio:3/4;object-fit:contain;background:#fff;border-radius:10px}.shop-comparison figcaption{font-size:12px;text-align:center;padding:8px}.shop-tone-results{margin-top:22px}.shop-skin-swatch{display:inline-block;width:20px;height:20px;border-radius:50%;vertical-align:middle}.shop-shared-image{width:100%;aspect-ratio:3/4;object-fit:contain;background:#f8f2ea;border-radius:12px;margin-bottom:12px}.shop-caption{font-size:13px;white-space:pre-line;overflow-wrap:anywhere}.shop-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}.shop-metrics>div{display:flex;flex-direction:column;gap:8px;background:#f7eee7;padding:20px;border-radius:14px}.shop-metrics strong{font-size:30px}.shop-metrics span{font-size:12px}.shop-load-more{display:block;margin:24px auto}.shop-modal-backdrop{position:fixed;inset:0;background:#332a2566;backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}.shop-modal{background:#fffaf3;border-radius:24px;padding:30px;max-width:520px;width:100%;max-height:85vh;overflow:auto;position:relative;box-shadow:0 24px 80px #2a221c30}.shop-modal-close{position:absolute;right:15px;top:15px;padding:3px 11px!important;font-size:24px!important}.shop-match-list article{display:flex;gap:16px;align-items:center;background:#fff;border:1px solid var(--shop-line);border-radius:12px;padding:12px;margin:10px 0}.shop-match-list img{width:80px;height:85px;object-fit:contain}.shop-match-list p{font-size:12px;margin:0}.shop-share-preview{height:220px;max-width:100%;object-fit:contain;display:block;margin:14px auto}.shop-modal textarea{resize:vertical}.shop-modal h2{padding-right:25px}
@keyframes shop-breathe{50%{opacity:.4;transform:scale(.9)}}
@media(max-width:1150px){.shop-workspace{grid-template-columns:minmax(0,1fr) 260px}.shop-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shop-hero{grid-template-columns:1fr 200px;padding:30px}.shop-import-details{grid-template-columns:120px 1fr}.shop-panel{padding:18px}}
@media(max-width:850px){.shop-workspace{grid-template-columns:1fr}.shop-fitting{position:static;max-width:none}.shop-hero{grid-template-columns:1fr 170px;gap:20px}.shop-hero-note strong{font-size:18px}.shop-album-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shop-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.shop-person-list button{width:75px;height:95px}}
@media(max-width:560px){.shop-view{padding-top:0}.shop-hero{padding:25px 20px;border-radius:20px;grid-template-columns:1fr;margin-bottom:12px}.shop-hero-note{display:none}.shop-hero h1{font-size:29px}.shop-hero-copy>p{font-size:13px}.shop-journey{gap:5px}.shop-journey span{font-size:10px;padding:7px 9px}.shop-tabs{gap:18px;margin-bottom:20px}.shop-tabs button{font-size:12px}.shop-import-details{grid-template-columns:1fr}.shop-image-upload{min-height:125px}.shop-fields{gap:12px}.shop-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.shop-product-image{height:165px!important}.shop-product-info{padding:11px}.shop-album-grid{gap:12px;grid-template-columns:1fr}.shop-section-title{align-items:start}.shop-section-title h2{font-size:21px}.shop-tag{display:none}.shop-login{align-items:start;flex-direction:column;padding:16px}.shop-comparison{padding:10px;gap:6px;overflow:auto}.shop-comparison figcaption{font-size:10px}.shop-result-media{max-height:500px}.shop-metrics{grid-template-columns:repeat(2,1fr)}.shop-modal{padding:24px 18px}.shop-url-row button{padding:10px;font-size:11px}}
@media(prefers-reduced-motion:reduce){.working{animation:none}.shop-view button{transition:none}}
</style>
<style scoped src="@/assets/shop-studio.css"></style>
