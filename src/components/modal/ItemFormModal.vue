<template>
  <div v-if="appStore.isItemFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal form-modal">
      <button class="modal-close" aria-label="關閉" :disabled="isSubmitting" @click="close">×</button>
      <p class="eyebrow">{{ isEdit ? '編輯你的單品' : '新增單品' }}</p>
      <h2>{{ isEdit ? '編輯單品' : '加入衣櫥' }}</h2>

      <form @submit.prevent="handleSubmit">
        <div class="form-field full">
          <div class="field-label-row">
            <label for="photoFile">上傳單品照片</label>
            <button
              v-if="!isEdit && !showCaptureGuide"
              class="capture-guide-link"
              type="button"
              @click="showCaptureGuide = true"
            >
              拍攝指南
            </button>
          </div>

          <section
            v-if="!isEdit && showCaptureGuide"
            class="capture-guide"
            aria-labelledby="captureGuideTitle"
          >
            <div class="capture-guide-heading">
              <div>
                <h3 id="captureGuideTitle">讓衣服完整入鏡就好</h3>
                <p>不需要棚拍，也不用整理成商品照。自然拍攝，OOTIE 會保留你的真實衣櫥。</p>
              </div>
              <button type="button" class="capture-guide-skip" @click="dismissCaptureGuide">先略過</button>
            </div>
            <ol class="capture-guide-steps">
              <li><span>1</span><strong>整件入鏡</strong><small>領口、袖子和下擺都留一點空間</small></li>
              <li><span>2</span><strong>光線均勻</strong><small>靠近窗邊，避免強烈背光或陰影</small></li>
              <li><span>3</span><strong>一次一件</strong><small>平放、掛起或放在椅面都可以</small></li>
            </ol>
            <div class="capture-guide-actions">
              <button type="button" class="primary" @click="openCameraInput">開始拍照</button>
              <button type="button" class="secondary" @click="openGalleryInput">從相簿選擇</button>
            </div>
          </section>

          <div class="upload-zone">
            <strong>{{ photoPreview ? '已選擇照片' : '加入一張單品照片' }}</strong>
            <span>可直接拍照或選擇既有照片，支援 JPEG、PNG、WebP；單檔上限 20 MB</span>
            <div class="upload-choice-row">
              <button type="button" class="secondary" :disabled="mediaBusy || isSubmitting" @click="openCameraInput">{{ photoPreview ? '重新拍攝' : '拍照' }}</button>
              <button type="button" class="secondary" :disabled="mediaBusy || isSubmitting" @click="openGalleryInput">{{ photoPreview ? '重新選擇' : '從相簿選擇' }}</button>
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
              aria-label="使用相機拍攝單品"
              :disabled="mediaBusy || isSubmitting"
              @change="handleFileChange"
            />
            <img
              :class="['upload-preview', 'product-image', { visible: photoPreview }]"
              :src="photoPreview"
              :alt="form.name ? `${form.name}照片預覽` : '單品照片預覽'"
            />
          </div>

          <div class="media-status-region" role="status" aria-live="polite" aria-atomic="true">
            <div v-if="mediaStatus !== 'idle'" :class="['media-lifecycle', `is-${mediaStatus}`]">
              <span class="media-lifecycle-dot" aria-hidden="true"></span>
              <span>{{ mediaStatusText }}</span>
            </div>
            <div v-if="mediaError" class="media-error" role="alert">
              <strong>{{ mediaErrorTitle }}</strong>
              <p>{{ mediaError }}</p>
              <button type="button" class="secondary" @click="openGalleryInput">重新選擇</button>
            </div>
            <section v-if="preparedMedia" class="capture-review" aria-labelledby="captureReviewTitle">
              <div class="capture-review-heading">
                <div>
                  <h3 id="captureReviewTitle">照片檢查</h3>
                  <p>{{ preparedMedia.width }} × {{ preparedMedia.height }} · {{ formattedSourceSize }}</p>
                </div>
                <span :class="['quality-badge', { 'has-warning': qualityWarnings.length }]">
                  {{ qualityWarnings.length ? '建議確認' : '清晰可用' }}
                </span>
              </div>
              <ul v-if="qualityWarnings.length" class="quality-warning-list">
                <li v-for="warning in qualityWarnings" :key="warning.code">{{ warning.message }}</li>
              </ul>
              <p v-else class="quality-pass">亮度、清晰度與解析度的初步檢查均可使用。</p>
              <label class="single-item-check">
                <input v-model="singleItemConfirmed" type="checkbox" />
                <span>我已確認畫面以一件主要衣物為主</span>
              </label>
              <button
                v-if="qualityWarnings.length && !warningsAcknowledged"
                type="button"
                class="text-button media-continue"
                @click="warningsAcknowledged = true"
              >
                繼續使用原圖
              </button>
            </section>
          </div>

          <div v-if="preparedMedia" class="background-choice" aria-label="圖片處理方式">
            <span class="background-choice-option is-active">保留原圖</span>
            <span class="background-choice-option is-disabled" aria-disabled="true">整理背景（尚未提供）</span>
          </div>
          <p class="capture-privacy-note">
            上傳不會自動發布。會員照片會保留私有原檔，顯示用版本只做方向校正、縮放與適度壓縮，不會套用改色濾鏡。
          </p>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label for="name">單品名稱</label>
            <input id="name" v-model="form.name" required placeholder="例如：亞麻襯衫" />
          </div>
          <div class="form-field">
            <label for="category">分類</label>
            <select id="category" v-model="form.category">
              <option value="Tops">上衣</option>
              <option value="Bottoms">下身</option>
              <option value="Dress">洋裝</option>
              <option value="Outerwear">外套</option>
              <option value="Shoes">鞋履</option>
              <option value="Bags">包款</option>
              <option value="Accessories">配件</option>
            </select>
          </div>

          <div class="form-field full brand-form-field">
            <label for="brand">品牌</label>
            <div class="brand-input-row">
              <input id="brand" v-model="form.brand" placeholder="選填" />
              <div class="favorite-brand-options" aria-label="愛用品牌快速選擇">
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
                >
                  ＋ 新增品牌
                </button>
              </div>
            </div>
            <div v-if="isAddingBrand" class="custom-brand-row">
              <input
                id="customBrandName"
                v-model="newBrandName"
                aria-label="新增品牌名稱"
                placeholder="輸入品牌名稱"
                @keyup.enter="addCustomBrand"
              />
              <button type="button" class="secondary" @click="addCustomBrand">加入</button>
              <button type="button" class="text-button" @click="isAddingBrand = false">取消</button>
            </div>
            <p v-if="brandError" class="form-hint form-hint-error">{{ brandError }}</p>
          </div>

          <div class="form-field">
            <label for="primary_color">主要顏色</label>
            <select id="primary_color" v-model="form.primary_color" required @change="handleColorChange">
              <option value="">請選擇主要顏色</option>
              <option v-for="color in availableColors" :key="color" :value="color">{{ color }}</option>
            </select>
          </div>
          <div class="form-field">
            <label for="secondary_color">色系</label>
            <input id="secondary_color" v-model="form.secondary_color" readonly placeholder="選擇主要顏色後自動帶入" />
          </div>

          <div v-if="colorAnalysisState !== 'idle'" class="image-intelligence-status" aria-live="polite">
            <span v-if="colorAnalysisState === 'loading'">正在分析圖片主色…</span>
            <span v-else-if="colorAnalysisState === 'success'">
              圖片主色建議：{{ colorSuggestion.primaryColor }}（{{ colorSuggestion.colorFamily }}），可手動修改
            </span>
            <span v-else>無法自動辨識主色，請使用上方手動選擇。</span>
          </div>

          <div class="form-field">
            <label for="shape">版型／款式</label>
            <input id="shape" v-model="form.shape" placeholder="例如：寬鬆版型" />
          </div>
          <div class="form-field">
            <label for="style">風格</label>
            <select id="style" v-model="form.style">
              <option value="Minimal">極簡</option>
              <option value="Casual">休閒</option>
              <option value="Smart Casual">簡約正式</option>
              <option value="Chic">時髦</option>
            </select>
          </div>

          <div class="form-field">
            <label for="price">購買價格（選填）</label>
            <input
              id="price"
              v-model="form.price"
              type="number"
              min="0.01"
              step="0.01"
              inputmode="decimal"
              placeholder="例如：1280"
            />
          </div>

          <div class="form-field">
            <label for="season">適合季節</label>
            <select id="season" v-model="form.season">
              <option value="Spring / Summer">春夏</option>
              <option value="Autumn / Winter">秋冬</option>
              <option value="All year">四季</option>
            </select>
          </div>

          <div class="form-field full">
            <label for="notes">備註</label>
            <textarea id="notes" v-model="form.notes" placeholder="寫下這件單品的小筆記"></textarea>
          </div>

        </div>

        <div class="form-actions">
          <button v-if="isSubmitting && mediaStatus === 'uploading'" type="button" class="secondary" @click="requestUploadCancel">取消上傳</button>
          <button v-else-if="isSubmitting" type="button" class="secondary" disabled>完成儲存中</button>
          <button v-else type="button" class="secondary" @click="close">取消</button>
          <button type="submit" class="primary" :disabled="isSubmitting || mediaBusy || (!!mediaError && !preparedMedia)">
            {{ submitButtonText }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onUnmounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClosetStore, CLOSET_DATA_MODE } from '@/stores/closet';
