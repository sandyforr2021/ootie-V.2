<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { aiGateway } from '@/services/aiGateway';
import { categoryFamily, commerceClient, safeCommerceUrl } from '@/services/commerce';
import { preprocessPersonImage } from '@/services/imageUpload';
import { t } from '@/i18n';
import { categories as closetCategories, labels } from '@/constants';
import ExtensionGuide from '@/components/bookmarks/ExtensionGuide.vue';
import WardrobeRack from '@/components/closet/WardrobeRack.vue';
import WardrobeCutout from '@/components/closet/WardrobeCutout.vue';

defineProps({toolbarTarget:{type:String,default:''}});
const auth = useAuthStore(), route = useRoute(), router = useRouter();
const appStore = useAppStore();
const token = computed(() => auth.session?.access_token || '');
const items = ref([]), images = ref({}), loading = ref(false), busy = ref(false), error = ref('');
const modalOpen = ref(false), guideOpen = ref(false), manual = ref(false), mode = ref('link');
const searchQuery = ref(''), activeCategory = ref('All'), closetView = ref('cards');
const emptyForm = () => ({ title:'', sourceUrl:'', imageUrl:'', imageData:'', category:'upper_body', color:'#c8bba9' });
const form = ref(emptyForm());
const urls = new Map(); let generation = 0; let identityVersion = 0;
const itemFamily = item => item.outfit_layer === 'outer' ? 'outer' : categoryFamily(item.category);
const filterCategories = computed(() => closetCategories.filter(category => category !== 'Bags'));
const visibleItems = computed(() => {
  const query = searchQuery.value.toLocaleLowerCase('zh-Hant');
  return items.value.filter(item => {
    const categoryMatch = activeCategory.value === 'All' || itemFamily(item) === ({
      Tops: 'upper_body', Bottoms: 'lower_body', Dress: 'full_body', Outerwear: 'outer',
      Shoes: 'shoes', Accessories: 'accessory'
    })[activeCategory.value];
    const text = [item.title, item.source_url, item.category].filter(Boolean).join(' ').toLocaleLowerCase('zh-Hant');
    return categoryMatch && (!query || text.includes(query));
  });
});
const rackItems = computed(() => visibleItems.value.map(item => ({
  ...item,
  category: item.outfit_layer === 'outer' ? 'outer' : item.category,
  name: item.title,
  name_zh: item.title,
  photo: images.value[item.image_path] || '',
  owner_id: auth.profileId
})));
const currentIdentity = () => ({ version: identityVersion, userId:auth.session?.user?.id, accessToken:token.value });
const isCurrent = (identity) => identity.version === identityVersion && identity.userId === auth.session?.user?.id;
const ready = () => auth.isMember && !!token.value && auth.user?.id === auth.session?.user?.id && (!auth.profileIdentity?.authUserId || auth.profileIdentity.authUserId === auth.session?.user?.id);
const api = (path, body, accessToken=token.value) => commerceClient.request(path, accessToken, body);
function publishItems() {
  appStore.wishlistProducts = items.value.map(item => ({ ...item, photo: images.value[item.image_path] || '' }));
}
const login = () => auth.openAuthModal('login', null, route.fullPath);
function openDetail(id) {
  appStore.wishlistProducts = items.value.map(item => ({ ...item, photo: images.value[item.image_path] || '' }));
  appStore.selectedItemId = id;
  appStore.isDetailOpen = true;
}
function closeForm() {
  modalOpen.value = false;
  if (route.query.quick || route.query.title) void router.replace({path:'/closet',query:{tab:'wishlist',lang:route.query.lang}});
}
async function hydrate(path, current) {
  if (!path || urls.has(path)) return;
  try {
    const url = await aiGateway.loadPrivateImage(token.value,path);
    if (current !== generation) { URL.revokeObjectURL(url); return; }
    urls.set(path,url); images.value = { ...images.value, [path]: url };
  } catch { /* Keep the item available even if its image cannot be loaded. */ }
}
async function load() {
  if (!ready()) return;
  const current = ++generation; const identity = currentIdentity(); loading.value = true; error.value = '';
  try {
    const data = await api('products', undefined, identity.accessToken);
    if (current !== generation || !isCurrent(identity)) return;
    items.value = (data.products || []).filter(item => !['dismissed','purchased','tryon_only'].includes(item.state));
    await Promise.all(items.value.map(item => hydrate(item.image_path,current)));
    if (current === generation && isCurrent(identity)) publishItems();
  } catch { if (current === generation) error.value = t('想買清單暫時無法載入。'); }
  finally { if (current === generation) loading.value = false; }
}
function openForm() { if (!auth.isMember) return login(); modalOpen.value = true; error.value = ''; }
async function previewLink() {
  if (!form.value.sourceUrl || busy.value || !ready()) return;
  const identity = currentIdentity();
  busy.value = true; error.value = '';
  try {
    const data = await api('preview', {url:form.value.sourceUrl}, identity.accessToken);
    if (!isCurrent(identity)) return;
    form.value.title = String(data.title || '').slice(0,160);
    form.value.imageUrl = safeCommerceUrl(data.image ? new URL(data.image,data.sourceUrl).href : '');
    form.value.imageData = ''; manual.value = !form.value.imageUrl;
  } catch { if (isCurrent(identity)) { manual.value = true; error.value = t('商家限制自動讀取。請使用瀏覽器收藏助手，或上傳商品照片；購買連結會保留。'); } }
  finally { if (isCurrent(identity)) busy.value = false; }
}
async function upload(event) {
  const file=event.target.files?.[0]; if (!file || !ready()) return;
  const identity = currentIdentity();
  busy.value=true; error.value='';
  try { const image = await preprocessPersonImage(file); if (isCurrent(identity)) { form.value.imageData=image.dataUrl; form.value.imageUrl=''; } }
  catch { if (isCurrent(identity)) error.value=t('照片處理失敗，請重新選擇。'); }
  finally { if (isCurrent(identity)) busy.value=false; event.target.value=''; }
}
async function save() {
  if (busy.value || !ready()) return;
  const identity = currentIdentity();
  busy.value=true; error.value='';
  try {
    await api('products',{...form.value},identity.accessToken);
    if (!isCurrent(identity)) return;
    form.value=emptyForm();
    modalOpen.value=false; manual.value=false;
    await router.replace({path:'/closet',query:{tab:'wishlist',lang:route.query.lang}});
    if (isCurrent(identity)) await load();
  } catch { if (isCurrent(identity)) error.value=t('暫時無法完成，請稍後再試。'); }
  finally { if (isCurrent(identity)) busy.value=false; }
}
watch(() => auth.session?.user?.id, (_next, previous) => {
  identityVersion++; generation++; items.value=[]; loading.value=false; busy.value=false; error.value='';
  appStore.wishlistProducts = [];
  for(const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); images.value={};
  if (previous) {
    form.value=emptyForm(); modalOpen.value=false; manual.value=false; mode.value='link'; guideOpen.value=false;
    if (route.query.quick || route.query.title) void router.replace({path:'/closet',query:{tab:'wishlist',lang:route.query.lang}});
  }
}, {immediate:true, flush:'sync'});
watch(() => appStore.isDetailOpen, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen && ready()) void load();
});
watch(() => [auth.session?.user?.id, auth.user?.id, auth.profileIdentity?.authUserId, auth.profileId, auth.isMember], () => { if (ready()) void load(); }, {immediate:true});
watch(() => route.query, q => {
  if (q.tab !== 'wishlist') return;
  if (q.title) form.value={...form.value,title:String(q.title).slice(0,160),sourceUrl:safeCommerceUrl(q.url),imageUrl:safeCommerceUrl(q.image)};
  if (q.quick==='add-product' || q.title) { modalOpen.value=true; manual.value=!form.value.imageUrl && !!q.title; }
}, {immediate:true});
onBeforeUnmount(() => { identityVersion++; generation++; for(const u of urls.values()) URL.revokeObjectURL(u); });
</script>
<template>
  <section class="wishlist" :aria-label="t('想買清單')">
    <Teleport :to="toolbarTarget||'body'" :disabled="!toolbarTarget" defer><div class="wishlist-toolbar-actions"><button class="secondary" @click="guideOpen=true">{{ t('瀏覽器收藏助手') }}</button><button class="primary" @click="openForm">＋ {{ t('新增商品') }}</button></div></Teleport>
    <p v-if="error && !modalOpen" role="alert">{{ error }}</p>
    <p v-if="!auth.initialized || loading" role="status">{{ t('載入中…') }}</p>
    <div v-else-if="!auth.isMember" class="empty"><p>{{ t('登入後儲存你的商品、私人照片與試穿結果。') }}</p><button class="primary" @click="login">{{ t('登入／註冊') }}</button></div>
    <div v-else-if="!items.length" class="empty"><p>{{ t('想買清單還沒有商品。') }}</p><button class="secondary" @click="openForm">{{ t('新增商品') }}</button></div>
    <template v-else>
      <div class="wishlist-toolbar">
        <label class="wishlist-search"><span aria-hidden="true">⌕</span><input v-model.trim="searchQuery" type="search" :placeholder="t('搜尋你的衣櫥')" :aria-label="t('搜尋你的衣櫥')"></label>
      </div>
      <div class="wishlist-category-row" role="group" :aria-label="t('單品分類')">
        <button v-for="category in filterCategories" :key="category" type="button" :class="['category', {active:activeCategory===category}]" :aria-pressed="activeCategory===category" @click="activeCategory=category">{{ t(labels[category] || category) }}</button>
        <div class="closet-view-mode" :aria-label="t('衣櫥檢視')"><button type="button" :aria-pressed="closetView==='rack'" @click="closetView='rack'">{{ t('衣架') }}</button><button type="button" :aria-pressed="closetView==='cards'" @click="closetView='cards'">{{ t('圖卡') }}</button></div>
      </div>
      <div class="wishlist-count"><strong>{{ visibleItems.length }} {{ t('件單品') }}</strong></div>
      <p v-if="!visibleItems.length" class="empty wishlist-filter-empty">{{ t('沒有符合篩選條件的商品。') }}</p>
      <WardrobeRack v-else-if="closetView==='rack'" :items="rackItems" :show-favorites="false" @open="openDetail" />
      <div v-else class="grid">
        <article v-for="(item,index) in visibleItems" :key="item.id" class="item-card" :style="{ animationDelay: `${index * 45}ms` }">
          <div class="item-image" role="button" tabindex="0" :aria-label="`${t('查看單品')}: ${item.title}`" @click="openDetail(item.id)" @keydown.enter="openDetail(item.id)" @keydown.space.prevent="openDetail(item.id)">
            <WardrobeCutout class="product-image" :src="images[item.image_path] || ''" :category="item.outfit_layer === 'outer' ? 'outer' : item.category" :alt="item.title" />
          </div>
          <div class="item-info">
            <h3>{{ item.title }}</h3>
            <p class="item-meta">{{ t(labels[item.outfit_layer === 'outer' ? 'Outerwear' : item.category] || item.category) }}</p>
          </div>
        </article>
      </div>
    </template>
    <div v-if="modalOpen && auth.isMember" class="wishlist-backdrop" @click.self="closeForm"><section v-accessible-modal="{onClose:closeForm}" class="wishlist-dialog" role="dialog" aria-modal="true" :aria-label="t('新增商品')"><button class="wishlist-close" :aria-label="t('關閉')" @click="closeForm">×</button><h2>{{ t('新增商品') }}</h2><p v-if="error" role="alert">{{ error }}</p><form @submit.prevent="save"><div class="wishlist-method"><button type="button" :aria-pressed="mode==='link'" @click="mode='link'">{{ t('貼上連結') }}</button><button type="button" :aria-pressed="mode==='photo'" @click="mode='photo'">{{ t('上傳圖片') }}</button></div><label>{{ t('商品購買連結（可稍後補）') }}<span class="wishlist-link"><input v-model.trim="form.sourceUrl" type="url" placeholder="https://…"><button type="button" :disabled="busy || !form.sourceUrl" @click="previewLink">{{ t('讀取商品') }}</button></span></label><label v-if="mode==='photo' || manual || form.imageData">{{ t('上傳商品照片') }}<input type="file" accept="image/jpeg,image/png" :disabled="busy" @change="upload"></label><img v-if="form.imageData || form.imageUrl" class="wishlist-preview" :src="form.imageData || form.imageUrl" :alt="form.title"><label>{{ t('商品名稱') }}<input v-model.trim="form.title" maxlength="160" required></label><label>{{ t('類別') }}<select v-model="form.category"><option value="upper_body">{{ t('上衣') }}</option><option value="outer">{{ t('外套') }}</option><option value="lower_body">{{ t('下身') }}</option><option value="full_body">{{ t('連身服飾') }}</option><option value="shoes">{{ t('鞋子') }}</option><option value="auto">{{ t('自動辨識') }}</option></select></label><button class="primary" :disabled="busy || (!form.imageData && !form.imageUrl)">{{ t('加入想買清單') }}</button></form></section></div>
    <div v-if="guideOpen" class="wishlist-backdrop" @click.self="guideOpen=false"><section v-accessible-modal="{onClose:()=>guideOpen=false}" class="wishlist-dialog" role="dialog" aria-modal="true" :aria-label="t('瀏覽器收藏助手')"><button class="wishlist-close" :aria-label="t('關閉')" @click="guideOpen=false">×</button><ExtensionGuide /></section></div>
  </section>
