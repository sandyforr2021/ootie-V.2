<template>
  <div v-if="appStore.isItemFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal form-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" :disabled="isSubmitting" @click="close">×</button>
      <h2>{{ isEdit ? $t('編輯單品') : $t('加入衣櫥') }}</h2>

      <form @submit.prevent="handleSubmit">
        <div class="form-field full">
          <div class="field-label-row">
            <label for="photoFile">{{ $t("上傳單品照片") }}</label>
            <button
              v-if="!isEdit && !showCaptureGuide"
              class="capture-guide-link"
              type="button"
              @click="showCaptureGuide = true"
            >{{ $t("拍攝指南") }}</button>
          </div>

          <section
            v-if="!isEdit && showCaptureGuide"
            class="capture-guide"
            aria-labelledby="captureGuideTitle"
          >
            <div class="capture-guide-heading">
              <div>
                <h3 id="captureGuideTitle">{{ $t("讓衣服完整入鏡就好") }}</h3>
              </div>
              <button type="button" class="capture-guide-skip" @click="dismissCaptureGuide">{{ $t("先略過") }}</button>
            </div>
            <ol class="capture-guide-steps">
              <li><span>1</span><strong>{{ $t("整件入鏡") }}</strong><small>{{ $t("領口、袖子和下擺都留一點空間") }}</small></li>
              <li><span>2</span><strong>{{ $t("光線均勻") }}</strong><small>{{ $t("靠近窗邊，避免強烈背光或陰影") }}</small></li>
              <li><span>3</span><strong>{{ $t("一次一件") }}</strong><small>{{ $t("平放、掛起或放在椅面都可以") }}</small></li>
            </ol>

          </section>

          <div class="upload-zone">
            <strong>{{ photoPreview ? $t('已選擇照片') : $t('加入一張單品照片') }}</strong>
            <span>{{ $t('JPEG、PNG、WebP · 上限 20 MB') }}</span>
            <div class="upload-choice-row">
              <button type="button" class="secondary" :disabled="mediaBusy || isSubmitting" @click="openCameraInput">{{ photoPreview ? $t('重新拍攝') : $t('拍照') }}</button>
              <button type="button" class="secondary" :disabled="mediaBusy || isSubmitting" @click="openGalleryInput">{{ photoPreview ? $t('重新選擇') : $t('從相簿選擇') }}</button>
            </div>
            <input
              id="photoFile"
              ref="galleryInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              :disabled="mediaBusy || isSubmitting"
              @change="handleFileChange"
            />
            <input
              ref="cameraInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              capture="environment"
              :aria-label="$t(&quot;使用相機拍攝單品&quot;)"
              :disabled="mediaBusy || isSubmitting"
              @change="handleFileChange"
            />
            <MediaImage
              v-if="photoPreview"
              :key="photoPreview"
              :class="['upload-preview', 'product-image', { visible: photoPreview }]"
              :src="photoPreview"
              :alt="$t('單品照片預覽')"
            />
            <div v-if="preparedMedia" class="upload-choice-row">
              <button v-if="backgroundBusy" type="button" class="text-button" @click="cancelBackgroundRemoval">{{ $t('取消去背') }}</button>
              <button v-if="backgroundRemoved" type="button" class="secondary" :disabled="backgroundBusy || isSubmitting" @click="restoreBackground">{{ $t('還原照片') }}</button>
            </div>
            <p v-if="backgroundMessage" role="status">{{ backgroundMessage }}</p>
            <GarmentCleanup v-if="preparedMedia && !backgroundBusy" :key="selectionSequence" :blob="originalDisplay?.displayBlob" @result="useDisplayBlob" />
          </div>

          <div class="media-status-region" role="status" aria-live="polite" aria-atomic="true">
            <div v-if="mediaStatus !== 'idle'" :class="['media-lifecycle', `is-${mediaStatus}`]">
              <span class="media-lifecycle-dot" aria-hidden="true"></span>
              <span>{{ $t(mediaStatusText) }}<template v-if="mediaStatus === 'uploading' && uploadProgress !== null"> {{ uploadProgress }}%</template></span>
            </div>
            <div v-if="mediaError" class="media-error" role="alert">
              <strong>{{ $t(mediaErrorTitle) }}</strong>
              <p>{{ $t(mediaError) }}</p>
              <button type="button" class="secondary" @click="openGalleryInput">{{ $t("重新選擇") }}</button>
            </div>
            <section v-if="preparedMedia" class="capture-review" aria-labelledby="captureReviewTitle">
              <div class="capture-review-heading">
                <div>
                  <h3 id="captureReviewTitle">{{ $t("照片檢查") }}</h3>
                  <p>{{ preparedMedia.width }} × {{ preparedMedia.height }} · {{ formattedSourceSize }}</p>
                </div>
                <span :class="['quality-badge', { 'has-warning': qualityWarnings.length }]">
                  {{ $t(qualityWarnings.length ? '建議確認' : '清晰可用') }}
                </span>
              </div>
              <ul v-if="qualityWarnings.length" class="quality-warning-list">
                <li v-for="warning in qualityWarnings" :key="warning.code">{{ $t(warning.message) }}</li>
              </ul>
              <label class="single-item-check">
                <input v-model="singleItemConfirmed" type="checkbox" />
                <span>{{ $t("我已確認畫面以一件主要衣物為主") }}</span>
              </label>
              <button
                v-if="qualityWarnings.length && !warningsAcknowledged"
                type="button"
                class="text-button media-continue"
                @click="warningsAcknowledged = true"
              >{{ $t("繼續使用原圖") }}</button>
            </section>
          </div>
        </div>

        <div v-if="preparedMedia" class="vision-controls">
          <p v-if="visionMessage" role="status">{{ visionMessage }}</p>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label for="name">{{ $t("單品名稱") }}</label>
            <input id="name" v-model="form.name" required :placeholder="$t(&quot;例如：亞麻襯衫&quot;)" />
            <p v-if="filenameSuggestion" class="form-hint">{{ $t('名稱與分類參考檔名，請確認後修改。') }}</p>
          </div>
          <div class="form-field">
            <label for="category">{{ $t("分類") }}</label>
            <select id="category" v-model="form.category" required @change="categoryEdited = true">
              <option value="" disabled>{{ $t('請選擇分類') }}</option>
              <option value="Tops">{{ $t("上衣") }}</option>
              <option value="Bottoms">{{ $t("下身") }}</option>
              <option value="Dress">{{ $t("洋裝") }}</option>
              <option value="Outerwear">{{ $t("外套") }}</option>
              <option value="Shoes">{{ $t("鞋履") }}</option>
              <option value="Bags">{{ $t("包款") }}</option>
              <option value="Accessories">{{ $t("配件") }}</option>
            </select>
          </div>

          <div class="form-field full brand-form-field">
            <label for="brand">{{ $t("品牌") }}</label>
            <div class="brand-input-row">
              <input id="brand" v-model="form.brand" :placeholder="$t(&quot;選填&quot;)" />
              <div class="favorite-brand-options" :aria-label="$t(&quot;愛用品牌快速選擇&quot;)">
                <button
                  v-for="brand in brandShortcuts"
                  :key="brand"
                  type="button"
                  class="favorite-brand-option"
                  @click="form.brand = brand"
                >
                  {{ brand }}
                </button>
                <button
                  type="button"
                  class="favorite-brand-option favorite-brand-add"
                  @click="isAddingBrand = !isAddingBrand"
                >{{ $t("＋ 新增品牌") }}</button>
              </div>
            </div>
            <div v-if="isAddingBrand" class="custom-brand-row">
              <input
                id="customBrandName"
                v-model="newBrandName"
                :aria-label="$t(&quot;新增品牌名稱&quot;)"
                :placeholder="$t(&quot;輸入品牌名稱&quot;)"
                @keyup.enter="addCustomBrand"
              />
              <button type="button" class="secondary" @click="addCustomBrand">{{ $t("加入") }}</button>
              <button type="button" class="text-button" @click="isAddingBrand = false">{{ $t("取消") }}</button>
            </div>
            <p v-if="brandError" class="form-hint form-hint-error">{{ $t(brandError) }}</p>
          </div>

          <div class="form-field">
            <label for="primary_color">{{ $t("主要顏色") }}</label>
            <select id="primary_color" v-model="form.primary_color" required @change="handleColorChange">
              <option value="">{{ $t("請選擇主要顏色") }}</option>
              <option v-for="color in availableColors" :key="color" :value="color">{{ $t(color) }}</option>
            </select>
          </div>
          <div class="form-field">
            <label for="secondary_color">{{ $t("色系") }}</label>
            <input id="secondary_color" :value="$t(form.secondary_color)" readonly :placeholder="$t(&quot;選擇主要顏色後自動帶入&quot;)" />
          </div>

          <div v-if="colorAnalysisState !== 'idle'" class="image-intelligence-status" aria-live="polite">
            <span v-if="colorAnalysisState === 'loading'">{{ $t("正在分析圖片主色…") }}</span>
            <span v-else-if="colorAnalysisState === 'success'">{{ $t(colorSuggestion.primaryColor) }}</span>
            <span v-else>{{ $t("無法自動辨識主色，請使用上方手動選擇。") }}</span>
          </div>

          <div class="form-field">
            <label for="style">{{ $t("風格") }}</label>
            <select id="style" v-model="styleChoice">
              <option value="Minimal">{{ $t("極簡") }}</option>
              <option value="Casual">{{ $t("休閒") }}</option>
              <option value="Smart Casual">{{ $t("簡約正式") }}</option>
              <option value="Chic">{{ $t("時髦") }}</option>
              <option value="custom">{{ $t("自訂風格") }}</option>
            </select>
            <input v-if="styleChoice === 'custom'" v-model.trim="form.style" :aria-label="$t('自訂風格')" :placeholder="$t('輸入自訂風格')" maxlength="80" required />
          </div>

          <div class="form-field">
            <label for="season">{{ $t("適合季節") }}</label>
            <select id="season" v-model="form.season">
              <option value="Spring / Summer">{{ $t("春夏") }}</option>
              <option value="Autumn / Winter">{{ $t("秋冬") }}</option>
              <option value="All year">{{ $t("四季") }}</option>
            </select>
          </div>

          <div class="form-field full">
            <label for="notes">{{ $t("備註") }}</label>
            <textarea id="notes" v-model="form.notes" :placeholder="$t(&quot;寫下這件單品的小筆記&quot;)"></textarea>
          </div>

        </div>

        <div class="form-actions">
          <button v-if="isSubmitting && mediaStatus === 'uploading'" type="button" class="secondary" @click="requestUploadCancel">{{ $t("取消上傳") }}</button>
          <button v-else-if="isSubmitting" type="button" class="secondary" disabled>{{ $t("完成儲存中") }}</button>
          <button v-else type="button" class="secondary" @click="close">{{ $t("取消") }}</button>
          <button type="submit" class="primary" :disabled="isSubmitting || mediaBusy || backgroundBusy || (!!mediaError && !preparedMedia)">
            {{ $t(submitButtonText) }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import { ref, reactive, computed, watch, onUnmounted } from 'vue';
import { defaultCurrency } from '@/services/money';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useClosetStore, CLOSET_DATA_MODE } from '@/stores/closet';
import { useAuthStore } from '@/stores/auth';
import { aiGateway } from '@/services/aiGateway';
import { commerceClient, safeCommerceUrl } from '@/services/commerce';
import { getColorFamilyForPrimaryColor, legacyColorNames } from '@/constants';
import { analyzeImageColor } from '@/services/colorDetection';
import { prepareClothingImage, blobToDataUrl } from '@/services/clothingMedia';
import { suggestFromClothingFilename } from '@/services/clothingSuggestions';
import { identifyClothing } from '@/services/clothingVision';
import { removeClothingBackground } from '@/services/clothingCutout';
import GarmentCleanup from '@/components/closet/GarmentCleanup.vue';

