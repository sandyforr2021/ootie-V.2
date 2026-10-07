<template>
  <div class="tryon-view">
    <header class="hero">
      <div>
        <h1>先選一件，或搭一整套。</h1>
        <p>人物照和衣物都由你選擇；只有按下生成才會送出請求。</p>
      </div>
      <router-link class="back-link" to="/ai">← 返回 AI 穿搭助理</router-link>
    </header>

    <section v-if="!isMember" class="state-card member-gate">
      <div><h2>登入後使用私人 AI 圖像功能</h2><p>訪客無法呼叫付費 Try-On，人物照與結果照也不會公開。</p></div>
      <button type="button" class="primary-action" @click="openLoginGate">登入／註冊</button>
    </section>

    <template v-else>
      <div v-if="capabilitiesState === 'loading'" class="service-banner">正在確認 AI Gateway 狀態…</div>
      <div v-else-if="capabilitiesState === 'error'" class="service-banner error">{{ serviceMessage }}</div>
      <div v-else-if="!capabilities.imageGenerationEnabled" class="service-banner paused">AI 圖像功能目前暫停</div>
      <div v-else class="service-banner ready">
        <template v-if="capabilities.quotaExempt">此帳號不受每日圖片額度限制；</template>
        <template v-else>今日每位使用者最多 {{ capabilities.maxImagesPerUserPerDay }} 張；</template>
        每次固定生成 1 張。{{ currentPointCost }} OOTIE 點。
      </div>

      <div class="mode-switch" role="tablist" aria-label="AI 圖像模式">
        <button type="button" role="tab" :aria-selected="mode === 'single'" :class="{ active: mode === 'single' }" @click="setMode('single')">
          <strong>試一件衣服</strong><span>虛擬試穿 · 每次 1 件</span>
        </button>
        <button type="button" role="tab" :aria-selected="mode === 'outfit'" :class="{ active: mode === 'outfit' }" @click="setMode('outfit')">
          <strong>預覽完整穿搭</strong><span>AI 穿搭預覽 · 可選 1–5 件</span>
        </button>
      </div>

      <div class="studio-grid">
        <section class="setup-panel">
          <div class="step-heading"><h2>選擇私人人物照</h2><span>不會自動公開</span></div>
          <input ref="photoInput" class="sr-only" type="file" accept="image/jpeg,image/png" @change="onPhotoSelected" />
          <button type="button" class="photo-upload" :disabled="isUploadingPhoto" @click="photoInput?.click()">
            <span>{{ isUploadingPhoto ? '正在安全處理照片…' : '＋ 上傳人物照' }}</span>
            <small>JPEG / PNG，會調整方向並縮至合理解析度</small>
          </button>
          <p class="photo-guidance">建議使用本人的成人單人照，正面站立、光線均勻，讓臉部與身體清楚入鏡。Google 會檢查輸入與生成結果，照片上傳成功仍可能無法生成。</p>
          <p v-if="photoError" class="inline-error">{{ photoError }}</p>

          <div v-if="personPhotos.length" class="photo-list">
            <article v-for="photo in personPhotos" :key="photo.path" :class="['person-photo', { active: selectedPhotoPath === photo.path }]">
              <button type="button" class="person-photo-select" :aria-pressed="selectedPhotoPath === photo.path" :aria-label="selectedPhotoPath === photo.path ? '目前選用的人物照' : '選擇這張人物照'" @click="selectedPhotoPath = photo.path">
                <img :src="photo.url" alt="我的私人人物照" />
                <span>{{ selectedPhotoPath === photo.path ? '使用中' : '選擇' }}</span>
              </button>
              <button type="button" class="person-photo-delete" :disabled="deletingPhotoId === photo.id || generationState === 'generating'" :aria-label="'刪除這張人物照'" @click="removePersonPhoto(photo)">
                {{ deletingPhotoId === photo.id ? '刪除中' : '刪除' }}
              </button>
            </article>
          </div>
          <p v-else class="empty-copy">尚未上傳人物照。照片會存放於 Private Storage。</p>

          <div class="step-heading item-step"><h2>從衣櫥選擇衣物</h2><span>{{ mode === 'single' ? '1 件' : `${selectedItemIds.length} / 5` }}</span></div>
          <div class="garment-tools">
            <label><span class="sr-only">搜尋衣物</span><input v-model.trim="clothingQuery" type="search" placeholder="搜尋衣物或品牌" /></label>
            <label><span class="sr-only">依分類篩選衣物</span><select v-model="clothingCategory"><option value="">全部分類</option><option v-for="category in clothingCategories" :key="category" :value="category">{{ category }}</option></select></label>
          </div>
          <div class="selection-summary"><strong>已選 {{ selectedItemIds.length }} 件</strong><span>{{ mode === 'single' ? '想搭多件？選擇「預覽完整穿搭」' : '最多選 5 件，可再次點擊取消' }}</span></div>
          <div v-if="selectedItems.length" class="selected-tray" aria-label="已選衣物">
            <button v-for="item in selectedItems" :key="item.id" type="button" :aria-label="`移除 ${item.name_zh || item.name}`" @click="toggleItem(item.id)">
              <img :src="item.photo" alt="" /><span>{{ item.name_zh || item.name }}</span><b aria-hidden="true">×</b>
            </button>
          </div>
          <div v-if="appStore.items.length" class="clothing-grid">
            <button v-for="item in visibleClothingItems" :key="item.id" type="button" :aria-pressed="selectedItemIds.includes(item.id)" :class="['clothing-card', { active: selectedItemIds.includes(item.id) }]" @click="toggleItem(item.id)">
              <div class="garment-image"><img v-if="item.photo" :src="item.photo" :alt="item.name_zh || item.name" /><span v-else>NO IMAGE</span></div>
              <strong>{{ item.name_zh || item.name }}</strong><small>{{ item.category || '未分類' }}</small>
            </button>
            <p v-if="!visibleClothingItems.length" class="empty-copy clothing-filter-empty">沒有符合搜尋條件的衣物。</p>
          </div>
          <p v-else class="empty-copy">你的衣櫥還沒有可用單品。</p>

          <label v-if="mode === 'outfit'" class="prompt-field"><span>整體視覺方向（選填）</span><textarea v-model.trim="previewPrompt" maxlength="600" placeholder="例如：自然日光、乾淨街景、保留人物原本髮型。"></textarea></label>

          <button type="button" class="primary-action generate-action" :disabled="!canGenerate" @click="generate">
            <span v-if="generationState === 'generating'">{{ generatingLabel }}</span><span v-else>{{ generateLabel }}</span>
          </button>
          <p class="cost-note">只有按下此按鈕才會建立付費 AI Request；逾時或失敗不會自動重送。</p>
        </section>

        <section class="result-panel" aria-live="polite">
          <div class="step-heading"><h2>生成結果</h2><span>{{ mode === 'single' ? '虛擬試穿' : '穿搭預覽' }}</span></div>
          <div v-if="generationState === 'idle'" class="state-card preview-empty">
            <div><h3>等你確認照片與單品</h3><p>{{ mode === 'single' ? '單件模式會使用正式 Virtual Try-On。' : '整套模式提供 AI 穿搭視覺預覽，不代表精確版型或尺寸。' }}</p></div>
          </div>
          <div v-else-if="generationState === 'generating'" class="state-card preview-empty">
            <span class="spinner"></span><div><h3>{{ generatingLabel }}</h3><p>目前沒有顯示不實百分比；請保持此頁開啟。</p></div>
          </div>
          <div v-else-if="generationState === 'error'" class="state-card error-state">
            <div><h3>{{ errorHeading }}</h3><p>{{ generationErrorMessage }}</p></div>
            <button v-if="generationErrorCode === 'SAFETY_REJECTION'" type="button" class="secondary-action" @click="modifySelection">重新選擇照片與衣物</button>
            <button v-if="generationErrorCode === 'CLOTHING_IMAGE_INVALID'" type="button" class="secondary-action" @click="modifySelection">更換衣物</button>
            <button v-if="mode === 'single' && generationErrorCode === 'PROVIDER_UNAVAILABLE'" type="button" class="secondary-action" @click="setMode('outfit')">改用 AI 穿搭預覽</button>
          </div>
          <article v-else-if="currentResult" class="generated-result">
            <div class="result-image-wrap"><img :src="currentResult.resultUrl" :alt="mode === 'single' ? '虛擬試穿結果' : 'AI 穿搭預覽結果'" /><span>{{ mode === 'single' ? 'VIRTUAL TRY-ON' : 'AI OUTFIT PREVIEW' }}</span></div>
            <div class="result-copy"><h3>{{ mode === 'single' ? '虛擬試穿完成' : 'AI 穿搭預覽完成' }}</h3><p>AI 圖像為視覺模擬，實際版型、尺寸、材質、垂墜感與色彩可能不同。</p><p class="private-note">此結果目前為 Private，未自動發布到 OOTD。</p></div>
            <div class="result-actions">
              <button type="button" class="secondary-action" @click="modifySelection">返回修改單品</button>
              <button type="button" class="secondary-action" :disabled="isSaving || currentResult.savedAt" @click="saveResult">{{ currentResult.savedAt ? '已儲存' : isSaving ? '儲存中…' : '儲存結果' }}</button>
              <button type="button" class="primary-action" :disabled="generationState === 'generating'" @click="generate">重新生成</button>
            </div>
          </article>
        </section>
      </div>

      <section v-if="generationHistory.length" class="history-panel">
        <div class="step-heading"><h2>私人生成紀錄</h2><span>{{ generationHistory.length }} 筆</span></div>
        <div class="history-grid"><button v-for="entry in generationHistory" :key="entry.generationId" type="button" @click="useHistory(entry)"><img :src="entry.resultUrl" alt="私人 AI 生成紀錄" /><span>{{ entry.generationType === 'single_try_on' ? '虛擬試穿' : 'AI 穿搭預覽' }}</span></button></div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { aiGateway, createGenerationId, getAiErrorMessage } from '@/services/aiGateway';
