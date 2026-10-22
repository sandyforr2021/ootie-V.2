<template>
  <div v-if="appStore.isSosDetailOpen && targetPost" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal sos-detail-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>

      <div class="sos-detail-heading">
        <h2>{{ targetPost.title }}</h2>

        <div class="sos-detail-user">
          <div class="sos-feed-avatar">{{ targetPost.initials }}</div>
          <div>
            <strong>{{ targetPost.username }}</strong>
            <span>
              {{ t('狀態') }}:
              <em :class="['sos-status-badge', { 'is-closed': targetPost.status === 'CLOSED' }]">
                {{ t(targetPost.status === 'CLOSED' ? '已結束' : '公開中') }}
              </em>
            </span>
          </div>
        </div>

        <div class="sos-meta">
          <span>{{ t("場合") }} · {{ t(targetPost.occasion) }}</span>
          <span>{{ t("天氣") }} · {{ t(targetPost.weather) }}</span>
          <span>{{ t("穿著時機") }} · {{ t(targetPost.when_label) }}</span>
        </div>

        <div class="sos-vibes">{{ t('想呈現的風格') }} · {{ (targetPost.vibes || []).map(v => t(v)).join(' · ') }}</div>

        <p v-if="targetPost.details" style="color:var(--ink); font-size:14px; line-height:1.6; margin-top:12px;">
          {{ targetPost.details }}
        </p>
      </div>

      <!-- Public Closet Gallery Section -->
      <div class="sos-detail-gallery">
        <h3>{{ t('本次公開的衣物') }} ({{ publicItems.length }})</h3>
        <div v-if="publicItems.length" class="sos-detail-gallery-grid">
          <div v-for="item in publicItems" :key="item.id" class="sos-detail-gallery-item">
            <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
            <span>{{ item.name_zh || item.name }}</span>
          </div>
        </div>
        <p v-else style="color:var(--muted); font-size:13px; font-style:italic;">
          {{ t("這是歷史求救貼文，當時公開的衣物清單未被保存。") }}
        </p>
      </div>

      <!-- Actions for Owner vs Responder -->
      <div style="margin: 20px 0; display:flex; gap:12px; justify-content: flex-end;">
        <button type="button" class="secondary" @click="shareSos">{{ $t("分享連結") }}</button>
        <button type="button" class="secondary" @click="toggleSave">
          {{ targetPost.saved ? '▣ ' + t('已收藏') : '♡ ' + t('收藏') }}
        </button>
        <button
          v-if="isOwner && targetPost.status === 'OPEN'"
          class="secondary"
          @click="openCloseConfirm"
        >
          {{ t("結束這次求救") }}
        </button>
        <button
          v-if="!isOwner && targetPost.status === 'OPEN'"
          class="primary"
          @click="openSuggestionForm"
        >
          {{ t("幫她搭配") }}
        </button>
      </div>

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
            :class="['sos-suggestion-card', { 'is-adopted': targetPost.adopted_suggestion_id === sug.id }]"
          >
            <div v-if="targetPost.adopted_suggestion_id === sug.id" class="sos-adopt-badge">
              ★ {{ t('發布者已採納') }}
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
                <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
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
                  :class="['sos-like-btn', { liked: (targetPost.liked_suggestion_ids || []).includes(sug.id) }]"
                  @click="toggleLike(sug.id)"
                >
                  {{ (targetPost.liked_suggestion_ids || []).includes(sug.id) ? '♥ ' + t('已喜歡') : '♡ ' + t('喜歡') }}
                </button>

                <!-- Adopt button (only for SOS owner) -->
                <button
                  v-if="isOwner"
                  class="sos-cta"
                  :style="{ background: targetPost.adopted_suggestion_id === sug.id ? 'var(--sage-dark)' : 'var(--ink)' }"
                  @click="adopt(sug.id)"
                >
                  {{ targetPost.adopted_suggestion_id === sug.id ? t('取消採納') : t('採用搭配') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else style="padding: 24px; text-align:center; color:var(--muted); font-size:13px; border:1px dashed var(--line); border-radius:12px;">
          {{ t("目前還沒有衣友提供搭配建議。") }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { t, tf, formatDate } from '@/i18n';
import { computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { updateDocumentMeta, updatePublicContentMeta } from '@/services/documentMeta';

const appStore = useAppStore();
const sosStore = useSosStore();

const targetPost = computed(() => {
  return sosStore.sosPosts.find((p) => p.id === appStore.activeSosDetailId);
});

const isOwner = computed(() => {
  return targetPost.value && targetPost.value.sender_id === appStore.profile.id;
});

const publicItems = computed(() => {
  if (!targetPost.value || !targetPost.value.closet_item_ids) return [];
  return sosStore.getPublicItemsForSos(targetPost.value);
});

const suggestions = computed(() => {
  if (!targetPost.value) return [];
  return sosStore.getSuggestionsForSos(targetPost.value.id);
});

const helperCount = computed(() => {
  if (!targetPost.value) return 0;
  return sosStore.getHelperCountForSos(targetPost.value.id);
});

watch(targetPost, (post) => {
  if (!post) return;
  updatePublicContentMeta({
    title: `${post.title}｜OOTIE 穿搭 SOS`,
    description: String(post.details || t('一起看看這則穿搭求救')).slice(0, 160),
    image: publicItems.value[0]?.photo || '',
    url: `${window.location.origin}/sos?sos=${encodeURIComponent(post.id)}`
  });
}, { immediate: true });

const getSuggestedItems = (itemIds) => {
  if (!Array.isArray(itemIds)) return [];
  return sosStore.getPublicItemsForSos(itemIds);
};

const close = () => {
  appStore.isSosDetailOpen = false;
  appStore.activeSosDetailId = null;
  updateDocumentMeta({ name: 'Sos' });
};

const openCloseConfirm = () => {
  appStore.sosToCloseId = targetPost.value.id;
  appStore.isSosCloseConfirmOpen = true;
};

const openSuggestionForm = () => {
  appStore.activeSosId = targetPost.value.id;
  appStore.isSuggestionFormOpen = true;
};

const toggleSave = () => {
  sosStore.toggleSave(targetPost.value.id);
};

const shareSos = async () => {
  const url = `${window.location.origin}/sos?sos=${encodeURIComponent(targetPost.value.id)}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: targetPost.value.title || 'OOTIE 穿搭 SOS', text: t('一起看看這則穿搭求救'), url });
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
    sosId: targetPost.value.id,
    suggestionId
  });
};

const toggleLike = (suggestionId) => {
  sosStore.toggleLikeSuggestion({
    sosId: targetPost.value.id,
    suggestionId
  });
};
</script>