const appStore = useAppStore();
const closetStore = useClosetStore();
const authStore = useAuthStore();
const CAPTURE_GUIDE_KEY = 'ootie:capture-guide-seen:v1';

const isEdit = computed(() => !!appStore.editingItemId);

const availableColors = [
  '白色', '黑色', '炭灰色', '米白色',
  '卡其色', '奶茶色', '棕色',
  '暖橙色', '奶油黃', '櫻花粉', '芥末黃',
  '丹寧藍', '天藍色', '軍綠色', '酪梨綠',
  '酒紅色', '薰衣草紫', '玫瑰紅', '葡萄紫'
];

const brandShortcuts = computed(() => {
  const common = ['Uniqlo', 'ZARA', 'H&M', 'COS', 'Nike', 'Adidas'];
  const customBrands = appStore.customBrands || [];
  const closetBrands = appStore.items.map((i) => String(i.brand || '').trim()).filter(Boolean);
  return [...new Map([...common, ...customBrands, ...closetBrands]
    .map((brand) => [String(brand).trim().toLowerCase(), String(brand).trim()])
    .filter(([key]) => key))]
    .map(([, brand]) => brand)
    .slice(0, 12);
});

const photoPreview = ref('');
const cameraInputRef = ref(null);
const galleryInputRef = ref(null);
const showCaptureGuide = ref(
  appStore.isItemFormOpen
  && !appStore.editingItemId
  && localStorage.getItem(CAPTURE_GUIDE_KEY) !== 'true'
);
const isSubmitting = ref(false);
const isAddingBrand = ref(false);
const newBrandName = ref('');
const brandError = ref('');
const colorSuggestion = ref(null);
const colorAnalysisState = ref('idle');
const preparedMedia = ref(null);
const mediaStatus = ref('idle');
const mediaError = ref('');
const warningsAcknowledged = ref(false);
const singleItemConfirmed = ref(false);
const uploadCancelRequested = ref(false);
const uploadProgress = ref(null);
const categoryEdited = ref(false);
const backgroundBusy = ref(false);
let backgroundController;
const backgroundRemoved = ref(false);
const backgroundCancelled = ref(false);
const backgroundMessage = ref('');
const filenameSuggestion = ref(false);
const visionState=ref('idle'), visionMessage=ref('');
let visionController=null;
const visionBusy=computed(()=>['loading','analyzing'].includes(visionState.value));
let originalDisplay = null;
let lastSuggestedName = '';
let categoryWasSuggested = false;
let abortActiveUpload = null;
let previewObjectUrl = '';
let selectionSequence = 0;
const form = reactive({
  name: '',
  category: '',
  brand: '',
  primary_color: '白色',
  secondary_color: '無彩色系',
  shape: '',
  style: 'Casual',
  price: '',
  currency: defaultCurrency(),
  purchase_date: '',
  season: 'All year',
  notes: '',
  photo: ''
});
const standardStyles = ['Minimal', 'Casual', 'Smart Casual', 'Chic'];
const styleChoice = computed({
  get: () => standardStyles.includes(form.style) ? form.style : 'custom',
  set: (value) => { form.style = value === 'custom' ? '' : value; }
});

