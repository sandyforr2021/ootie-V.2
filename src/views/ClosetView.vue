<template>
  <section class="page active" id="closetPage">
    <header class="closet-page-header">
      <div>
        <h1>{{ $t("我的衣櫥") }}</h1>
      </div>
      <button v-if="!showWishlist" type="button" class="primary closet-header-add" @click="openAddForm">{{ $t("＋ 新增單品") }}</button>
    </header>
    <ClosetVisibility v-if="!showWishlist" />

    <nav class="closet-collections" :aria-label="$t('我的衣櫥')">
      <router-link :to="{path:'/closet',query:{lang:route.query.lang}}" :aria-current="!showWishlist ? 'page' : undefined">{{ $t('衣櫥衣物') }}</router-link>
      <router-link :to="{path:'/closet',query:{tab:'wishlist',lang:route.query.lang}}" :aria-current="showWishlist ? 'page' : undefined">{{ $t('想買清單') }}</router-link>
    </nav>
    <WishlistPanel v-if="showWishlist" />
    <template v-else>

    <section
      v-if="!canShowClosetData"
      class="empty closet-runtime-state"
      :class="runtimeStateClass"
      :role="isRemoteFailure ? 'alert' : 'status'"
      aria-live="polite"
    >
      <h2>{{ isRemoteLoading ? $t('正在整理衣櫥') : $t('衣櫥暫時無法載入') }}</h2>
      <p>{{ closetRuntimeMessage }}</p>
      <button v-if="isRemoteFailure" type="button" class="primary" @click="retryClosetLoad">{{ $t("重新載入") }}</button>
    </section>

    <template v-else>
    <!-- Toolbar & Filters -->
    <div v-if="!isWholeClosetEmpty" :class="['toolbar', { 'filters-open': isFilterPanelOpen }]">
      <label class="search">
        <span>⌕</span>
        <input
          v-model="closetStore.searchQuery"
          type="search"
          :placeholder="$t(&quot;搜尋你的衣櫥&quot;)"
          :aria-label="$t(&quot;搜尋你的衣櫥&quot;)"
        />
      </label>

      <button
        type="button"
        class="closet-filter-toggle"
        aria-controls="closetSecondaryFilters"
        :aria-expanded="isFilterPanelOpen"
        @click="isFilterPanelOpen = !isFilterPanelOpen"
      >{{ $t("篩選") }}<span v-if="activeFilterCount">（{{ activeFilterCount }}）</span>
      </button>

      <!-- 色系 / 顏色 篩選下拉選單 -->
      <div id="closetSecondaryFilters" :class="['color-filter', { open: isColorMenuOpen }]" ref="colorMenuRef">
        <button
          class="select color-filter-toggle"
          type="button"
          aria-haspopup="listbox"
          :aria-expanded="isColorMenuOpen"
          @click="isColorMenuOpen = !isColorMenuOpen"
        >
          <span :class="['color-filter-preview', { 'is-all': !closetStore.colorFilter && !closetStore.colorFamilyFilter }]"></span>
          <span>{{ $t(colorFilterDisplayLabel) }}</span>
          <span class="color-filter-arrow">⌄</span>
        </button>

        <div v-if="isColorMenuOpen" class="color-filter-options" role="listbox" :aria-label="$t(&quot;依色系篩選&quot;)">
          <div class="color-filter-group">
            <strong>{{ $t("色系") }}</strong>
            <div class="color-filter-group-options">
              <button
                type="button"
                :class="['color-filter-option', { selected: !closetStore.colorFamilyFilter }]"
                @click="selectColorFamily('')"
              >{{ $t("全部色系") }}</button>
              <button
                v-for="family in colorFamilies"
                :key="family"
                type="button"
                :class="['color-filter-option', { selected: closetStore.colorFamilyFilter === family }]"
                @click="selectColorFamily(family)"
              >
                {{ $t(family) }}
              </button>
            </div>
          </div>

          <div v-if="closetStore.colorFamilyFilter && colorDetailOptions.length" class="color-filter-group color-detail-group">
            <strong>{{ $t("主要顏色") }}</strong>
            <div class="color-filter-group-options">
              <button
                type="button"
                :class="['color-filter-option', { selected: !closetStore.colorFilter }]"
                @click="selectDetailColor('')"
              >{{ $t("全部") }}{{ closetStore.colorFamilyFilter }}
              </button>
              <button
                v-for="[name, swatch] in colorDetailOptions"
                :key="name"
                type="button"
                :class="['color-filter-option', { selected: closetStore.colorFilter === name }]"
                @click="selectDetailColor(name)"
              >
                <span :class="['color-swatch', swatch]"></span>
                {{ $t(name) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <select v-model="closetStore.seasonFilter" class="select" :aria-label="$t(&quot;依季節篩選&quot;)">
        <option value="">{{ $t("季節") }}</option>
        <option value="Spring / Summer">{{ $t("春夏") }}</option>
        <option value="Autumn / Winter">{{ $t("秋冬") }}</option>
        <option value="All year">{{ $t("四季") }}</option>
      </select>

      <select v-model="closetStore.styleFilter" class="select" :aria-label="$t(&quot;依風格篩選&quot;)">
        <option value="">{{ $t("風格") }}</option>
        <option v-for="style in styleOptions" :key="style" :value="style">{{ $t(labels[style] || style) }}</option>
      </select>
    </div>

    <!-- Category Tabs -->
    <div v-if="!isWholeClosetEmpty" class="category-row" :aria-label="$t(&quot;單品分類&quot;)">
      <button type="button" :class="['category', 'favorite-filter', { active: closetStore.favoritesOnly }]" :aria-pressed="closetStore.favoritesOnly" :aria-label="$t('查看最愛')" @click="closetStore.favoritesOnly = !closetStore.favoritesOnly"><Heart :size="18" :stroke-width="1.7" :fill="closetStore.favoritesOnly ? 'currentColor' : 'none'" aria-hidden="true" /></button>
      <button
        v-for="cat in categories"
        :key="cat"
        :class="['category', { active: closetStore.activeCategory === cat }]"
        @click="closetStore.activeCategory = cat"
      >
        {{ $t(labels[cat]) }}
      </button>
    </div>

    <div v-if="!isWholeClosetEmpty" class="closet-meta">
      <strong>{{ closetStore.filteredItems.length }} {{ $t("件單品") }}</strong>
      <div v-if="hasActiveClosetFilters" class="closet-meta-actions">
        <button v-if="hasActiveClosetFilters" class="clear" @click="clearAllFilters">{{ $t("清除篩選") }}</button>
      </div>
    </div>

    <!-- Items Grid -->
    <div class="grid">
      <template v-if="closetStore.filteredItems.length">
        <article
          v-for="(item, index) in closetStore.filteredItems"
          :key="item.id"
          class="item-card"
          :style="{ animationDelay: `${index * 45}ms` }"
        >
          <div
            class="item-image"
            role="button"
            tabindex="0"
            :aria-label="`${$t('查看單品')}: ${itemName(item)}`"
            @click="openDetail(item.id)"
            @keydown.enter="openDetail(item.id)"
            @keydown.space.prevent="openDetail(item.id)"
          >
            <button
              :class="['favorite', { 'is-favorite': item.favorite }]"
              :aria-label="`${$t(item.favorite ? '移除最愛' : '加入最愛')} ${itemName(item)}`"
              :aria-pressed="Boolean(item.favorite)"
              @click.stop="closetStore.toggleFavorite(item.id)"
            >
              <Heart :size="19" :stroke-width="1.7" :fill="item.favorite ? 'currentColor' : 'none'" aria-hidden="true" />
            </button>
            <img
              class="product-image"
              :src="item.photo"
              :alt="`${item.brand || '未標示品牌'} ${itemName(item)}`"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div class="item-info">
            <h3>{{ itemName(item) }}</h3>
            <p v-if="item.brand" class="item-brand">{{ item.brand }}</p>
            <p class="item-meta">{{ $t(labels[item.category] || item.category) }} · {{ $t(labels[item.primary_color] || item.primary_color || '') }}</p>
          </div>
        </article>
      </template>

      <div v-else class="empty closet-empty-state" role="status">
        <AppIcon name="Closet" :size="40" />
        <h2>{{ isWholeClosetEmpty ? $t('衣櫥目前沒有衣物') : $t('沒有符合條件的單品') }}</h2>
        <p>{{ isWholeClosetEmpty ? $t('加入第一件衣服，開始整理你的日常穿搭。') : $t('換個分類或清除篩選，就能繼續瀏覽。') }}</p>
        <div class="closet-empty-actions">
          <button v-if="!isWholeClosetEmpty" type="button" class="secondary" @click="clearAllFilters">{{ $t("清除篩選") }}</button>
          <button type="button" class="primary" @click="openAddForm">{{ $t("新增單品") }}</button>
        </div>
      </div>
    </div>
    </template>
    </template>
  </section>
</template>

<script setup>
import ClosetVisibility from '@/components/closet/ClosetVisibility.vue';
import { itemName } from '@/services/itemPresentation';
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Heart } from '@lucide/vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import WishlistPanel from '@/components/closet/WishlistPanel.vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore, CLOSET_DATA_MODE } from '@/stores/closet';
import { IDENTITY_STATUS } from '@/services/identityResolver';
import { ASYNC_STATUS } from '@/contracts/asyncState';
import { categories, labels, colorFamilies, colorDetailGroups } from '@/constants';

