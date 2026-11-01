<template>
  <div class="sos-form-container">
    <p v-if="contextItem" class="sos-item-context">
      <MediaImage v-if="contextItem.photo" :src="contextItem.photo" :alt="contextItem.name_zh || contextItem.name" style="width:72px;height:90px;object-fit:contain" />
      {{ tf('已帶入單品：{name}', { name: contextItem.name_zh || contextItem.name }) }}
    </p>
    <form :aria-busy="submitting" class="sos-create-form" @submit.prevent="handleSubmit">
      <fieldset :disabled="submitting" class="sos-form-fields">
        <div class="form-field">
          <label for="sosTitle">{{ t("標題") }}</label>
          <input id="sosTitle" v-model="title" required maxlength="120" :placeholder="t('例如：明天第一次約會，我該穿什麼？')" />
        </div>
        <div class="form-field" style="margin-top:16px">
          <label for="sosDetails">{{ t("告訴衣友更多") }}</label>
          <textarea id="sosDetails" v-model="details" required rows="4" :placeholder="t('描述你的行程、期待的感覺或穿搭困擾')"></textarea>
        </div>
        <div class="form-grid" style="margin-top:16px">
          <div class="form-field">
            <label for="sosOccasion">{{ t("場合") }}</label>
            <input id="sosOccasion" v-model.trim="occasion" list="sos-occasions" maxlength="80" required />
            <datalist id="sos-occasions">
              <option value="約會">{{ t("約會") }}</option>
              <option value="工作">{{ t("工作") }}</option>
              <option value="上課">{{ t("上課") }}</option>
              <option value="聚餐">{{ t("聚餐") }}</option>
              <option value="戶外活動">{{ t("戶外活動") }}</option>
              <option value="旅行">{{ t("旅行") }}</option>
            </datalist>
          </div>
          <div class="form-field">
            <label for="sosWeather">{{ t("預期天氣") }}</label>
            <input id="sosWeather" v-model.trim="weather" list="sos-weather-options" maxlength="80" required />
            <datalist id="sos-weather-options">
              <option value="晴天">{{ t("晴天") }}</option>
              <option value="涼爽">{{ t("涼爽") }}</option>
              <option value="炎熱">{{ t("炎熱") }}</option>
              <option value="下雨">{{ t("下雨") }}</option>
              <option value="微涼有風">{{ t("微涼有風") }}</option>
            </datalist>
          </div>
        </div>
        <p class="sos-closet-notice" v-if="!appStore.profile.public_closet">
          <AppIcon name="lock" :size="18" />
          {{ t('請先開啟「公開衣櫥」功能，才能發布求救。') }}
          <router-link to="/closet" @click="handleClosetLinkClick">{{ t('前往我的衣櫥') }}</router-link>
        </p>
        <p class="sos-closet-notice" v-else>
          <AppIcon name="Closet" :size="18" />
          {{ t('目前已公開衣櫥，衣友可以從你的衣櫥提供搭配建議。') }}
        </p>
        <div class="form-field sos-image-section" style="margin-top:20px">
          <div class="sos-image-header">
            <label>{{ t('求救附圖（選填，最多一張）') }}</label>
            <div v-if="coverMode !== 'none'" class="sos-image-actions">
              <button type="button" class="text-button" @click="clearCoverImage">{{ t('移除圖片') }}</button>
            </div>
          </div>

          <div v-if="coverMode === 'none'" class="sos-image-pickers">
            <label class="sos-picker-btn upload-btn" :class="{ disabled: submitting }">
              <AppIcon name="plus" :size="18" />
              <span>{{ t('從電腦上傳圖片') }}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="submitting" @change="handleFileUpload" />
            </label>
            <button
              type="button"
              class="sos-picker-btn closet-btn closet-picker-btn"
              :disabled="submitting || loadingCloset"
              @click="toggleClosetDrawer"
            >
              <AppIcon name="Closet" :size="18" />
              <span>{{ loadingCloset ? t('正在讀取衣櫥…') : t('從我的衣櫥選擇') }}</span>
            </button>
          </div>

          <div v-else-if="coverMode === 'upload'" class="sos-cover-preview-card">
            <div class="sos-cover-preview-thumb">
              <img :src="coverPreviewUrl" :alt="t('求救圖片預覽')" />
            </div>
            <div class="sos-cover-preview-info">
              <strong>{{ coverFile?.name || t('已選擇圖片') }}</strong>
              <span>{{ t('已上傳本機圖片') }}</span>
            </div>
            <label class="secondary replace-btn">
              {{ t('更換圖片') }}
              <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="submitting" @change="handleFileUpload" />
            </label>
          </div>

          <div v-else-if="coverMode === 'closet'" class="sos-cover-preview-card">
            <div class="sos-cover-preview-thumb">
              <MediaImage v-if="selectedClosetItem?.photo" :src="selectedClosetItem.photo" :alt="selectedClosetItem?.name_zh || selectedClosetItem?.name" />
            </div>
            <div class="sos-cover-preview-info">
              <strong>{{ selectedClosetItem?.name_zh || selectedClosetItem?.name || t('已選擇單品') }}</strong>
              <span>{{ t('來自我的衣櫥') }}</span>
            </div>
            <button type="button" class="secondary" @click="toggleClosetDrawer">
              {{ showClosetDrawer ? t('收合清單') : t('更換單品') }}
            </button>
          </div>

          <div v-if="showClosetDrawer" class="sos-closet-drawer">
            <div class="sos-closet-drawer-header">
              <strong>{{ t('選擇一件衣櫥單品作為附圖') }}</strong>
              <span v-if="loadingCloset">{{ t('正在讀取衣櫥…') }}</span>
            </div>
            <p v-if="closetLoadFailed" class="sos-form-error" role="alert">
              {{ t('衣櫥無法載入，請重新整理後再試。') }}
            </p>
            <div v-else-if="myAvailableItems.length" class="sos-selection-grid">
              <label
                v-for="item in myAvailableItems"
                :key="item.id"
                :class="['sos-selection-card', { selected: coverItemId === item.id }]"
                @click="selectClosetItem(item)"
              >
                <input
                  type="radio"
                  name="coverItemRadio"
                  :value="item.id"
                  :checked="coverItemId === item.id"
                  @change="selectClosetItem(item)"
                />
                <MediaImage class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
                <span class="sos-selection-card-name">{{ item.name_zh || item.name }}</span>
                <span v-if="coverItemId === item.id" class="sos-selection-check" aria-hidden="true">✓</span>
              </label>
            </div>
            <div v-else-if="closetLoaded" style="padding: 16px; text-align:center; color:var(--muted); font-size:13px;">
              {{ t('你的衣櫥中沒有可用的公開單品。') }}
            </div>
          </div>
        </div>

        <p v-if="submitError" class="sos-form-error" role="alert">{{ submitError }}</p>

        <div class="form-actions" style="margin-top:28px">
          <button v-if="isModal" type="button" class="secondary form-cancel-btn" @click="$emit('cancel')">
            {{ $t("取消") }}
          </button>
          <router-link v-else to="/sos" class="secondary form-cancel-btn">{{ $t("取消") }}</router-link>
          <button type="submit" class="primary" :disabled="appStore.profile.public_closet !== true || submitting">
            {{ submitting ? t('正在發布…') : t('確認發布') }}
          </button>
        </div>
      </fieldset>
    </form>
  </div>