const qualityWarnings = computed(() => preparedMedia.value?.warnings || []);
const mediaErrorTitle = computed(() => preparedMedia.value ? '尚未儲存完成' : '這張照片目前無法使用');
const mediaBusy = computed(() => ['validating', 'processing'].includes(mediaStatus.value));
const mediaStatusText = computed(() => ({
  selected: '照片已選擇',
  validating: '正在檢查照片…',
  processing: '正在處理…',
  ready: qualityWarnings.value.length ? '建議確認' : '照片已準備完成',
  uploading: '正在上傳…',
  saving: '正在儲存…',
  cancelling: '正在取消…',
  complete: '已儲存到衣櫥',
  error: '處理未完成，照片與表單內容已保留'
}[mediaStatus.value] || ''));
const formattedSourceSize = computed(() => {
  const bytes = preparedMedia.value?.originalBytes || 0;
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
});
const submitButtonText = computed(() => ({
  uploading: '正在上傳…',
  saving: '正在儲存…'
}[mediaStatus.value] || (isSubmitting.value ? '正在處理…' : '儲存到衣櫥')));

const releasePreviewUrl = () => {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = '';
};

const resetMediaSelection = ({ keepExistingPreview = false } = {}) => {
  backgroundController?.abort();
  visionController?.abort(); visionController=null; visionState.value='idle'; visionMessage.value='';
  selectionSequence += 1;
  releasePreviewUrl();
  preparedMedia.value = null;
  mediaStatus.value = 'idle';
  mediaError.value = '';
  warningsAcknowledged.value = false;
  singleItemConfirmed.value = false;
  uploadCancelRequested.value = false;
  uploadProgress.value = null;
  backgroundBusy.value = false;
  backgroundRemoved.value = false;
  backgroundMessage.value = '';
  originalDisplay = null;
  filenameSuggestion.value = false;
  abortActiveUpload = null;
  if (!keepExistingPreview) photoPreview.value = '';
  if (galleryInputRef.value) galleryInputRef.value.value = '';
  if (cameraInputRef.value) cameraInputRef.value.value = '';
};

