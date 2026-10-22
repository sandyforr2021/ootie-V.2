<template>
  <div class="bottom-nav-wrapper">
    <div v-if="isMoreMenuOpen" class="quick-action-backdrop" @click="closeMoreMenu"></div>
    <section
      v-if="isMoreMenuOpen"
      id="mobile-more-menu"
      class="quick-action-menu open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-more-title"
    >
      <div class="mobile-more-header">
        <div>
          <p class="quick-action-kicker">Navigation</p>
          <h2 id="mobile-more-title">{{ $t("更多功能") }}</h2>
        </div>
        <button ref="moreCloseButton" type="button" class="mobile-more-close" :aria-label="$t(&quot;關閉更多功能&quot;)" @click="closeMoreMenu">×</button>
      </div>

      <p class="quick-action-heading">{{ $t("功能導覽") }}</p>
      <div class="mobile-more-destinations" :aria-label="$t(&quot;次要導覽&quot;)">
        <router-link
          v-for="item in MOBILE_MORE_ITEMS"
          :key="item.routeName"
          :to="item.path"
          class="mobile-more-link"
          active-class="active"
          exact-active-class="active"
          @click.prevent="navigateTo(item.path)"
        >
          <AppIcon :name="item.routeName" />
          <strong>{{ $t(item.label) }}</strong>
        </router-link>
        <button type="button" class="mobile-more-link mobile-more-action" @click="openNotifications">
          <span aria-hidden="true">♧</span>
          <strong>{{ $t("通知") }}</strong>
          <span v-if="unreadCount > 0" class="mobile-more-badge" :aria-label="`${unreadCount} 則未讀通知`">{{ unreadCount }}</span>
        </button>
      </div>

      <p class="quick-action-heading">{{ $t("快速新增") }}</p>
      <div class="quick-action-grid" :aria-label="$t(&quot;建立內容&quot;)">
        <button type="button" class="quick-action-item" @click="triggerQuickAction('add-item')">
          <span class="quick-action-icon" aria-hidden="true">＋</span>
          <span><strong>{{ $t("加入單品") }}</strong><small>{{ $t("上傳衣服、建立記錄") }}</small></span>
        </button>
        <button type="button" class="quick-action-item" @click="triggerQuickAction('add-ootd')">
          <span class="quick-action-icon" aria-hidden="true">✦</span>
          <span><strong>{{ $t("發布 OOTD") }}</strong><small>{{ $t("分享今天的穿搭照片") }}</small></span>
        </button>
        <button type="button" class="quick-action-item" @click="triggerQuickAction('add-sos')">
          <span class="quick-action-icon" aria-hidden="true">♡</span>
          <span><strong>{{ $t("發布求救") }}</strong><small>{{ $t("讓衣友提供搭配建議") }}</small></span>
        </button>
        <button type="button" class="quick-action-item" @click="triggerQuickAction('add-bookmark')">
          <span class="quick-action-icon" aria-hidden="true">▣</span>
          <span><strong>{{ $t("加入書籤") }}</strong><small>{{ $t("收藏商品與穿搭靈感") }}</small></span>
        </button>
      </div>

      <button v-if="authStore.isLoggedIn" type="button" class="mobile-more-logout" @click="handleLogout">{{ $t("登出") }}</button>
    </section>

    <nav class="bottom-nav" :aria-label="$t(&quot;手機版導覽&quot;)">
      <router-link
        v-for="item in MOBILE_PRIMARY_ITEMS"
        :key="item.routeName"
        :to="item.path"
        :class="{ active: route.name === item.routeName || (item.routeName === 'Explore' && route.name === 'OotdDetail') }"
        active-class=""
        exact-active-class=""
      >
        <AppIcon :name="item.routeName" />{{ $t(item.shortLabel) }}
      </router-link>
      <button
        ref="moreTrigger"
        type="button"
        :class="['mobile-more-trigger', { active: isSecondaryRouteActive, open: isMoreMenuOpen }]"
        :aria-expanded="isMoreMenuOpen"
        aria-controls="mobile-more-menu"
        @click="toggleMoreMenu"
      >
        <AppIcon name="more" />{{ $t("更多") }}</button>
    </nav>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useBookmarksStore } from '@/stores/bookmarks';