</template>
<style scoped>
.wishlist-card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.wishlist-delete{display:grid;place-items:center;flex:none;min-width:44px;min-height:44px;border:0;border-radius:9px;background:none;color:var(--muted);cursor:pointer}.wishlist-delete:hover{background:var(--accent-pink-soft);color:var(--accent)}.wishlist-undo{display:flex;align-items:center;gap:16px;font-size:13px}.wishlist-undo button{min-height:44px;border:0;background:none;color:var(--accent);text-decoration:underline;cursor:pointer}

.wishlist-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:24px 0}.wishlist-heading h2{margin:0}.wishlist-heading p{color:var(--muted);margin:8px 0}.wishlist-heading>div:last-child{display:flex;gap:8px;flex-wrap:wrap}.wishlist-toolbar{margin:18px 0}.wishlist-search{display:flex;align-items:center;gap:10px;max-width:100%;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-raised)}.wishlist-search>span{font-size:22px;color:var(--muted)}.wishlist-search input{width:100%;min-width:0;min-height:48px;border:0!important;background:transparent!important;font:inherit}.wishlist-category-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0}.wishlist-category-row .category{min-height:40px;padding:9px 16px;border:0;border-radius:0;background:transparent;color:var(--muted);font-size:13px}.wishlist-category-row .category.active{background:var(--ink);color:var(--white)}.wishlist-category-row .closet-view-mode{margin-left:auto}.closet-view-mode{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:24px;background:var(--surface-raised)}.closet-view-mode button{min-height:38px;padding:8px 14px;border:0;border-radius:20px;background:transparent;color:var(--muted);font:inherit;font-size:12px;cursor:pointer}.closet-view-mode button[aria-pressed=true]{background:var(--ink);color:var(--white)}.wishlist-count{margin:14px 0;font-size:13px}.wishlist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}.wishlist-card{display:grid;grid-template-rows:minmax(0,1fr) auto;min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--surface-raised)}.wishlist-product-open{display:grid;width:100%;min-width:0;padding:14px;border:0;background:var(--surface-raised);text-align:left;cursor:pointer}.wishlist-product-open>img,.wishlist-placeholder{display:grid;place-items:center;width:100%;height:230px;object-fit:contain;background:var(--white)}.wishlist-product-open .wishlist-placeholder{color:var(--muted);font-size:12px}.wishlist-card-title{display:block;min-height:42px;padding:10px 0 0;color:var(--ink);font-size:14px;font-weight:600;overflow-wrap:anywhere}.wishlist-card-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:4px 14px 14px}.wishlist-card-actions a{font-size:12px}.wishlist-card-actions .wishlist-delete{margin-left:auto}.wishlist-backdrop{position:fixed;z-index:1000;inset:0;background:#201b27aa;display:grid;place-items:center;padding:16px}.wishlist-dialog{position:relative;background:var(--surface-raised);border-radius:20px;padding:28px;width:min(100%,520px);max-height:90dvh;overflow:auto}.wishlist-close{position:absolute;right:16px;top:16px;border:0;background:none;font-size:24px}.wishlist-dialog form,.wishlist-dialog label{display:grid;gap:10px}.wishlist-dialog form{gap:16px}.wishlist-dialog input:not([type=file]),.wishlist-dialog select{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit}.wishlist-link,.wishlist-method{display:flex;gap:8px}.wishlist-link button{white-space:nowrap}.wishlist-method button[aria-pressed=true]{background:var(--accent-pink-soft)}.wishlist-preview{width:100%;height:180px;object-fit:contain}.wishlist-dialog button{cursor:pointer}.wishlist-filter-empty{padding:36px 0;text-align:center}@media(max-width:600px){.wishlist-heading{align-items:flex-start;flex-direction:column}.wishlist-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.wishlist-product-open{padding:8px}.wishlist-product-open>img,.wishlist-placeholder{height:170px}.wishlist-card-actions{gap:6px;padding:4px 8px 10px}.wishlist-card-actions a{font-size:11px}}
</style>

<style scoped>.wishlist-toolbar-actions{display:flex;gap:10px;align-items:center}.wishlist-dialog{max-width:720px;padding:32px!important;border-radius:14px!important;background:var(--white)!important}.wishlist-dialog form{display:grid;gap:16px}.wishlist-dialog label{display:grid;gap:8px;font-weight:500;font-size:14px}.wishlist-dialog input,.wishlist-dialog select{min-height:44px;padding:11px 12px;border:1px solid var(--line);border-radius:8px;background:white;font:inherit;color:var(--ink)}.wishlist-dialog h2{font:500 30px/1.4 var(--font-display);margin:0 0 24px}.wishlist-method{display:flex;gap:10px}.wishlist-method button{min-height:44px;padding:10px 16px;border:1px solid var(--line);border-radius:8px;background:white}.wishlist-method [aria-pressed=true]{background:var(--accent-pink-soft);border-color:var(--accent)}@media(max-width:600px){.wishlist-toolbar-actions{flex-wrap:wrap}.wishlist-dialog{padding:24px 18px!important}}</style>