const handleColorChange = () => {
  if (form.primary_color) {
    form.secondary_color = getColorFamilyForPrimaryColor(form.primary_color);
  }
};

const addCustomBrand = () => {
  const normalizedBrand = newBrandName.value.trim().replace(/\s+/g, ' ');
  if (!normalizedBrand) {
    brandError.value = '請輸入品牌名稱。';
    return;
  }

  const existingBrand = brandShortcuts.value.find(
    (brand) => brand.toLowerCase() === normalizedBrand.toLowerCase()
  );
  if (existingBrand) {
    form.brand = existingBrand;
    brandError.value = '';
    newBrandName.value = '';
    isAddingBrand.value = false;
    return;
  }

  const result = appStore.addCustomBrand(normalizedBrand);
  form.brand = result.brand;
  brandError.value = '';
  newBrandName.value = '';
  isAddingBrand.value = false;
};

const applyColorSuggestion = (suggestion) => {
  if (!suggestion) return;
  form.primary_color = suggestion.primaryColor;
  form.secondary_color = suggestion.colorFamily;
};

const recognizeGarment = async ({ automatic = false } = {}) => {
  if(!preparedMedia.value || visionBusy.value)return;
  const sequence=selectionSequence, originalName=form.name, originalCategory=form.category;
  const allowName=!automatic || !originalName || originalName===lastSuggestedName;
  const allowCategory=!automatic || !categoryEdited.value;
  visionController?.abort(); visionController=new AbortController(); visionMessage.value=''; visionState.value='loading';
  try {
    const suggestion=await identifyClothing(preparedMedia.value.displayBlob,{signal:visionController.signal,onState:state=>{if(sequence===selectionSequence)visionState.value=state;}});
    if(sequence!==selectionSequence || !appStore.isItemFormOpen)return;
    if(suggestion){
      if(allowName && form.name===originalName){form.name=t(suggestion.nameKey);lastSuggestedName=form.name;}
      if(allowCategory && !categoryEdited.value && form.category===originalCategory){form.category=suggestion.category;categoryWasSuggested=true;}
      filenameSuggestion.value=false;visionMessage.value=t('請確認品名與分類。');
    } else visionMessage.value=t('無法確定分類，請自行選擇。');
    visionState.value='done';
  } catch(error){if(error.name!=='AbortError' && sequence===selectionSequence){visionState.value='error';visionMessage.value=t('辨識暫時無法完成，你仍可自行填寫。');}}
};