</template>


<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { t, tf } from '@/i18n';
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { validateOotdImage, uploadOotdImage } from '@/services/ootdMedia';
import { getItemById } from '@/services/clothingRepository';
import { acquireMedia, isDeferredMedia, releaseMedia } from '@/services/mediaMemory';

const props = defineProps({
  isModal: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['success', 'cancel']);

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const sosStore = useSosStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();

const title = ref('');
const details = ref('');
const occasion = ref('約會');
const weather = ref('晴天');
const submitting = ref(false);
const loadingCloset = ref(false);
const closetLoadFailed = ref(false);
const closetLoaded = ref(false);
const submitError = ref('');

const coverMode = ref('none');
const coverFile = ref(null);
const coverPreviewUrl = ref('');
const coverItemId = ref(null);
const showClosetDrawer = ref(false);

const contextItemId = computed(() => route?.query?.item_id || appStore.sosTargetItemId || null);
const contextItem = ref(null);

const resolveContextItem = async (profileId) => {
  if (!contextItemId.value) {
    contextItem.value = null;
    return;
  }
  let item = appStore.items.find(i => String(i.id) === String(contextItemId.value) && i.owner_id === profileId);
  if (!item) {
    try {
      const fetched = await getItemById(contextItemId.value);
      if (fetched && fetched.owner_id === profileId) {
        item = fetched;
      }
    } catch {
      // ignore
    }
  }
  if (item) {
    contextItem.value = item;
    const name = item.name_zh || item.name || '這件單品';
    if (!title.value) title.value = tf('這件{name}，想請衣友幫忙搭配', { name });
    if (!details.value) details.value = tf('我很少穿這件{name}，想請衣友幫我找找適合的搭配。', { name });
    if (!item.hidden) {
      coverMode.value = 'closet';
      coverItemId.value = item.id;
    }
  }
};

const myAvailableItems = computed(() => appStore.items.filter(i => !i.hidden && i.owner_id === authStore.profileId));
const selectedClosetItem = computed(() => {
  if (!coverItemId.value) return null;
  if (contextItem.value && String(contextItem.value.id) === String(coverItemId.value)) {
    return contextItem.value;
  }
  return appStore.items.find(i => String(i.id) === String(coverItemId.value)) || null;
});

const clearCoverImage = () => {
  coverMode.value = 'none';
  coverFile.value = null;
  coverPreviewUrl.value = '';
  coverItemId.value = null;
  showClosetDrawer.value = false;
};

const handleFileUpload = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  submitError.value = '';
  try {
    validateOotdImage(file);
    coverFile.value = file;
    coverItemId.value = null;
    coverMode.value = 'upload';
    showClosetDrawer.value = false;
    const reader = new FileReader();
    reader.onload = e => { coverPreviewUrl.value = e.target.result; };
    reader.readAsDataURL(file);
  } catch (error) {
    coverFile.value = null;
    coverPreviewUrl.value = '';
    coverMode.value = 'none';
    submitError.value = error?.userMessage || t('照片格式不支援或檔案過大，請重新選擇。');
    appStore.showToast(submitError.value, { type: 'error' });
  } finally {
    event.target.value = '';
  }
};
const toggleClosetDrawer = async () => {
  showClosetDrawer.value = !showClosetDrawer.value;
  if (showClosetDrawer.value && !closetLoaded.value) {
    await loadWardrobe();
  }
};

