<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { aiGateway } from '@/services/aiGateway';
import { commerceClient, safeCommerceUrl } from '@/services/commerce';
import { preprocessPersonImage } from '@/services/imageUpload';
import { t } from '@/i18n';
import ExtensionGuide from '@/components/bookmarks/ExtensionGuide.vue';

const auth = useAuthStore(), route = useRoute(), router = useRouter();
const token = computed(() => auth.session?.access_token || '');
const items = ref([]), images = ref({}), loading = ref(false), busy = ref(false), error = ref('');
const modalOpen = ref(false), guideOpen = ref(false), manual = ref(false), mode = ref('link');
const emptyForm = () => ({ title:'', sourceUrl:'', imageUrl:'', imageData:'', category:'upper_body', color:'#c8bba9' });
const form = ref(emptyForm());
const urls = new Map(); let generation = 0; let identityVersion = 0;
const currentIdentity = () => ({ version: identityVersion, userId:auth.session?.user?.id, accessToken:token.value });
const isCurrent = (identity) => identity.version === identityVersion && identity.userId === auth.session?.user?.id;
const ready = () => auth.isMember && !!token.value && auth.user?.id === auth.session?.user?.id && (!auth.profileIdentity?.authUserId || auth.profileIdentity.authUserId === auth.session?.user?.id);
const api = (path, body, accessToken=token.value) => commerceClient.request(path, accessToken, body);
const login = () => auth.openAuthModal('login', null, route.fullPath);
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
    items.value = (data.products || []).filter(item => item.state !== 'dismissed');
    await Promise.all(items.value.map(item => hydrate(item.image_path,current)));
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
  for(const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); images.value={};
  if (previous) {
    form.value=emptyForm(); modalOpen.value=false; manual.value=false; mode.value='link'; guideOpen.value=false;
    if (route.query.quick || route.query.title) void router.replace({path:'/closet',query:{tab:'wishlist',lang:route.query.lang}});
  }
}, {immediate:true, flush:'sync'});
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
    <div class="wishlist-heading"><div><h2>{{ t('想買清單') }}</h2><p>{{ t('收藏想買的商品，之後再試穿。') }}</p></div><div><button class="secondary" @click="guideOpen=true">{{ t('瀏覽器收藏助手') }}</button><button class="primary" @click="openForm">＋ {{ t('新增商品') }}</button></div></div>
    <p v-if="error && !modalOpen" role="alert">{{ error }}</p>
    <p v-if="!auth.initialized || loading" role="status">{{ t('載入中…') }}</p>
    <div v-else-if="!auth.isMember" class="empty"><p>{{ t('登入後儲存你的商品、私人照片與試穿結果。') }}</p><button class="primary" @click="login">{{ t('登入／註冊') }}</button></div>
    <div v-else-if="!items.length" class="empty"><p>{{ t('想買清單還沒有商品。') }}</p><button class="secondary" @click="openForm">{{ t('新增商品') }}</button></div>
    <div v-else class="wishlist-grid"><article v-for="item in items" :key="item.id" class="wishlist-card"><img v-if="images[item.image_path]" :src="images[item.image_path]" :alt="item.title" loading="lazy"><div v-else class="wishlist-placeholder">{{ t('商品照片') }}</div><div><h3>{{ item.title }}</h3><a v-if="safeCommerceUrl(item.source_url)" :href="safeCommerceUrl(item.source_url)" target="_blank" rel="noopener noreferrer">{{ t('前往購買 ↗') }}</a><router-link :to="{path:'/shop',query:{product:item.id}}">{{ t('選擇試穿') }} →</router-link></div></article></div>
    <div v-if="modalOpen && auth.isMember" class="wishlist-backdrop" @click.self="closeForm"><section v-accessible-modal="{onClose:closeForm}" class="wishlist-dialog" role="dialog" aria-modal="true" :aria-label="t('新增商品')"><button class="wishlist-close" :aria-label="t('關閉')" @click="closeForm">×</button><h2>{{ t('新增商品') }}</h2><p v-if="error" role="alert">{{ error }}</p><form @submit.prevent="save"><div class="wishlist-method"><button type="button" :aria-pressed="mode==='link'" @click="mode='link'">{{ t('貼上連結') }}</button><button type="button" :aria-pressed="mode==='photo'" @click="mode='photo'">{{ t('上傳圖片') }}</button></div><label>{{ t('商品購買連結（可稍後補）') }}<span class="wishlist-link"><input v-model.trim="form.sourceUrl" type="url" placeholder="https://…"><button type="button" :disabled="busy || !form.sourceUrl" @click="previewLink">{{ t('讀取商品') }}</button></span></label><label v-if="mode==='photo' || manual || form.imageData">{{ t('上傳商品照片') }}<input type="file" accept="image/jpeg,image/png" :disabled="busy" @change="upload"></label><img v-if="form.imageData || form.imageUrl" class="wishlist-preview" :src="form.imageData || form.imageUrl" :alt="form.title"><label>{{ t('商品名稱') }}<input v-model.trim="form.title" maxlength="160" required></label><label>{{ t('類別') }}<select v-model="form.category"><option value="upper_body">{{ t('上衣') }}</option><option value="lower_body">{{ t('下身') }}</option><option value="full_body">{{ t('連身服飾') }}</option><option value="shoes">{{ t('鞋子') }}</option><option value="auto">{{ t('自動辨識') }}</option></select></label><button class="primary" :disabled="busy || (!form.imageData && !form.imageUrl)">{{ t('加入想買清單') }}</button></form></section></div>
    <div v-if="guideOpen" class="wishlist-backdrop" @click.self="guideOpen=false"><section v-accessible-modal="{onClose:()=>guideOpen=false}" class="wishlist-dialog" role="dialog" aria-modal="true" :aria-label="t('瀏覽器收藏助手')"><button class="wishlist-close" :aria-label="t('關閉')" @click="guideOpen=false">×</button><ExtensionGuide /></section></div>
  </section>
</template>
<style scoped>
.wishlist-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:24px 0}.wishlist-heading h2{margin:0}.wishlist-heading p{color:var(--muted);margin:8px 0}.wishlist-heading>div:last-child{display:flex;gap:8px;flex-wrap:wrap}.wishlist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}.wishlist-card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface-raised)}.wishlist-card>img,.wishlist-placeholder{display:grid;place-items:center;width:100%;height:220px;object-fit:contain;background:var(--paper)}.wishlist-card>div:last-child{padding:16px;display:grid;gap:10px}.wishlist-card h3{font-size:15px;margin:0}.wishlist-card a{font-size:13px}.wishlist-backdrop{position:fixed;z-index:1000;inset:0;background:#201b27aa;display:grid;place-items:center;padding:16px}.wishlist-dialog{position:relative;background:var(--surface-raised);border-radius:20px;padding:28px;width:min(100%,520px);max-height:90dvh;overflow:auto}.wishlist-close{position:absolute;right:16px;top:16px;border:0;background:none;font-size:24px}.wishlist-dialog form,.wishlist-dialog label{display:grid;gap:10px}.wishlist-dialog form{gap:16px}.wishlist-dialog input:not([type=file]),.wishlist-dialog select{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit}.wishlist-link,.wishlist-method{display:flex;gap:8px}.wishlist-link button{white-space:nowrap}.wishlist-method button[aria-pressed=true]{background:var(--accent-pink-soft)}.wishlist-preview{width:100%;height:180px;object-fit:contain}.wishlist-dialog button{cursor:pointer}@media(max-width:600px){.wishlist-heading{align-items:flex-start;flex-direction:column}.wishlist-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