const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const route = useRoute();
const showWishlist = computed(() => route.query.tab === 'wishlist');
const styleOptions = computed(() => [...new Set(['Minimal', 'Casual', 'Smart Casual', 'Chic', ...appStore.items.map(item => item.style).filter(Boolean)])]);

const isColorMenuOpen = ref(false);
const isFilterPanelOpen = ref(false);
const colorMenuRef = ref(null);

const activeFilterCount = computed(() => [
  closetStore.colorFamilyFilter || closetStore.colorFilter,
  closetStore.seasonFilter,
  closetStore.styleFilter
].filter(Boolean).length);

const hasActiveClosetFilters = computed(() => Boolean(
  closetStore.searchQuery ||
  closetStore.favoritesOnly ||
  activeFilterCount.value ||
  closetStore.activeCategory !== categories[0]
));

const colorDetailOptions = computed(() => {
  return colorDetailGroups[closetStore.colorFamilyFilter] || [];
});

const colorFilterDisplayLabel = computed(() => {
  if (closetStore.colorFilter) return closetStore.colorFilter;
  if (closetStore.colorFamilyFilter) return closetStore.colorFamilyFilter;
  return '色系／顏色';
});

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const isRemoteLoading = computed(() =>
  closetStore.remoteState.status === ASYNC_STATUS.LOADING
);