const loadWardrobe = async () => {
  if (loadingCloset.value) return;
  loadingCloset.value = true;
  closetLoadFailed.value = false;
  submitError.value = '';
  try {
    const profileId = authStore.profileId;
    const result = await closetStore.loadRemoteItems(profileId);
    if (!result?.ok) {
      closetLoadFailed.value = true;
    } else {
      closetLoaded.value = true;
    }
  } catch {
    closetLoadFailed.value = true;
  } finally {
    loadingCloset.value = false;
  }
};

const selectClosetItem = (item) => {
  coverMode.value = 'closet';
  coverItemId.value = item.id;
  coverFile.value = null;
  coverPreviewUrl.value = '';
  showClosetDrawer.value = false;
};

const handleClosetLinkClick = () => {
  if (props.isModal) {
    emit('cancel');
  }
};

const selectedCoverFile = async (profileId) => {
  let item = selectedClosetItem.value;
  if (!item) {
    item = appStore.items.find(entry => String(entry.id) === String(coverItemId.value));
  }
  if (!item?.photo) {
    item = await getItemById(coverItemId.value);
  }
  if (!item?.photo || item.owner_id !== profileId || item.hidden) throw new Error('COVER_UNAVAILABLE');
  const deferred = isDeferredMedia(item.photo);
  const photoUrl = deferred ? await acquireMedia(item.photo) : item.photo;
  try {
    const response = await fetch(photoUrl);
    if (!response.ok) throw new Error('COVER_UNAVAILABLE');
    const blob = await response.blob();
    const file = new File([blob], 'sos-cover', { type: blob.type });
    validateOotdImage(file);
    return file;
  } finally {
    if (deferred) releaseMedia(item.photo);
  }
};

const initForm = async () => {
  submitError.value = '';
  if (!authStore.isMember) {
    appStore.openLoginGate('AUTH_REQUIRED', route?.fullPath || '/sos');
    return;
  }
  const profileId = authStore.profileId;
  if (!profileId) return;
  await resolveContextItem(profileId);
};

onMounted(() => { initForm(); });
watch(() => route?.query?.item_id, () => { initForm(); });
watch(() => appStore.sosTargetItemId, () => { initForm(); });