import { preprocessPersonImage } from '@/services/imageUpload';
import { getOwnedTryOnItemIds, reconcileTryOnSelection } from '@/services/tryOnSelection';

const route = useRoute();
const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const isMember = computed(() => authStore.isMember);
const accessToken = computed(() => authStore.session?.access_token || '');
const mode = ref(route.query.mode === 'outfit' ? 'outfit' : 'single');
const selectedItemIds = ref([]);
const selectedPhotoPath = ref('');
const personPhotos = ref([]);
const generationHistory = ref([]);
const previewPrompt = ref('');
const photoInput = ref(null);
const photoError = ref('');
const isUploadingPhoto = ref(false);
const deletingPhotoId = ref('');
const clothingQuery = ref('');
const clothingCategory = ref('');
const capabilitiesState = ref('loading');
const capabilities = ref({ imageGenerationEnabled: false, maxImagesPerUserPerDay: 0, quotaExempt: false, pointsCost: { singleTryOn: 8, outfitPreview: 12 } });
const serviceMessage = ref('');
const generationState = ref('idle');
const generationErrorCode = ref('');
const generationErrorMessage = ref('');
const currentResult = ref(null);
const isSaving = ref(false);
let studioTokenLoaded = '';
const privateObjectUrls = new Map();

const revokePrivateImages = () => {
  privateObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  privateObjectUrls.clear();
};
const privateImageUrl = async (path) => {
  if (privateObjectUrls.has(path)) return privateObjectUrls.get(path);
  const url = await aiGateway.loadPrivateImage(accessToken.value, path);
  privateObjectUrls.set(path, url);
  return url;
};
const hydratePhoto = async (photo) => ({ ...photo, url: await privateImageUrl(photo.path) });
const hydrateGeneration = async (entry) => ({ ...entry, resultUrl: await privateImageUrl(entry.resultPath) });