const analyzeSelectedImage = async (source, sequence) => {
  const originalColor=form.primary_color, originalName=form.name;
  colorAnalysisState.value = 'loading';
  const suggestion = await analyzeImageColor(source);
  if(sequence!==selectionSequence || !appStore.isItemFormOpen)return;
  colorSuggestion.value = suggestion;
  if (suggestion) {
    if(form.primary_color===originalColor)applyColorSuggestion(suggestion);

    colorAnalysisState.value = 'success';
  } else { colorAnalysisState.value = 'failure'; }
};

const rememberCaptureGuide = () => {
  localStorage.setItem(CAPTURE_GUIDE_KEY, 'true');
  showCaptureGuide.value = false;
};

const dismissCaptureGuide = () => {
  rememberCaptureGuide();
};

const openCameraInput = () => {
  cameraInputRef.value?.click();
};

const openGalleryInput = () => {
  galleryInputRef.value?.click();
};

const useDisplayBlob = (media) => {
  releasePreviewUrl();
  preparedMedia.value = { ...preparedMedia.value, ...media, displayMimeType: media.displayBlob.type, displayBytes: media.displayBlob.size };
  previewObjectUrl = URL.createObjectURL(media.displayBlob);
  photoPreview.value = previewObjectUrl;
};

const tryBackgroundRemoval = async () => {
  if (!preparedMedia.value || backgroundBusy.value) return;
  backgroundCancelled.value=false;
  const sequence = selectionSequence;
  backgroundBusy.value = true;
  backgroundMessage.value = '';
  backgroundController = new AbortController();
  try {
    const result = await removeClothingBackground(originalDisplay.displayBlob, {
      category: form.category,
      signal: backgroundController.signal,
      onState: state => { if (sequence === selectionSequence) backgroundMessage.value = t(state === 'loading' ? '首次使用需下載去背模型，照片留在此裝置。' : state === 'queued' ? '等待自動去背…' : '正在自動去背…'); }
    });
    if (sequence !== selectionSequence) return;
    if (!result) {
      backgroundMessage.value = t('去背未完成，可重試或保留原照片。');
      return;
    }
    useDisplayBlob(result);
    backgroundRemoved.value = true;
    backgroundMessage.value = '';
  } catch (failure) {
    if (sequence === selectionSequence && failure.name !== 'AbortError') backgroundMessage.value = t('去背未完成，可重試或保留原照片。');
  } finally {
    if (sequence === selectionSequence) backgroundBusy.value = false;
  }
};