const isRemoteFailure = computed(() =>
  [ASYNC_STATUS.ERROR, ASYNC_STATUS.DENIED].includes(closetStore.remoteState.status)
);

const isRemoteEmpty = computed(() =>
  closetStore.dataMode === CLOSET_DATA_MODE.REMOTE &&
  closetStore.remoteState.status === ASYNC_STATUS.EMPTY
);

const isWholeClosetEmpty = computed(() => isRemoteEmpty.value || appStore.items.length === 0);

const canShowClosetData = computed(() =>
  [CLOSET_DATA_MODE.LOCAL, CLOSET_DATA_MODE.GUEST].includes(closetStore.dataMode) ||
  (closetStore.dataMode === CLOSET_DATA_MODE.REMOTE && !isRemoteLoading.value && !isRemoteFailure.value)
);

const closetRuntimeMessage = computed(() => {
  if (authStore.profileIdentity.status === IDENTITY_STATUS.PROFILE_LOADING) {
    return '正在確認 OOTIE 個人檔案…';
  }
  if (authStore.profileIdentity.status === IDENTITY_STATUS.PROFILE_MISSING) {
    return '找不到 OOTIE 個人檔案，無法載入遠端衣櫥。';
  }
  if (authStore.profileIdentity.status === IDENTITY_STATUS.PROFILE_QUERY_ERROR) {
    return '個人檔案載入失敗，暫時無法載入遠端衣櫥。';
  }
  if (closetStore.remoteState.status === ASYNC_STATUS.DENIED) {
    return '沒有權限讀取遠端衣櫥。';
  }
  if (isRemoteLoading.value) {
    return '正在載入遠端衣櫥…';
  }
  return '遠端衣櫥載入失敗，請稍後再試。';
});

const runtimeStateClass = computed(() => ({
  'is-error': isRemoteFailure.value || authStore.profileIdentity.status === IDENTITY_STATUS.PROFILE_MISSING,
  'is-loading': isRemoteLoading.value
}));

let requestedRemoteProfileId = null;

watch(
  [
    () => authStore.session?.user?.id || null,
    () => authStore.profileIdentity.status,
    () => authStore.profileIdentity.profileId
  ],
  async ([authUserId, identityStatus, profileId]) => {
    if (!authUserId) {
      requestedRemoteProfileId = null;
      closetStore.useGuestItems();
      return;
    }

    if (identityStatus === IDENTITY_STATUS.PROFILE_READY && isUuid(profileId)) {
      if (requestedRemoteProfileId === profileId) return;
      requestedRemoteProfileId = profileId;
      await closetStore.loadRemoteItems(profileId);
      return;
    }

    requestedRemoteProfileId = null;
    if (identityStatus === IDENTITY_STATUS.PROFILE_MISSING || identityStatus === IDENTITY_STATUS.PROFILE_QUERY_ERROR) {
      closetStore.blockRemoteRead(authStore.profileIdentity.error || new Error('Profile unavailable'));
      return;
    }

    closetStore.setAwaitingProfile();
  },
  { immediate: true }
);

const selectColorFamily = (family) => {
  closetStore.colorFamilyFilter = family;
  closetStore.colorFilter = '';
  if (!family) {
    isColorMenuOpen.value = false;
  }
};

const selectDetailColor = (color) => {
  closetStore.colorFilter = color;
  isColorMenuOpen.value = false;
};

const clearAllFilters = () => {
  closetStore.clearFilters();
  isColorMenuOpen.value = false;
  isFilterPanelOpen.value = false;
};

const retryClosetLoad = async () => {
  const profileId = authStore.profileIdentity.profileId;
  if (!isUuid(profileId)) return;
  requestedRemoteProfileId = null;
  await closetStore.loadRemoteItems(profileId);
  requestedRemoteProfileId = profileId;
};

const openAddForm = () => {
  if (closetStore.isGuestMode && !closetStore.canAddItem()) {
    appStore.openLoginGate('CLOSET_LIMIT', '/closet');
    return;
  }
  appStore.editingItemId = null;
  appStore.isItemFormOpen = true;
};

const openDetail = (id) => {
  appStore.selectedItemId = id;
  appStore.isDetailOpen = true;
};

const handleOutsideClick = (e) => {
  if (colorMenuRef.value && !colorMenuRef.value.contains(e.target)) {
    isColorMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick);
});
</script>


<style scoped>.favorite{display:grid;place-items:center;padding:0}.favorite svg{display:block;pointer-events:none}</style>
