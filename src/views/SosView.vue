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
            <div class="sos-feed-avatar"><img v-if="post.avatar_url" :src="post.avatar_url" alt="" loading="lazy" /><span v-else>{{ post.initials }}</span></div>
            <div>
              <strong>{{ post.display_name || post.username }}</strong>
              <span>{{ $t("穿搭求救") }}<em :class="['sos-status-badge', { 'is-closed': post.status === 'CLOSED' }]">
                  {{ t(post.status === 'CLOSED' ? '已結束' : '公開中') }}
                </em>
              </span>
            </div>
          </div>

          <h2>{{ post.title }}</h2>

          <img v-if="coverImage(post)" class="sos-cover-image" :src="coverImage(post)" :alt="t('求救主圖')" loading="lazy" />

          <div class="sos-meta">
            <span>{{ t("場合") }} · {{ t(post.occasion) }}</span>
            <span>{{ t("天氣") }} · {{ t(post.weather) }}</span>
            <span>{{ t("穿著時機") }} · {{ t(post.when_label) }}</span>
          </div>

          <div class="sos-vibes">{{ t('想呈現的風格') }} · {{ (post.vibes || []).map(v => t(v)).join(' · ') }}</div>

          <div class="sos-card-footer">
            <span class="sos-available">
              <template v-if="authStore.isMember">{{ tf('{count} 件公開衣物 · {helpers} 位衣友建議', { count: (post.closet_item_ids || []).length, helpers: sosStore.getHelperCountForSos(post.id) }) }}</template>
              <template v-else>{{ tf('{count} 件公開衣物 · 登入查看搭配建議', { count: (post.closet_item_ids || []).length }) }}</template>
            </span>

            <div class="sos-card-actions">
              <button
                type="button"
                :class="['sos-cta', 'secondary-btn', 'sos-save-button', { saved: post.saved }]"
                :aria-pressed="Boolean(post.saved)"
                @click="sosStore.toggleSave(post.id)"
              >
                <Heart :size="16" :stroke-width="1.7" :fill="post.saved ? 'currentColor' : 'none'" aria-hidden="true" />
                {{ t(post.saved ? '已收藏' : '收藏') }}
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
              <button v-if="sosStore.activeTab === 'sent'" class="sos-cta secondary-btn" @click="deletePost(post.id)">{{ t('刪除') }}</button>
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
import { Heart } from '@lucide/vue';
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { useAuthStore } from '@/stores/auth';

const appStore = useAppStore();
const sosStore = useSosStore();
const authStore = useAuthStore();
const route = useRoute();
const coverImage = post => post.cover_url || sosStore.getPublicItemsForSos(post).find(item=>String(item.id)===String(post.cover_item_id))?.photo || '';
const deletePost = async id => {
  if (confirm(t('確定刪除這則求救及其搭配建議？此動作無法復原。'))) await sosStore.deleteSosPost(id);
};

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
