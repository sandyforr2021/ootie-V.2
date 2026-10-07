<template>
  <section class="page active" id="sosPage">
    <header class="core-page-hero sos-page-hero">
      <div>
        <p class="eyebrow">Style SOS</p>
        <h1>穿搭求救</h1>
        <p class="intro">衣友正在求救，從她真正擁有的衣櫥裡幫她搭一套。</p>
      </div>
      <p class="core-page-note" aria-hidden="true">real people<br />real style ♡</p>
    </header>

    <!-- Toolbar & Search -->
    <div class="sos-toolbar">
      <label class="sos-search">
        <span>⌕</span>
        <input
          v-model="sosStore.searchQuery"
          type="search"
          placeholder="搜尋場合或穿搭需求"
          aria-label="搜尋場合或穿搭需求"
        />
      </label>
      <button class="primary" @click="openSosForm">＋ 發布求救</button>
    </div>

    <!-- Tabs: 衣友求救板 vs 我發出的求救 -->
    <div class="sos-tabs" role="tablist" aria-label="穿搭求救分類">
      <button
        :class="['sos-tab', { active: sosStore.activeTab === 'received' }]"
        type="button"
        role="tab"
        :aria-selected="sosStore.activeTab === 'received'"
        @click="sosStore.activeTab = 'received'"
      >
        衣友求救板 ({{ sosStore.receivedSosPosts.length }})
      </button>
      <button
        :class="['sos-tab', { active: sosStore.activeTab === 'sent' }]"
        type="button"
        role="tab"
        :aria-selected="sosStore.activeTab === 'sent'"
        @click="sosStore.activeTab = 'sent'"
      >
        我發出的求救 ({{ sosStore.sentSosPosts.length }})
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
              <span>
                穿搭求救
                <em :class="['sos-status-badge', { 'is-closed': post.status === 'CLOSED' }]">
                  {{ post.status }}
                </em>
              </span>
            </div>
          </div>

          <h2>{{ post.title }}</h2>

          <div class="sos-meta">
            <span>場合｜{{ post.occasion }}</span>
            <span>天氣｜{{ post.weather }}</span>
            <span>時間｜{{ post.when_label }}</span>
          </div>

          <div class="sos-vibes">想呈現：{{ (post.vibes || []).join('　') }}</div>

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
                :aria-label="`查看 ${getPublicItemThumbs(post).length - 5} 件更多公開衣物並幫她搭配`"
                @click="openSuggestion(post.id)"
              >
                ＋{{ getPublicItemThumbs(post).length - 5 }} 更多
              </button>
            </div>
          </div>

          <div class="sos-card-footer">
            <span class="sos-available">
              {{ (post.closet_item_ids || []).length }} 件公開衣物 ·
              {{ sosStore.getHelperCountForSos(post.id) }} 位衣友建議
            </span>

            <div class="sos-card-actions">
              <button
                type="button"
                :class="['sos-cta', 'secondary-btn', { saved: post.saved }]"
                @click="sosStore.toggleSave(post.id)"
              >
                {{ post.saved ? '▣ 已收藏' : '♡ 收藏' }}
              </button>
              <!-- View detail button -->
              <button class="sos-cta secondary-btn" @click="openSosDetail(post.id)">
                查看詳情
              </button>

              <!-- Suggest button for received tab -->
              <button
                v-if="sosStore.activeTab === 'received' && post.status === 'OPEN'"
                class="sos-cta"
                @click="openSuggestion(post.id)"
              >
                幫她搭配
              </button>

              <!-- Explicit close button for sent tab -->
              <button
                v-if="sosStore.activeTab === 'sent' && post.status === 'OPEN'"
                class="sos-cta"
                style="background:#a65f5b;"
                @click="openCloseConfirm(post.id)"
              >
                結束求救
              </button>
            </div>
          </div>
        </article>
      </template>

      <div v-else class="sos-empty">
        {{ sosStore.activeTab === 'received' ? '目前沒有求救貼文，或找不到符合關鍵字的貼文。' : '你尚未發布任何穿搭求救。' }}
      </div>
    </div>
  </section>
</template>

<script setup>
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
    appStore.showToast('你不能為自己的求救貼文提交搭配建議。');
    return;
  }
  if (!Array.isArray(post.closet_item_ids) || post.closet_item_ids.length === 0) {
    appStore.showToast('這筆求救沒有可使用的公開衣物。');
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
</script>