const generateLabel = computed(() => mode.value === 'single' ? '生成試穿' : '生成穿搭預覽');
const generatingLabel = computed(() => mode.value === 'single' ? '正在建立虛擬試穿…' : '正在建立穿搭預覽…');
const currentPointCost = computed(() => mode.value === 'single' ? capabilities.value.pointsCost?.singleTryOn ?? 8 : capabilities.value.pointsCost?.outfitPreview ?? 12);
const errorHeading = computed(() => generationErrorCode.value === 'QUOTA_EXCEEDED' ? '今日額度已用完' : generationErrorCode.value === 'INSUFFICIENT_POINTS' ? 'OOTIE 點數不足' : generationErrorCode.value === 'SAFETY_REJECTION' ? '未通過安全檢查' : generationErrorCode.value === 'PROVIDER_UNAVAILABLE' ? 'Virtual Try-On 目前不可用' : generationErrorCode.value === 'CLOTHING_IMAGE_INVALID' ? '這件衣物的圖片需要更換' : '這次沒有生成結果');
const ownedItemIds = computed(() => getOwnedTryOnItemIds(appStore.items, authStore.profileId));
const clothingCategories = computed(() => [...new Set(appStore.items.map((item) => item.category).filter(Boolean))].sort());
const visibleClothingItems = computed(() => {
  const query = clothingQuery.value.toLocaleLowerCase('zh-Hant');
  return appStore.items.filter((item) => {
    const categoryMatch = !clothingCategory.value || item.category === clothingCategory.value;
    const searchText = [item.name, item.name_zh, item.brand, item.category].filter(Boolean).join(' ').toLocaleLowerCase('zh-Hant');
    return categoryMatch && (!query || searchText.includes(query));
  });
});
const selectedItems = computed(() => {
  const selected = new Set(selectedItemIds.value);
  return appStore.items.filter((item) => selected.has(item.id));
});
const validSelectedItemIds = computed(() => {
  const available = new Set(ownedItemIds.value);
  return [...new Set(selectedItemIds.value.map(String).filter((id) => available.has(id)))];
});
const canGenerate = computed(() => capabilities.value.imageGenerationEnabled
  && generationState.value !== 'generating'
  && !isUploadingPhoto.value
  && Boolean(selectedPhotoPath.value)
  && validSelectedItemIds.value.length === selectedItemIds.value.length
  && (mode.value === 'single'
    ? validSelectedItemIds.value.length === 1
    : validSelectedItemIds.value.length >= 1 && validSelectedItemIds.value.length <= 5));

