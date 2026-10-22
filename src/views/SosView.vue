<template>
  <section class="page active" id="sosPage">
    <header class="core-page-hero sos-page-hero">
      <div>
        <p class="eyebrow">Style SOS</p>
        <h1>{{ $t("穿搭求救") }}</h1>
        <p class="intro">{{ t("衣友正在求救，從她真正擁有的衣櫥裡幫她搭一套。") }}</p>
      </div>
      <p class="core-page-note" aria-hidden="true">more ideas<br />more possibilities ♡</p>
    </header>

    <!-- Toolbar & Search -->
    <div class="sos-toolbar">
      <label class="sos-search">
        <span>⌕</span>
        <input
          v-model="sosStore.searchQuery"
          type="search"
          :placeholder="t('搜尋場合或穿搭需求')"
          :aria-label="t('搜尋場合或穿搭需求')"
        />
      </label>
      <button class="primary" @click="openSosForm()">＋ {{ t('發布求救') }}</button>
    </div>

    <!-- Tabs: 衣友求救板 vs 我發出的求救 -->
    <div class="sos-tabs" role="tablist" :aria-label="t('穿搭求救分類')">
      <button
        :class="['sos-tab', { active: sosStore.activeTab === 'received' }]"
        type="button"
        role="tab"
        :aria-selected="sosStore.activeTab === 'received'"
        @click="sosStore.activeTab = 'received'"
      >
        {{ t("衣友求救板") }} ({{ sosStore.receivedSosPosts.length }})
      </button>
      <button
        :class="['sos-tab', { active: sosStore.activeTab === 'sent' }]"
        type="button"
        role="tab"
        :aria-selected="sosStore.activeTab === 'sent'"
        @click="sosStore.activeTab = 'sent'"
      >
        {{ t("我發出的求救") }} ({{ sosStore.sentSosPosts.length }})
      </button>
    </div>

    <!-- SOS Cards Feed -->
    <div class="sos-feed">
      <template v-if="sosStore.filteredSosPosts.length">
        <article
          v-for="(post, index) in sosStore.filteredSosPosts"
          :key="post.id"
          class="sos-feed-card"
          :style="{ animationDelay: `${index * 45}ms` }"
        >
          <div class="sos-feed-user">
            <div class="sos-feed-avatar">{{ post.initials }}</div>
            <div>
              <strong>{{ post.username }}</strong>
              <span>{{ $t("穿搭求救") }}<em :class="['sos-status-badge', { 'is-closed': post.status === 'CLOSED' }]">
                  {{ t(post.status === 'CLOSED' ? '已結束' : '公開中') }}
                </em>
              </span>
            </div>
          </div>

          <p v-if="post.username?.includes('ootie_edit_')" class="editorial-source">{{ t('OOTIE Style Crew · 團隊策展穿搭故事') }}</p>
          <h2>{{ post.title }}</h2>

          <div class="sos-meta">
            <span>{{ t("場合") }} · {{ t(post.occasion) }}</span>
            <span>{{ t("天氣") }} · {{ t(post.weather) }}</span>
            <span>{{ t("穿著時機") }} · {{ t(post.when_label) }}</span>
          </div>

          <div class="sos-vibes">{{ t('想呈現的風格') }} · {{ (post.vibes || []).map(v => t(v)).join(' · ') }}</div>

          <!-- Public closet items preview thumbnails -->
          <div v-if="getPublicItemThumbs(post).length" class="sos-card-clothing-preview">
            <div class="sos-card-clothing-list">
              <div
                v-for="item in getPublicItemThumbs(post).slice(0, 5)"
                :key="item.id"
                class="sos-card-clothing-thumb"
              >
                <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" loading="lazy" decoding="async" />
                <span>{{ item.name_zh || item.name }}</span>
              </div>
              <button
                v-if="getPublicItemThumbs(post).length > 5"
                type="button"
                class="sos-card-clothing-more"
                :aria-label="tf('查看另外 {count} 件公開衣物', { count: getPublicItemThumbs(post).length - 5 })"
                @click="openSuggestion(post.id)"
              >
                ＋{{ getPublicItemThumbs(post).length - 5 }} {{ $t("更多") }}</button>
            </div>
          </div>

          <div class="sos-card-footer">
            <span class="sos-available">
              {{ tf('{count} 件公開衣物 · {helpers} 位衣友建議', { count: (post.closet_item_ids || []).length, helpers: sosStore.getHelperCountForSos(post.id) }) }}
            </span>

            <div class="sos-card-actions">
              <button
                type="button"
                :class="['sos-cta', 'secondary-btn', { saved: post.saved }]"
                @click="sosStore.toggleSave(post.id)"
              >
                {{ post.saved ? '▣ ' + t('已收藏') : '♡ ' + t('收藏') }}
              </button>
              <!-- View detail button -->
              <button class="sos-cta secondary-btn" @click="openSosDetail(post.id)">
                {{ t("查看詳情") }}
              </button>

              <!-- Suggest button for received tab -->
              <button
                v-if="sosStore.activeTab === 'received' && post.status === 'OPEN'"
                class="sos-cta"
                @click="openSuggestion(post.id)"
              >
                {{ t("幫她搭配") }}
              </button>

              <!-- Explicit close button for sent tab -->
              <button
                v-if="sosStore.activeTab === 'sent' && post.status === 'OPEN'"
                class="sos-cta"
                style="background:#a65f5b;"
                @click="openCloseConfirm(post.id)"
              >
                {{ t("結束求救") }}
              </button>
            </div>
          </div>
        </article>
      </template>

      <div v-else class="sos-empty">
        {{ t(sosStore.activeTab === 'received' ? '目前沒有求救貼文，或找不到符合關鍵字的貼文。' : '你尚未發布任何穿搭求救。') }}
      </div>
    </div>
  </section>
</template>

<script setup>
import { t, tf } from '@/i18n';
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';

const appStore = useAppStore();
const sosStore = useSosStore();
const route = useRoute();

const getPublicItemThumbs = (post) => sosStore.getPublicItemsForSos(post);

const openSosForm = (itemId = null) => {
  if (itemId) {
    appStore.sosTargetItemId = itemId;
  }
  appStore.isSosFormOpen = true;
};

watch(
  () => route.query.item_id,
  (itemId) => {
    if (itemId) {
      openSosForm(itemId);
    }
  },
  { immediate: true }
);

const openSuggestion = (sosId) => {
  const post = sosStore.sosPosts.find((item) => item.id === sosId);
  if (!post || post.status !== 'OPEN') return;
  if (post.sender_id === appStore.profile.id) {
    appStore.showToast(t('你不能為自己的求救貼文提交搭配建議。'));
    return;
  }
  if (!Array.isArray(post.closet_item_ids) || post.closet_item_ids.length === 0) {
    appStore.showToast(t('這筆求救沒有可使用的公開衣物。'));
    return;
  }
  appStore.activeSosId = sosId;
  appStore.isSuggestionFormOpen = true;
};

const openSosDetail = (sosId) => {
  appStore.activeSosDetailId = sosId;
  appStore.isSosDetailOpen = true;
};

const openCloseConfirm = (sosId) => {
  appStore.sosToCloseId = sosId;
  appStore.isSosCloseConfirmOpen = true;
};

// Shared links can arrive before the public request list has loaded.
watch(
  () => sosStore.sosPosts.find(post => post.id === route.query.sos)?.id,
  (sosId) => { if (sosId) openSosDetail(sosId); },
  { immediate: true }
);
</script>