const handleSubmit = async () => {
  if (submitting.value) return;
  if (appStore.profile.public_closet !== true) {
    appStore.showToast(t('請先開啟「公開衣櫥」功能，才能發布求救。'));
    return;
  }
  const userId = authStore.user?.id;
  const profileId = authStore.profileId;
  if (!userId || !profileId || !authStore.isMember) return;

  submitting.value = true;
  submitError.value = '';

  if (coverMode.value === 'upload' && !coverFile.value) {
    submitting.value = false;
    appStore.showToast(t('請選擇圖片，或點擊「移除圖片」。'), { type: 'warning' });
    return;
  }
  if (coverMode.value === 'closet' && !coverItemId.value) {
    submitting.value = false;
    appStore.showToast(t('請重新選擇求救附圖。'), { type: 'warning' });
    return;
  }

  let uploaded = null;
  let success = false;

  try {
    if (coverMode.value !== 'none') {
      const file = coverMode.value === 'upload' ? coverFile.value : await selectedCoverFile(profileId);
      uploaded = await uploadOotdImage(file, userId);
    }

    success = await sosStore.createSosPost({
      title: title.value,
      details: details.value,
      occasion: occasion.value,
      weather: weather.value,
      when_label: null,
      vibes: [],
      closet_item_ids: [],
      cover_url: uploaded?.publicUrl || null,
      cover_path: uploaded?.path || null,
      cover_item_id: coverMode.value === 'closet' ? coverItemId.value : null
    });
  } catch (err) {
    submitError.value = err?.userMessage || t('圖片上傳失敗，請再試一次。');
    appStore.showToast(submitError.value, { type: 'error' });
  } finally {
    submitting.value = false;
  }

  if (success) {
    appStore.sosTargetItemId = null;
    sosStore.activeTab = 'sent';
    if (props.isModal) {
      emit('success');
    } else {
      router.push('/sos');
    }
  }
};
</script>


<style scoped>
.sos-form-container { width: 100%; }
.sos-item-context { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--accent-yellow-soft, #fdf8e2); border-radius: 12px; margin-bottom: 20px; font-size: 14px; font-weight: 500; }
.sos-form-fields { border: 0; padding: 0; margin: 0; }
.sos-closet-notice { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f7f4f8; border-radius: 12px; margin: 20px 0; font-size: 13px; color: var(--ink); }
.sos-closet-notice a { margin-left: auto; font-weight: 600; color: var(--accent-violet-ink, #6b5280); }
.sos-image-section { padding-top: 12px; border-top: 1px solid var(--line, #ece7ea); }
.sos-image-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.text-button { background: none; border: 0; color: var(--muted, #8e8890); font-size: 13px; cursor: pointer; padding: 4px 8px; }
.text-button:hover { color: #a65f5b; }
.sos-image-pickers { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sos-picker-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; border: 1px dashed var(--line, #d8d0d6); border-radius: 14px; background: #faf8fa; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--ink); transition: all 0.2s ease; position: relative; }
.sos-picker-btn input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.sos-picker-btn:hover:not(.disabled):not(:disabled) { border-color: var(--ink); background: #f4eff3; }
.sos-picker-btn.disabled, .sos-picker-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sos-cover-preview-card { display: flex; align-items: center; gap: 16px; padding: 14px 18px; border: 1px solid var(--line, #ece7ea); border-radius: 14px; background: #faf8fa; }
.sos-cover-preview-thumb { width: 64px; height: 80px; border-radius: 10px; overflow: hidden; background: #fff; display: grid; place-items: center; flex-shrink: 0; }
.sos-cover-preview-thumb img, .sos-cover-preview-thumb :deep(img) { width: 100%; height: 100%; object-fit: contain; }
.sos-cover-preview-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.sos-cover-preview-info strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sos-cover-preview-info span { font-size: 12px; color: var(--muted, #8e8890); }
.replace-btn { position: relative; overflow: hidden; cursor: pointer; }
.replace-btn input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.sos-closet-drawer { margin-top: 16px; padding: 16px; background: #faf8fa; border-radius: 14px; border: 1px solid var(--line, #ece7ea); }
.sos-closet-drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; }
.sos-selection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px; max-height: 240px; overflow-y: auto; padding-right: 4px; }
.sos-selection-card { position: relative; display: flex; flex-direction: column; align-items: center; padding: 8px; border: 1.5px solid var(--line, #e2dce0); border-radius: 10px; background: #fff; cursor: pointer; text-align: center; }
.sos-selection-card input[type="radio"] { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.sos-selection-card.selected { border-color: var(--ink, #1f1e21); box-shadow: 0 0 0 1px var(--ink, #1f1e21); }
.sos-selection-card .product-image { width: 100%; aspect-ratio: 1; object-fit: contain; }
.sos-selection-card-name { margin-top: 6px; font-size: 11px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sos-selection-check { position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; background: var(--ink, #1f1e21); color: #fff; border-radius: 50%; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
.sos-form-error { margin-top: 12px; color: #a65f5b; font-size: 13px; }
.form-actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
.form-cancel-btn { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
@media (max-width: 600px) {
  .sos-image-pickers { grid-template-columns: 1fr; }
}
</style>