const openLoginGate = () => appStore.openLoginGate('TRYON_AUTH_REQUIRED', route.fullPath);
const setMode = (nextMode) => { mode.value = nextMode; if (nextMode === 'single' && selectedItemIds.value.length > 1) selectedItemIds.value = selectedItemIds.value.slice(0, 1); currentResult.value = null; generationState.value = 'idle'; generationErrorCode.value = ''; };
const toggleItem = (id) => {
  if (generationState.value === 'generating') return;
  if (mode.value === 'single') return void (selectedItemIds.value = [id]);
  if (selectedItemIds.value.includes(id)) selectedItemIds.value = selectedItemIds.value.filter((itemId) => itemId !== id);
  else if (selectedItemIds.value.length < 5) selectedItemIds.value = [...selectedItemIds.value, id];
};

const removePersonPhoto = async (photo) => {
  if (!photo?.id || deletingPhotoId.value || generationState.value === 'generating') return;
  if (!window.confirm('確定刪除這張私人人物照嗎？刪除後無法恢復。')) return;
  deletingPhotoId.value = photo.id;
  try {
    await aiGateway.deletePersonPhoto(accessToken.value, photo.id);
    const objectUrl = privateObjectUrls.get(photo.path);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    privateObjectUrls.delete(photo.path);
    personPhotos.value = personPhotos.value.filter((entry) => entry.path !== photo.path);
    if (selectedPhotoPath.value === photo.path) selectedPhotoPath.value = personPhotos.value[0]?.path || '';
    appStore.showToast('人物照已刪除', { type: 'success' });
  } catch (error) {
    appStore.showToast(getAiErrorMessage(error), { type: 'error' });
  } finally {
    deletingPhotoId.value = '';
  }
};
const applyQuerySelection = () => {
  const requested = String(route.query.items || '').split(',').filter(Boolean);
  selectedItemIds.value = reconcileTryOnSelection({
    currentIds: selectedItemIds.value,
    requestedIds: requested,
    items: appStore.items,
    profileId: authStore.profileId,
    mode: mode.value
  });
};
watch([
  () => appStore.items.map((item) => `${item.id}:${item.owner_id || ''}`).join(','),
  () => authStore.profileId,
  mode
], applyQuerySelection, { immediate: true });
watch(() => authStore.profileId, (profileId) => {
  if (profileId) closetStore.loadRemoteItems(profileId);
}, { immediate: true });

const onPhotoSelected = async (event) => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file || isUploadingPhoto.value) return;
  photoError.value = ''; isUploadingPhoto.value = true;
  try {
    const processed = await preprocessPersonImage(file);
    const uploaded = await hydratePhoto(await aiGateway.uploadPersonPhoto(accessToken.value, { photoId: createGenerationId(), imageData: processed.dataUrl }));
    personPhotos.value = [uploaded, ...personPhotos.value.filter((photo) => photo.path !== uploaded.path)];
    selectedPhotoPath.value = uploaded.path;
  } catch (error) { photoError.value = error?.code ? getAiErrorMessage(error) : (error?.message || '照片處理失敗。'); }
  finally { isUploadingPhoto.value = false; }
};