import { getColorFamilyForPrimaryColor, legacyColorNames } from '@/constants';
import { analyzeImageColor } from '@/services/colorDetection';
import { prepareClothingImage, blobToDataUrl } from '@/services/clothingMedia';

const appStore = useAppStore();
const closetStore = useClosetStore();
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
let abortActiveUpload = null;
let previewObjectUrl = '';
let selectionSequence = 0;
const form = reactive({
  name: '',
  category: 'Tops',
  brand: '',
  primary_color: '白色',
  secondary_color: '無彩色系',
  shape: '',
  style: 'Casual',
  price: '',
  season: 'All year',
  notes: '',
  photo: ''
});

const qualityWarnings = computed(() => preparedMedia.value?.warnings || []);
const mediaErrorTitle = computed(() => preparedMedia.value ? '尚未儲存完成' : '這張照片目前無法使用');
const mediaBusy = computed(() => ['validating', 'processing'].includes(mediaStatus.value));
const mediaStatusText = computed(() => ({
  selected: '照片已選擇',
  validating: '正在檢查檔案格式與內容…',
  processing: '正在校正方向並建立顯示用版本…',
  ready: qualityWarnings.value.length ? '照片可使用，請查看下方建議' : '照片已準備完成',
  uploading: uploadProgress.value === null
    ? '正在安全上傳原圖與顯示用版本…'
    : `正在安全上傳原圖… ${uploadProgress.value}%`,
  saving: '正在儲存衣櫥資料…',
  cancelling: '正在停止並清理未完成的上傳…',
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
  selectionSequence += 1;
  releasePreviewUrl();
  preparedMedia.value = null;
  mediaStatus.value = 'idle';
  mediaError.value = '';
  warningsAcknowledged.value = false;
  singleItemConfirmed.value = false;
  uploadCancelRequested.value = false;
  uploadProgress.value = null;
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

const analyzeSelectedImage = async (source) => {
  colorAnalysisState.value = 'loading';
  const suggestion = await analyzeImageColor(source);
  colorSuggestion.value = suggestion;
  if (suggestion) {
    applyColorSuggestion(suggestion);
    colorAnalysisState.value = 'success';
  } else {
    colorAnalysisState.value = 'failure';
  }
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

watch(
  () => appStore.isItemFormOpen,
  (open) => {
    if (!open) return;
    isAddingBrand.value = false;
    newBrandName.value = '';
    brandError.value = '';
    colorSuggestion.value = null;
    colorAnalysisState.value = 'idle';
    resetMediaSelection({ keepExistingPreview: true });
    showCaptureGuide.value = !appStore.editingItemId && localStorage.getItem(CAPTURE_GUIDE_KEY) !== 'true';
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
          season: item.season || 'All year',
          notes: item.notes || '',
          photo: item.photo || ''
        });
        photoPreview.value = item.photo || '';
      }
    } else {
      Object.assign(form, {
        name: '',
        category: 'Tops',
        brand: '',
        primary_color: '白色',
        secondary_color: '無彩色系',
        shape: '',
        style: 'Casual',
        price: '',
        season: 'All year',
        notes: '',
        photo: ''
      });
      photoPreview.value = '';
    }
  }
);

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  rememberCaptureGuide();
  const sequence = ++selectionSequence;
  releasePreviewUrl();
  preparedMedia.value = null;
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
    previewObjectUrl = URL.createObjectURL(nextMedia.displayBlob);
    photoPreview.value = previewObjectUrl;
    form.photo = '';
    warningsAcknowledged.value = nextMedia.warnings.length === 0;
    mediaStatus.value = 'ready';
    void analyzeSelectedImage(previewObjectUrl);
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
  resetMediaSelection();
  appStore.isItemFormOpen = false;
};

const requestUploadCancel = () => {
  uploadCancelRequested.value = true;
  mediaStatus.value = 'cancelling';
  abortActiveUpload?.();
  appStore.showToast('正在安全停止；已上傳但未儲存的檔案會自動清理。', { type: 'info' });
};

const handleSubmit = async () => {
  if (isSubmitting.value) return;
  if (!isEdit.value && !form.photo) {
    if (!preparedMedia.value) {
      appStore.showToast('請先上傳單品照片');
      return;
    }
  }
  if (form.price !== '' && form.price !== null) {
    const numPrice = Number(form.price);
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      appStore.showToast('購買價格請輸入正數');
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
    const result = isEdit.value
      ? await closetStore.updateItem(appStore.editingItemId, payload)
      : await closetStore.addItem(payload);
    if (result?.ok) {
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
</script>