import { useSocialStore } from '@/stores/social';
import { MOBILE_MORE_ITEMS, MOBILE_PRIMARY_ITEMS } from '@/router/navigation';
import { GUEST_CLOSET_LIMIT, readGuestCloset } from '@/services/guestAccess';
import AppIcon from '@/components/ui/AppIcon.vue';

const appStore = useAppStore();
const authStore = useAuthStore();
const bookmarksStore = useBookmarksStore();
const socialStore = useSocialStore();
const route = useRoute();
const router = useRouter();

const isMoreMenuOpen = ref(false);
const moreCloseButton = ref(null);
const moreTrigger = ref(null);
const isSecondaryRouteActive = computed(() => MOBILE_MORE_ITEMS.some((item) => item.routeName === route.name));
const unreadCount = computed(() => authStore.isMember ? socialStore.unreadCount : 0);

const closeMoreMenu = () => {
  isMoreMenuOpen.value = false;
  nextTick(() => moreTrigger.value?.$el?.focus?.() || moreTrigger.value?.focus?.());
};

const toggleMoreMenu = async () => {
  isMoreMenuOpen.value = !isMoreMenuOpen.value;
  if (isMoreMenuOpen.value) {
    await nextTick();
    moreCloseButton.value?.focus();
  }
};

const handleEscape = (event) => {
  if (event.key === 'Escape' && isMoreMenuOpen.value) closeMoreMenu();
};

const openNotifications = () => {
  closeMoreMenu();
  if (!authStore.isMember) {
    authStore.openAuthModal('login', null, route.fullPath || '/');
    return;
  }
  appStore.isNotificationOpen = true;
};

const navigateTo = async (path) => {
  await router.push(path);
  isMoreMenuOpen.value = false;
};

const handleLogout = async () => {
  closeMoreMenu();
  await authStore.logout();
  appStore.showToast('已登出');
};

const openGuestItemForm = () => {
  if (!authStore.session && readGuestCloset().length >= GUEST_CLOSET_LIMIT) {
    appStore.openLoginGate('CLOSET_LIMIT', '/closet');
    return;
  }
  appStore.editingItemId = null;
  appStore.isItemFormOpen = true;
};

const triggerQuickAction = (action) => {
  closeMoreMenu();
  if (action === 'add-item') {
    if (route.path === '/closet') openGuestItemForm();
    else router.push({ path: '/closet', query: { quick: 'add-item' } });
  } else if (action === 'add-ootd') {
    if (!authStore.isMember) {
      appStore.openLoginGate('OOTD_PUBLISH_AUTH_REQUIRED', '/explore?quick=add-ootd');
      return;
    }
    if (route.path === '/explore') appStore.isOotdFormOpen = true;
    else router.push({ path: '/explore', query: { quick: 'add-ootd' } });
  } else if (action === 'add-sos') {
    if (route.path === '/sos') appStore.isSosFormOpen = true;
    else router.push({ path: '/sos', query: { quick: 'add-sos' } });
  } else if (action === 'add-bookmark') {
    if (route.path === '/bookmarks') bookmarksStore.openCreateForm();
    else router.push({ path: '/bookmarks', query: { quick: 'add-bookmark' } });
  }
};

watch(
  () => route.query.quick,
  (action) => {
    if (!action) return;
    if (action === 'add-item') openGuestItemForm();
    else if (action === 'add-ootd') {
      if (authStore.isMember) appStore.isOotdFormOpen = true;
      else appStore.openLoginGate('OOTD_PUBLISH_AUTH_REQUIRED', '/explore?quick=add-ootd');
    } else if (action === 'add-sos') appStore.isSosFormOpen = true;
    else if (action === 'add-bookmark') bookmarksStore.openCreateForm();
  },
  { immediate: true }
);

watch(
  () => route.name,
  () => {
    if (isMoreMenuOpen.value) isMoreMenuOpen.value = false;
  }
);

onMounted(() => window.addEventListener('keydown', handleEscape));
onBeforeUnmount(() => window.removeEventListener('keydown', handleEscape));
</script>