const generate = async () => {
  if (!canGenerate.value) return;
  generationState.value = 'generating'; generationErrorCode.value = ''; generationErrorMessage.value = '';
  try {
    const input = { generationId: createGenerationId(), personPhotoPath: selectedPhotoPath.value, clothingItemIds: validSelectedItemIds.value, ...(mode.value === 'outfit' ? { prompt: previewPrompt.value } : {}) };
    const generated = mode.value === 'single' ? await aiGateway.generateSingleGarmentTryOn(accessToken.value, input) : await aiGateway.generateOutfitPreview(accessToken.value, input);
    currentResult.value = await hydrateGeneration(generated);
    generationState.value = 'result'; await refreshHistory();
  } catch (error) { currentResult.value = null; generationErrorCode.value = error?.code || 'UNKNOWN'; generationErrorMessage.value = getAiErrorMessage(error); generationState.value = 'error'; }
};
const saveResult = async () => {
  if (!currentResult.value || isSaving.value) return;
  isSaving.value = true;
  try { const saved = await aiGateway.saveGeneration(accessToken.value, currentResult.value.generationId); currentResult.value = { ...currentResult.value, savedAt: saved.savedAt }; await refreshHistory(); }
  catch (error) { appStore.showToast(getAiErrorMessage(error), { type: 'error' }); }
  finally { isSaving.value = false; }
};
const modifySelection = () => { currentResult.value = null; generationState.value = 'idle'; };
const useHistory = (entry) => { mode.value = entry.generationType === 'single_try_on' ? 'single' : 'outfit'; currentResult.value = entry; generationState.value = 'result'; window.scrollTo?.({ top: 0, behavior: 'smooth' }); };
const refreshHistory = async () => {
  try {
    const response = await aiGateway.listGenerations(accessToken.value);
    generationHistory.value = await Promise.all((response.generations || []).map(hydrateGeneration));
  } catch { generationHistory.value = []; }
};

const loadStudioData = async (token) => {
  if (!token || studioTokenLoaded === token) return;
  studioTokenLoaded = token;
  capabilitiesState.value = 'loading';
  const [capabilityResult, photoResult] = await Promise.allSettled([aiGateway.healthCheck(token), aiGateway.listPersonPhotos(token), refreshHistory()]);
  if (capabilityResult.status === 'fulfilled') { capabilities.value = capabilityResult.value; capabilitiesState.value = 'ready'; }
  else { capabilitiesState.value = 'error'; serviceMessage.value = getAiErrorMessage(capabilityResult.reason); studioTokenLoaded = ''; }
  if (photoResult.status === 'fulfilled') { personPhotos.value = await Promise.all((photoResult.value.photos || []).map(hydratePhoto)); selectedPhotoPath.value = personPhotos.value[0]?.path || ''; }
  applyQuerySelection();
};

watch(accessToken, (nextToken, previousToken) => {
  if (nextToken) loadStudioData(nextToken);
  if (!nextToken && previousToken) {
    studioTokenLoaded = '';
    revokePrivateImages();
    personPhotos.value = [];
    generationHistory.value = [];
    currentResult.value = null;
    selectedPhotoPath.value = '';
    generationState.value = 'idle';
  }
});

onMounted(async () => {
  if (!accessToken.value) { capabilitiesState.value = 'idle'; return; }
  await loadStudioData(accessToken.value);
});
onBeforeUnmount(revokePrivateImages);
</script>