const cancelBackgroundRemoval = () => {
  backgroundCancelled.value=true;
  backgroundController?.abort();
  backgroundBusy.value=false;
  backgroundMessage.value=t('去背已取消。');
};

const restoreBackground = () => {
  if (!originalDisplay) return;
  useDisplayBlob(originalDisplay);
  backgroundRemoved.value = false;
  backgroundMessage.value = '';
};

const closetCategoryForProduct = (product) => product.outfit_layer === 'outer'
  ? 'Outerwear'
  : ({ upper_body: 'Tops', lower_body: 'Bottoms', full_body: 'Dress', shoes: 'Shoes' })[product.category] || '';

const loadSourceProductImage = async (product) => {
  const sequence = selectionSequence;
  const accessToken = authStore.session?.access_token;
  if (product.ownerProfileId !== authStore.profileId) {
    mediaStatus.value = 'error';
    mediaError.value = '登入狀態已變更，請重新開啟想買清單。';
    return;
  }
  if (!product.image_path || !accessToken) {
    mediaStatus.value = 'error';
    mediaError.value = '商品圖片目前無法載入，請重新選擇照片。';
    return;
  }

  let imageUrl = '';
  mediaStatus.value = 'processing';
  try {
    imageUrl = await aiGateway.loadPrivateImage(accessToken, product.image_path);
    if (sequence !== selectionSequence || !appStore.isItemFormOpen) return;
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('商品圖片目前無法載入，請重新選擇照片。');
    const imageBlob = await response.blob();
    const imageFile = new File([imageBlob], 'wishlist-product.jpg', { type: imageBlob.type || 'image/jpeg' });
    const nextMedia = await prepareClothingImage(imageFile);
    if (sequence !== selectionSequence || !appStore.isItemFormOpen) return;

    preparedMedia.value = nextMedia;
    originalDisplay = { displayBlob: nextMedia.displayBlob, width: nextMedia.width, height: nextMedia.height };
    previewObjectUrl = URL.createObjectURL(nextMedia.displayBlob);
    photoPreview.value = previewObjectUrl;
    warningsAcknowledged.value = nextMedia.warnings.length === 0;
    singleItemConfirmed.value = true;
    mediaStatus.value = 'ready';
    void analyzeSelectedImage(previewObjectUrl, sequence);
    await tryBackgroundRemoval();
  } catch (error) {
    if (sequence !== selectionSequence) return;
    mediaStatus.value = 'error';
    mediaError.value = error?.userMessage || error?.message || '商品圖片目前無法載入，請重新選擇照片。';
  } finally {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }
};

