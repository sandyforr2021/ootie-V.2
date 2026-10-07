<template>
  <div v-if="appStore.isOotdFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal ootd-form-modal">
      <button class="modal-close" aria-label="關閉" @click="close">×</button>
      <p class="eyebrow">分享今天的穿搭</p>
      <h2>{{ isEditing ? '編輯 OOTD' : '發布 OOTD' }}</h2>
      <form @submit.prevent="handleSubmit">
        <div class="form-field">
          <label for="ootdPhotoFile">穿搭照片</label>
          <label class="ootd-upload" for="ootdPhotoFile" :aria-busy="imageStatus === 'loading'">
            <strong>上傳你的 OOTD</strong>
            <span>JPEG、PNG 或 WebP，最多 10 MB</span>
            <input
              id="ootdPhotoFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="handleFileChange"
            />
            <img
              :class="['ootd-upload-preview', { visible: photoPreview }]"
              :src="photoPreview"
              alt="OOTD 預覽"
            />
            <small v-if="imageStatus === 'loading'" class="ootd-form-status">正在讀取圖片…</small>
            <small v-else-if="imageError" class="ootd-form-error" role="alert">{{ imageError }}</small>
          </label>
        </div>

        <div class="form-field" style="margin-top:16px">
          <label for="ootdCaption">Caption</label>
          <textarea
            id="ootdCaption"
            v-model="caption"
            required
            placeholder="今天這套穿搭，想和衣友分享什麼？"
          ></textarea>
        </div>

        <div class="form-field" style="margin-top:16px">
          <label for="ootdHashtags">Hashtags</label>
          <input
            id="ootdHashtags"
            v-model="hashtags"
            placeholder="#minimal #dailylook"
          />
        </div>

        <div class="form-field" style="margin-top:16px">
          <label>標註衣櫥單品</label>
          <p class="form-help">可不選；發布時會再次確認單品屬於你的遠端衣櫥。</p>
          <p v-if="closetLoading" class="form-help">正在載入你的遠端衣櫥…</p>
          <div v-else-if="remoteClosetItems.length" class="sos-selection-grid ootd-item-selector">
            <label
              v-for="item in remoteClosetItems"
              :key="item.id"
              :class="['sos-selection-card', 'ootd-item-option', { selected: selectedItemIds.includes(item.id) }]"
            >
              <input
                type="checkbox"
                :value="item.id"
                v-model="selectedItemIds"
                :aria-label="`標註 ${item.name_zh || item.name}`"
              />
              <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
              <span class="ootd-item-tag">{{ item.name_zh || item.name }}</span>
              <span class="sos-selection-check" aria-hidden="true">✓</span>
            </label>
          </div>
          <p v-else class="form-help">衣櫥目前沒有可標註的單品，仍可直接發布 OOTD。</p>
        </div>

        <p v-if="submitError" class="ootd-form-error" role="alert">{{ submitError }}</p>

        <div class="form-actions">
          <button type="button" class="secondary" :disabled="ootdStore.publishing" @click="close">取消</button>
          <button type="submit" class="primary" :disabled="ootdStore.publishing || imageStatus === 'loading'">
            {{ ootdStore.publishing ? '正在發布…' : (isEditing ? '儲存修改' : '發布 OOTD') }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { validateOotdImage } from '@/services/ootdMedia';
import { getCurrentUserItems } from '@/services/clothingRepository';

const appStore = useAppStore();
const authStore = useAuthStore();
const ootdStore = useOotdStore();

const photo = ref('');
const photoPreview = ref('');
const photoFile = ref(null);
const caption = ref('');
const hashtags = ref('');
const selectedItemIds = ref([]);
const imageStatus = ref('empty');
const imageError = ref('');
const submitError = ref('');
const remoteClosetItems = ref([]);
const closetLoading = ref(false);

const isEditing = computed(() => Boolean(ootdStore.editingPostId));

watch(
  () => appStore.isOotdFormOpen,
  async (open) => {
    if (!open) return;
    if (!authStore.isMember) {
      appStore.isOotdFormOpen = false;
      appStore.openLoginGate('OOTD_PUBLISH_AUTH_REQUIRED', '/explore?quick=add-ootd');
      return;
    }
    photoFile.value = null;
    imageError.value = '';
    submitError.value = '';
    closetLoading.value = true;
    try {
      const items = await getCurrentUserItems(authStore.profileId);
      remoteClosetItems.value = Array.isArray(items) ? items : [];
    } catch (_) {
      remoteClosetItems.value = [];
    } finally {
      closetLoading.value = false;
    }
    if (ootdStore.editingPostId) {
      const post = appStore.ootdPosts.find(
        (item) => String(item.id) === String(ootdStore.editingPostId)
      );
      if (post) {
        photo.value = post.image || '';
        photoPreview.value = post.image || '';
        caption.value = post.caption || '';
        hashtags.value = (post.hashtags || []).join(' ');
        selectedItemIds.value = post.item_ids || post.itemIds || [];
        imageStatus.value = post.image ? 'ready' : 'empty';
        return;
      }
    }
    photo.value = '';
    photoPreview.value = '';
    caption.value = '';
    hashtags.value = '';
    selectedItemIds.value = [];
    imageStatus.value = 'empty';
  }
);

const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  imageError.value = '';
  submitError.value = '';
  try {
    validateOotdImage(file);
  } catch (error) {
    photoFile.value = null;
    imageStatus.value = 'invalid';
    imageError.value = error.userMessage || '無法使用這張圖片。';
    e.target.value = '';
    return;
  }
  imageStatus.value = 'loading';
  const reader = new FileReader();
  reader.onload = (evt) => {
    photoFile.value = file;
    photoPreview.value = evt.target.result;
    imageStatus.value = 'ready';
  };
  reader.onerror = () => {
    photoFile.value = null;
    imageStatus.value = 'invalid';
    imageError.value = '圖片讀取失敗，請重新選擇。';
  };
  reader.readAsDataURL(file);
};

const close = () => {
  ootdStore.editingPostId = null;
  appStore.isOotdFormOpen = false;
};

const handleSubmit = async () => {
  submitError.value = '';
  if ((!isEditing.value && !photoFile.value) || (isEditing.value && !photoPreview.value)) {
    appStore.showToast('請先上傳一張 OOTD 照片');
    return;
  }
  let result;
  if (isEditing.value) {
    result = await ootdStore.updatePost(ootdStore.editingPostId, {
      imageFile: photoFile.value,
      image: photo.value,
      caption: caption.value,
      hashtags: hashtags.value,
      selectedItemIds: selectedItemIds.value
    });
  } else {
    result = await ootdStore.createPost({
      imageFile: photoFile.value,
      caption: caption.value,
      hashtags: hashtags.value,
      selectedItemIds: selectedItemIds.value
    });
  }
  if (result?.syncStatus === 'SYNCED') close();
  else submitError.value = result?.error?.userMessage || '發布未完成，草稿與圖片預覽已保留，可稍後重試。';
};
</script>

