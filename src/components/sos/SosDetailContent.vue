<template>
  <div class="sos-detail-content-container">
    <div class="sos-detail-heading">
      <h2>{{ post.title }}</h2>
      <MediaImage v-if="post.cover_url || coverItem?.photo" class="sos-cover-image" :src="post.cover_url || coverItem.photo" :alt="t('求救主圖')" />

      <div class="sos-detail-user">
        <div class="sos-feed-avatar">
          <MediaImage v-if="post.avatar_url" :src="post.avatar_url" alt="" />
          <span v-else>{{ post.initials }}</span>
        </div>
        <div>
          <strong>{{ post.display_name || post.username }}</strong>
          <span>
            {{ t('狀態') }}:
            <em :class="['sos-status-badge', { 'is-closed': post.status === 'CLOSED' }]">
              {{ t(post.status === 'CLOSED' ? '已結束' : '公開中') }}
            </em>
          </span>
        </div>
      </div>

      <div class="sos-meta">
        <span>{{ t("場合") }} · {{ t(post.occasion) }}</span>
        <span>{{ t("天氣") }} · {{ t(post.weather) }}</span>
      </div>

      <p v-if="post.details" style="color:var(--ink); font-size:14px; line-height:1.6; margin-top:12px;">
        {{ post.details }}
      </p>
    </div>

    <!-- Public Closet Gallery Section -->
    <div class="sos-detail-gallery">
      <h3>{{ t('發文者目前公開的衣櫥') }} ({{ publicItems.length }})</h3>
      <p v-if="publicItemsLoading" class="sos-detail-gallery-status" role="status">
        {{ t('正在載入發文者目前公開的衣櫥…') }}
      </p>
      <p v-else-if="publicItemsError" class="sos-detail-gallery-status" role="alert">
        {{ t('目前無法載入發文者的公開衣櫥，請稍後再試。') }}
      </p>
      <div v-else-if="publicItems.length" class="sos-detail-gallery-grid">
        <div v-for="item in publicItems" :key="item.id" class="sos-detail-gallery-item">
          <MediaImage class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
        </div>
      </div>
      <p v-else-if="!publicItemsLoading" class="sos-detail-gallery-status">
        {{ t("發文者目前沒有可公開展示的衣物。") }}
      </p>
    </div>

    <!-- Actions for Owner vs Responder -->
    <div style="margin: 20px 0; display:flex; gap:12px; justify-content: flex-end; flex-wrap:wrap;">
      <button type="button" class="secondary" @click="shareSos">{{ $t("分享連結") }}</button>
      <button type="button" class="secondary sos-save-button" :aria-pressed="Boolean(post.saved)" @click="toggleSave">
        <Heart :size="16" :stroke-width="1.7" :fill="post.saved ? 'currentColor' : 'none'" aria-hidden="true" />
        {{ t(post.saved ? '已收藏' : '收藏') }}
      </button>
      <button v-if="isOwner" type="button" class="secondary" @click="deleteRequest">{{ t('刪除') }}</button>
      <button
        v-if="isOwner && post.status === 'OPEN'"
        class="secondary"
        @click="openCloseConfirm"
      >
        {{ t("結束這次求救") }}
      </button>
      <button
        v-if="!isOwner && post.status === 'OPEN'"
        class="primary"
        @click="openSuggestionForm"
      >
        {{ t("提供穿搭建議") }}
      </button>
    </div>

    <p v-if="shareUrl" class="sos-copy-link"><a :href="shareUrl">{{ shareUrl }}</a></p>

    <!-- Outfit Suggestions List -->
    <div class="sos-suggestions-section">
      <div class="sos-suggestions-header">
        <h3 style="font-size:16px; font-weight:600;">
          {{ t('搭配建議與回覆') }} ({{ suggestions.length }})
        </h3>
        <span style="color:var(--muted); font-size:12px;">
          {{ tf('{count} 位提案者', { count: helperCount }) }}
        </span>
      </div>

      <div v-if="suggestions.length">
        <div
          v-for="sug in suggestions"
          :key="sug.id"
          :class="['sos-suggestion-card', { 'is-adopted': post.adopted_suggestion_id === sug.id }]"
        >
          <div v-if="post.adopted_suggestion_id === sug.id" class="sos-adopt-badge">
            ★ {{ t('發布者已採納') }}
          </div>

          <div class="sos-detail-user">
            <div class="sos-feed-avatar">
              <MediaImage v-if="sug.avatar_url" :src="sug.avatar_url" alt="" loading="lazy" />
              <span v-else>{{ sug.initials }}</span>
            </div>
            <strong>{{ sug.display_name || sug.username }}</strong>
          </div>
          <p style="font-size:14px; color:var(--ink); line-height:1.6; margin:6px 0;">
            " {{ sug.message }} "
          </p>

          <!-- Suggested items thumbnails -->
          <div v-if="getSuggestedItems(sug.item_ids).length" class="sos-suggestion-items">
            <div
              v-for="item in getSuggestedItems(sug.item_ids)"
              :key="item.id"
              class="sos-suggestion-item-thumb"
            >
              <MediaImage class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
            </div>
          </div>

          <div class="sos-suggestion-actions">
            <span style="color:var(--muted); font-size:11px;">
              {{ formatDate(sug.created_at) }}
            </span>

            <div style="display:flex; gap:10px; align-items:center;">
              <!-- The requester can shortlist a proposed look. -->
              <button
                v-if="isOwner"
                :class="['sos-like-btn', { liked: (post.liked_suggestion_ids || []).includes(sug.id) }]"
                @click="toggleLike(sug.id)"
              >
                {{ (post.liked_suggestion_ids || []).includes(sug.id) ? '♥ ' + t('已喜歡') : '♡ ' + t('喜歡') }}
              </button>

              <!-- Adopt button (only for SOS owner) -->
              <button
                v-if="isOwner"
                class="sos-cta"
                :style="{ background: post.adopted_suggestion_id === sug.id ? 'var(--sage-dark)' : 'var(--ink)' }"
                @click="adopt(sug.id)"
              >
                {{ post.adopted_suggestion_id === sug.id ? t('取消採納') : t('採用搭配') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else style="padding: 24px; text-align:center; color:var(--muted); font-size:13px; border:1px dashed var(--line); border-radius:12px;">
        {{ t("目前還沒有衣友提供搭配建議。") }}
      </div>
    </div>
  </div>
</template>


<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import { t, tf, formatDate } from '@/i18n';
import { Heart } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { updatePublicContentMeta } from '@/services/documentMeta';
import { getPublicItemsByOwnerId } from '@/services/clothingRepository';

const props = defineProps({
  post: {
    type: Object,
    required: true
  },
  isModal: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'deleted']);

const appStore = useAppStore();
const sosStore = useSosStore();
const shareUrl = ref('');
const publicItems = ref([]);
const publicItemsLoading = ref(false);
const publicItemsError = ref(false);
let publicItemsRequest = 0;

const isOwner = computed(() => {
  return props.post && props.post.sender_id === appStore.profile.id;
});

const coverItem = computed(() => {
  return sosStore.getPublicItemsForSos(props.post).find(item => String(item.id) === String(props.post?.cover_item_id));
});

const suggestions = computed(() => {
  if (!props.post) return [];
  return sosStore.getSuggestionsForSos(props.post.id);
});

const helperCount = computed(() => {
  if (!props.post) return 0;
  return sosStore.getHelperCountForSos(props.post.id);
});

watch(
  () => [props.post?.sender_id, props.post?.public_closet],
  async ([profileId, publicCloset]) => {
    const request = ++publicItemsRequest;
    publicItems.value = [];
    publicItemsError.value = false;
    if (!profileId || publicCloset !== true) {
      publicItemsLoading.value = false;
      return;
    }

    publicItemsLoading.value = true;
    try {
      const items = await getPublicItemsByOwnerId(profileId, undefined, { defer: true });
      if (request === publicItemsRequest) publicItems.value = items;
    } catch (error) {
      if (request === publicItemsRequest) {
        publicItemsError.value = true;
        console.error('Unable to load current public wardrobe for SOS:', error);
      }
    } finally {
      if (request === publicItemsRequest) publicItemsLoading.value = false;
    }
  },
  { immediate: true }
);

watch(() => props.post, (post) => {
  shareUrl.value = '';
  if (!post) return;
  updatePublicContentMeta({
    title: `${post.title}｜OOTIE ${t('穿搭求救')}`,
    description: String(post.details || t('一起看看這則穿搭求救')).slice(0, 160),
    image: publicItems.value[0]?.photo || '',
    url: `${window.location.origin}/sos/${encodeURIComponent(post.id)}`
  });
}, { immediate: true });

const getSuggestedItems = (itemIds) => {
  if (!Array.isArray(itemIds)) return [];
  return sosStore.getPublicItemsForSos(itemIds);
};

const deleteRequest = async () => {
  if (confirm(t('確定刪除這則求救及其搭配建議？此動作無法復原。')) && await sosStore.deleteSosPost(props.post.id)) {
    emit('deleted', props.post.id);
  }
};

const openCloseConfirm = () => {
  appStore.sosToCloseId = props.post.id;
  appStore.isSosCloseConfirmOpen = true;
};

const openSuggestionForm = () => {
  appStore.activeSosId = props.post.id;
  if (props.isModal) {
    emit('close');
  }
  appStore.isSuggestionFormOpen = true;
};

const toggleSave = () => {
  sosStore.toggleSave(props.post.id);
};

const shareSos = async () => {
  const url = `${window.location.origin}/sos/${encodeURIComponent(props.post.id)}`;
  shareUrl.value = url;
  try {
    if (navigator.share) {
      await navigator.share({ title: props.post.title || 'OOTIE 穿搭 SOS', text: t('一起看看這則穿搭求救'), url });
      appStore.showToast(t('已完成分享'), { type: 'success' });
      return;
    }
    await navigator.clipboard.writeText(url);
    appStore.showToast(t('SOS 連結已複製'), { type: 'success' });
  } catch (error) {
    if (error?.name !== 'AbortError') appStore.showToast(t('無法分享連結，請稍後再試。'), { type: 'error' });
  }
};

const adopt = (suggestionId) => {
  sosStore.adoptSuggestion({
    sosId: props.post.id,
    suggestionId
  });
};

const toggleLike = (suggestionId) => {
  sosStore.toggleLikeSuggestion({
    sosId: props.post.id,
    suggestionId
  });
};
</script>

<style scoped>
.sos-detail-content-container { width: 100%; }
.sos-copy-link { font-size: 13px; word-break: break-all; margin: 10px 0; }
</style>