watch(
  () => appStore.isItemFormOpen,
  (open) => {
    if (!open) {
      appStore.itemFormSourceProduct = null;
      return;
    }
    isAddingBrand.value = false;
    newBrandName.value = '';
    brandError.value = '';
    colorSuggestion.value = null;
    colorAnalysisState.value = 'idle';
    lastSuggestedName = '';
    categoryWasSuggested = false;
    const sourceProduct = appStore.itemFormSourceProduct;
    categoryEdited.value = !!appStore.editingItemId || !!sourceProduct;
    resetMediaSelection({ keepExistingPreview: true });
    showCaptureGuide.value = !appStore.editingItemId && !sourceProduct && localStorage.getItem(CAPTURE_GUIDE_KEY) !== 'true';
    if (appStore.editingItemId) {
      const item = appStore.items.find((i) => i.id === appStore.editingItemId);
      if (item) {
        const normalizedColor = legacyColorNames[item.primary_color] || item.primary_color || '白色';
        Object.assign(form, {
          name: item.name_zh || item.name || '',
          category: item.category || 'Tops',
          brand: item.brand || '',
          primary_color: normalizedColor,
          secondary_color: item.secondary_color || getColorFamilyForPrimaryColor(normalizedColor) || '無彩色系',
          shape: item.shape || '',
          style: item.style || 'Casual',
          price: item.price !== null && item.price !== undefined ? item.price : '',
          currency: item.currency || 'TWD',
          purchase_date: item.purchase_date || '',
          season: item.season || 'All year',
          notes: item.notes || '',
          photo: item.photo || ''
        });
        photoPreview.value = item.photo || '';
      }
    } else {
      Object.assign(form, {
        name: '',
        category: '',
        brand: '',
        primary_color: '白色',
        secondary_color: '無彩色系',
        shape: '',
        style: 'Casual',
        price: '',
        currency: defaultCurrency(),
        purchase_date: '',
        season: 'All year',
        notes: '',
        photo: ''
      });
      photoPreview.value = '';
      if (sourceProduct) {
        Object.assign(form, {
          name: sourceProduct.title,
          category: closetCategoryForProduct(sourceProduct),
          primary_color: '白色',
          secondary_color: '無彩色系'
        });
        void loadSourceProductImage(sourceProduct);
      }
    }
  },
  { immediate: true }
);

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  backgroundController?.abort();
  rememberCaptureGuide();
  visionController?.abort(); visionState.value='idle'; visionMessage.value='';
  const sequence = ++selectionSequence;
  releasePreviewUrl();
  preparedMedia.value = null;
  originalDisplay = null;
  filenameSuggestion.value = false;
  backgroundBusy.value = false;
  backgroundRemoved.value = false;
  backgroundMessage.value = '';
  mediaError.value = '';
  warningsAcknowledged.value = false;
  singleItemConfirmed.value = false;
  mediaStatus.value = 'selected';
  try {
    mediaStatus.value = 'validating';
    await Promise.resolve();
    mediaStatus.value = 'processing';
    const nextMedia = await prepareClothingImage(file);
    if (sequence !== selectionSequence) return;
    preparedMedia.value = nextMedia;
    originalDisplay = { displayBlob: nextMedia.displayBlob, width: nextMedia.width, height: nextMedia.height };
    if (!isEdit.value) {
      const suggestion = suggestFromClothingFilename(file.name);
      filenameSuggestion.value = !!suggestion;
      if (!form.name || (lastSuggestedName && form.name === lastSuggestedName)) {
        form.name = suggestion?.name || '';
        lastSuggestedName = form.name;
      }
      if (!categoryEdited.value) {
        if (suggestion) { form.category = suggestion.category; categoryWasSuggested = true; }
        else if (categoryWasSuggested) { form.category = ''; categoryWasSuggested = false; }
      }
    }
    previewObjectUrl = URL.createObjectURL(nextMedia.displayBlob);
    photoPreview.value = previewObjectUrl;
    form.photo = '';
    warningsAcknowledged.value = nextMedia.warnings.length === 0;
    mediaStatus.value = 'ready';
    void analyzeSelectedImage(previewObjectUrl, sequence);
    await tryBackgroundRemoval();
    if(sequence === selectionSequence && !backgroundCancelled.value && appStore.isItemFormOpen && !isEdit.value) void recognizeGarment({automatic:true});
  } catch (error) {
    if (sequence !== selectionSequence) return;
    mediaStatus.value = 'error';
    mediaError.value = error?.message || '照片處理失敗，請重新選擇。';
    photoPreview.value = '';
    colorSuggestion.value = null;
    colorAnalysisState.value = 'failure';
  } finally {
    e.target.value = '';
  }
};