<style scoped>
.tryon-view { max-width: 1180px; margin: 0 auto; padding-bottom: 72px; }
.hero { display: flex; justify-content: space-between; gap: 32px; align-items: flex-end; margin-bottom: 26px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
.hero h1 { margin: 0; max-width: 760px; font-family: "DM Sans", sans-serif; font-size: clamp(38px, 5vw, 58px); font-weight: 780; letter-spacing: -.04em; line-height: 1.03; }
.hero p { max-width: 620px; margin-bottom: 0; color: var(--muted); line-height: 1.65; }
.back-link { flex: 0 0 auto; color: var(--ink); font-size: 13px; font-weight: 700; text-underline-offset: 4px; }
.service-banner { margin-bottom: 16px; padding: 10px 0; border-bottom: 1px solid var(--line); color: #35546a; font-size: 13px; font-weight: 700; }
.service-banner.paused { background: #f6eadb; color: #8a6338; }.service-banner.error { background: #f8e5e2; color: #92564f; }
.mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 24px; border-bottom: 1px solid var(--line); }
.mode-switch button { display: grid; gap: 4px; min-height: 72px; padding: 14px 16px; border: 0; border-bottom: 3px solid transparent; background: transparent; text-align: left; }
.mode-switch button.active { border-bottom-color: var(--ink); }.mode-switch strong { font-size: 16px; }.mode-switch span { color: var(--muted); font-size: 12px; }
.studio-grid { display: grid; grid-template-columns: minmax(320px, .95fr) minmax(0, 1.2fr); gap: 22px; align-items: start; }
.setup-panel, .result-panel { min-width: 0; padding: 4px 0; }
.result-panel { padding-left: 28px; border-left: 1px solid var(--line); }
.history-panel { margin-top: 40px; padding-top: 28px; border-top: 1px solid var(--line); }
.step-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; }.step-heading > span { color: var(--muted); font-size: 12px; font-weight: 700; }.step-heading h2 { margin: 0; font-size: 19px; }.item-step { margin-top: 34px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.photo-upload { width: 100%; margin-top: 16px; display: grid; gap: 5px; padding: 16px; border: 1px dashed #b9cfdc; border-radius: 12px; background: var(--accent-blue-soft); color: var(--ink); font-weight: 700; }.photo-upload small { color: var(--muted); font-weight: 400; }
.photo-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }.person-photo { position: relative; min-width: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface-raised); }.person-photo.active { border-color: var(--ink); }.person-photo-select { display: block; position: relative; width: 100%; aspect-ratio: 3 / 4; padding: 0; border: 0; background: var(--paper); }.person-photo img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }.person-photo-select span { position: absolute; right: 7px; bottom: 7px; padding: 3px 7px; border-radius: 999px; background: rgba(255,255,255,.92); color: var(--ink); font-size: 10px; font-weight: 700; }.person-photo-delete { width: 100%; min-height: 36px; border: 0; border-top: 1px solid var(--line); background: transparent; color: #8e3f3b; font-size: 11px; font-weight: 700; }
.garment-tools { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 8px; margin-top: 14px; }.garment-tools input,.garment-tools select { width: 100%; min-height: 44px; border: 1px solid var(--line); border-radius: 10px; padding: 0 12px; background: var(--surface-raised); color: var(--ink); }.selection-summary { display: flex; justify-content: space-between; gap: 12px; margin: 14px 0 10px; color: var(--muted); font-size: 11px; }.selection-summary strong { color: var(--ink); }.selected-tray { display: flex; gap: 8px; overflow-x: auto; padding: 0 0 12px; }.selected-tray button { min-width: 134px; max-width: 180px; display: grid; grid-template-columns: 36px minmax(0,1fr) 16px; align-items: center; gap: 7px; padding: 6px; border: 1px solid var(--ink); border-radius: 10px; background: var(--surface-raised); text-align: left; }.selected-tray img { width: 36px; height: 44px; border-radius: 6px; object-fit: contain; background: var(--paper); }.selected-tray span { overflow: hidden; font-size: 10px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.selected-tray b { font-size: 16px; font-weight: 500; }.clothing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; max-height: 430px; overflow: auto; }.clothing-card { min-width: 0; border: 1px solid transparent; border-radius: 12px; padding: 7px; background: transparent; text-align: left; }.clothing-card.active { border-color: var(--ink); background: var(--surface-raised); }.garment-image { height: 98px; display: grid; place-items: center; border-radius: 8px; overflow: hidden; background: #f0eee8; color: var(--muted); font-size: 9px; }.garment-image img { width: 100%; height: 100%; object-fit: contain; }.clothing-card strong, .clothing-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.clothing-card strong { margin-top: 7px; font-size: 12px; }.clothing-card small { margin-top: 2px; color: var(--muted); font-size: 10px; }.clothing-filter-empty { grid-column: 1 / -1; padding: 24px 0; text-align: center; }
.prompt-field { display: grid; gap: 8px; margin-top: 22px; color: var(--ink); font-size: 13px; font-weight: 700; }.prompt-field textarea { min-height: 90px; resize: vertical; border: 1px solid var(--line); border-radius: 13px; padding: 12px; background: #fbfaf7; line-height: 1.5; }
.primary-action, .secondary-action { min-height: 44px; border-radius: 11px; padding: 12px 18px; border: 1px solid var(--ink); font-weight: 700; }.primary-action { background: var(--ink); color: #fff; }.secondary-action { background: transparent; color: var(--ink); }.primary-action:disabled, .secondary-action:disabled { opacity: .46; cursor: not-allowed; }.generate-action { width: 100%; min-height: 50px; margin-top: 24px; }.cost-note, .empty-copy, .inline-error, .photo-guidance { color: var(--muted); font-size: 11px; line-height: 1.55; }.inline-error { color: #92564f; }
.result-panel { min-height: 620px; }.state-card { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; padding: 24px 0; border-block: 1px solid var(--line); background: transparent; }.state-card h2, .state-card h3 { margin: 0 0 6px; }.state-card p { margin: 0; color: var(--muted); line-height: 1.6; }.member-gate { justify-content: space-between; }.member-gate > div { flex: 1; }.preview-empty { min-height: 500px; justify-content: center; text-align:center; }.spinner { width: 34px; height: 34px; border: 3px solid #dde2d9; border-top-color: var(--ink); border-radius: 50%; animation: spin .85s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }.error-state { min-height: 360px; justify-content: center; border-color: #e7b8c4; background: #fff6f7; text-align:left; }.error-state > div { flex: 1 1 240px; }
.generated-result { margin-top: 18px; }.result-image-wrap { position: relative; overflow: hidden; min-height: 420px; max-height: 620px; border-radius: 18px; background: var(--paper); }.result-image-wrap img { display: block; width: 100%; height: 100%; max-height: 620px; object-fit: contain; }.result-image-wrap span { position: absolute; left: 14px; bottom: 14px; padding: 6px 9px; border-radius: 999px; background: rgba(32,32,32,.76); color: #fff; font-size: 9px; letter-spacing: 1.2px; }.result-copy h3 { margin-bottom: 5px; }.result-copy p { margin: 4px 0; color: var(--muted); font-size: 12px; line-height: 1.55; }.private-note { color: var(--sage-dark) !important; }.result-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; margin-top: 18px; }.history-grid button { position: relative; height: 180px; padding: 0; overflow: hidden; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }.history-grid img { width: 100%; height: 100%; object-fit: cover; }.history-grid span { position: absolute; left: 8px; bottom: 8px; padding: 4px 7px; border-radius: 999px; background: rgba(255,255,255,.9); color: var(--ink); font-size: 9px; font-weight: 700; }
@media (hover:hover) and (pointer:fine) { .mode-switch button:hover,.clothing-card:hover { background: var(--accent-yellow-soft); }.person-photo-delete:hover { background: #fff2f1; } }
@media (max-width: 900px) { .studio-grid { grid-template-columns: 1fr; } .hero { align-items: flex-start; } .result-panel { min-height: auto; padding: 32px 0 0; border-top: 1px solid var(--line); border-left: 0; } }
@media (max-width: 620px) { .tryon-view { padding-bottom: 40px; }.hero { display: block; margin-bottom: 18px; }.hero h1 { font-size: 36px; }.back-link { display: inline-block; margin-top: 12px; }.mode-switch { grid-template-columns: 1fr 1fr; }.mode-switch button { min-height: 80px; padding-inline: 10px; }.mode-switch strong { font-size: 14px; }.garment-tools { grid-template-columns: 1fr; }.clothing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.photo-list { grid-template-columns: repeat(2,minmax(0,1fr)); }.member-gate, .result-actions { align-items: stretch; flex-direction: column; }.result-actions button { width: 100%; }.selection-summary { align-items: flex-start; flex-direction: column; }.preview-empty { min-height: 280px; } }
@media (max-width: 359px) { .mode-switch { grid-template-columns: 1fr; }.photo-list { grid-template-columns: 1fr 1fr; } }
@media (prefers-reduced-motion:reduce) { .spinner { animation-duration: 1.5s; }.clothing-card,.mode-switch button { transition:none; } }
</style>