const close = () => {
  if (isSubmitting.value) return;
  visionController?.abort();
  resetMediaSelection();
  appStore.isItemFormOpen = false;
  appStore.itemFormSourceProduct = null;
};

const requestUploadCancel = () => {
  uploadCancelRequested.value = true;
  mediaStatus.value = 'cancelling';
  abortActiveUpload?.();
  appStore.showToast('正在安全停止；已上傳但未儲存的檔案會自動清理。', { type: 'info' });
};

const handleSubmit = async () => {
  if (isSubmitting.value || backgroundBusy.value || mediaBusy.value) return;
  if (!isEdit.value && !form.photo) {
    if (!preparedMedia.value) {
      appStore.showToast('請先上傳單品照片');
      return;
    }
  }
  isSubmitting.value = true;
  uploadCancelRequested.value = false;
  uploadProgress.value = null;
  abortActiveUpload = null;
  mediaError.value = '';
  try {
    const payload = { ...form };
    const sourceProduct = appStore.itemFormSourceProduct;
    if (sourceProduct) {
      if (sourceProduct.ownerProfileId !== authStore.profileId) {
        throw new Error('登入狀態已變更，請重新開啟想買清單。');
      }
      if (closetStore.dataMode !== CLOSET_DATA_MODE.REMOTE) {
        throw new Error('請先載入遠端衣櫥，再加入想買商品。');
      }
      const sourceUrl = safeCommerceUrl(sourceProduct.source_url);
      payload.id = sourceProduct.id;
      payload.name_zh = payload.name;
      payload.color_hex = sourceProduct.color || '#c8bba9';
      payload.source_url = sourceUrl || '';
      payload.source_domain = sourceUrl ? new URL(sourceUrl).hostname : '';
    }
    // These fields are no longer editable. Never write their hidden values back
    // when editing an existing item, so old purchase data is preserved.
    if (isEdit.value) {
      delete payload.shape;
      delete payload.price;
      delete payload.currency;
      delete payload.purchase_date;
    }
    if (preparedMedia.value) {
      if (closetStore.dataMode === CLOSET_DATA_MODE.REMOTE) {
        payload.__preparedMedia = preparedMedia.value;
        payload.__mediaOptions = {
          shouldCancel: () => uploadCancelRequested.value,
          onStage: (stage) => { mediaStatus.value = stage; },
          onProgress: (uploadedBytes, totalBytes) => {
            uploadProgress.value = Math.min(100, Math.round((uploadedBytes / totalBytes) * 100));
          },
          registerAbort: (abort) => { abortActiveUpload = abort; }
        };
      } else {
        mediaStatus.value = 'saving';
        payload.photo = await blobToDataUrl(preparedMedia.value.displayBlob);
      }
    }
    const existingSourceItem = sourceProduct
      ? appStore.items.find(item => item.id === sourceProduct.id && item.owner_id === authStore.profileId)
      : null;
    const result = isEdit.value
      ? await closetStore.updateItem(appStore.editingItemId, payload)
      : existingSourceItem
        ? await closetStore.updateItem(existingSourceItem.id, payload)
        : await closetStore.addItem(payload);
    if (result?.ok) {
      if (sourceProduct) {
        mediaStatus.value = 'saving';
        await commerceClient.request(`products/${sourceProduct.id}/state`, authStore.session?.access_token, { state: 'purchased' });
        appStore.wishlistProducts = (appStore.wishlistProducts || []).filter(product => product.id !== sourceProduct.id);
        appStore.showToast('已加入衣櫥。', { type: 'success' });
      }
      mediaStatus.value = 'complete';
      isSubmitting.value = false;
      close();
    } else {
      mediaStatus.value = 'error';
      mediaError.value = result?.error?.userMessage || '儲存失敗，照片與表單內容已保留，可再次嘗試。';
    }
  } catch (error) {
    mediaStatus.value = 'error';
    mediaError.value = error?.message || '儲存失敗，照片與表單內容已保留，可再次嘗試。';
  } finally {
    isSubmitting.value = false;
  }
};

onUnmounted(releasePreviewUrl);
onUnmounted(()=>backgroundController?.abort());
onUnmounted(()=>visionController?.abort());
</script>


<style scoped>
.upload-zone .upload-preview{background:#fff}
</style>
