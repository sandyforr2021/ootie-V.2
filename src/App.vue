<template>
  <a class="skip-link" href="#main-content">{{ $t("跳到主要內容") }}</a>
  <BrandOpening />
  <GlobalStatus />

  <div :class="['app', { 'app--brand-home': isBrandHome }]">
    <!-- Sidebar -->
    <AppSidebar />

    <main id="main-content" tabindex="-1">
      <!-- Topbar -->
      <AppTopbar v-if="!isBrandHome" />

      <!-- Page Views -->
      <router-view v-slot="{ Component }">
        <Suspense>
          <component :is="Component" />
          <template #fallback>
            <div class="route-loading" role="status" aria-live="polite">{{ $t("正在開啟頁面…") }}</div>
          </template>
        </Suspense>
      </router-view>
    </main>
  </div>

  <!-- Mobile Bottom Nav -->
  <AppBottomNav />

  <!-- Modals -->
  <DeferredModal :active="authStore.isAuthModalOpen" :loader="modalLoaders.auth" />
  <DeferredModal :active="appStore.isDetailOpen" :loader="modalLoaders.itemDetail" />
  <DeferredModal :active="appStore.isItemFormOpen" :loader="modalLoaders.itemForm" />
  <DeferredModal :active="appStore.isOotdFormOpen" :loader="modalLoaders.ootdForm" />
  <DeferredModal :active="appStore.isSosFormOpen" :loader="modalLoaders.sosForm" />
  <DeferredModal :active="appStore.isSuggestionFormOpen" :loader="modalLoaders.suggestion" />
  <DeferredModal :active="appStore.isSosDetailOpen" :loader="modalLoaders.sosDetail" />
  <DeferredModal :active="appStore.isSosCloseConfirmOpen" :loader="modalLoaders.sosClose" />
  <DeferredModal :active="appStore.isCommentOpen" :loader="modalLoaders.comment" />
  <DeferredModal :active="appStore.isProfileEditOpen" :loader="modalLoaders.profileEdit" />
  <DeferredModal :active="appStore.isNotificationOpen" :loader="modalLoaders.notification" />
  <DeferredModal :active="appStore.isLoginGateOpen" :loader="modalLoaders.loginGate" />
  <DeferredModal :active="appStore.isGuestImportOpen" :loader="modalLoaders.guestImport" />
  <DeferredModal :active="Boolean(ootdStore.shareSheetPostId)" :loader="modalLoaders.ootdShare" />

  <!-- Toast Message -->
  <BaseToast />
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppTopbar from '@/components/layout/AppTopbar.vue';
import AppBottomNav from '@/components/layout/AppBottomNav.vue';
import BrandOpening from '@/components/layout/BrandOpening.vue';
import GlobalStatus from '@/components/ui/GlobalStatus.vue';

import DeferredModal from '@/components/ui/DeferredModal.vue';
import BaseToast from '@/components/ui/BaseToast.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { useSocialStore } from '@/stores/social';

const appStore = useAppStore();
const authStore = useAuthStore();
const ootdStore = useOotdStore();
const route = useRoute();
const router = useRouter();
const socialStore = useSocialStore();
const isBrandHome = computed(() => route.name === 'BrandHome' || route.name === 'Home' && !authStore.isLoggedIn);
// Session restoration belongs to the shell, including the public homepage.
// It must not depend on whether the member topbar is mounted.
onMounted(async () => {
  await authStore.initAuth();
  const returnTo = authStore.consumeOAuthReturnTo();
  if (returnTo && returnTo !== '/') await router.replace(returnTo);
});
watch(() => authStore.profileId, profileId => {
  if (profileId) void socialStore.refresh(profileId);
  else socialStore.clear();
}, { immediate: true });
const modalLoaders = {
  auth: () => import('@/components/modal/AuthModal.vue'),
  itemDetail: () => import('@/components/modal/ItemDetailModal.vue'),
  itemForm: () => import('@/components/modal/ItemFormModal.vue'),
  ootdForm: () => import('@/components/modal/OotdFormModal.vue'),
  sosForm: () => import('@/components/modal/SosFormModal.vue'),
  suggestion: () => import('@/components/modal/SuggestionModal.vue'),
  sosDetail: () => import('@/components/modal/SosDetailModal.vue'),
  sosClose: () => import('@/components/modal/SosCloseConfirmModal.vue'),
  comment: () => import('@/components/modal/CommentModal.vue'),
  profileEdit: () => import('@/components/modal/ProfileEditModal.vue'),
  notification: () => import('@/components/modal/NotificationModal.vue'),
  loginGate: () => import('@/components/ui/LoginGate.vue'),
  guestImport: () => import('@/components/ui/GuestImportPrompt.vue'),
  ootdShare: () => import('@/components/ootd/OotdShareSheet.vue')
};
</script>

<style>
.app.app--brand-home{display:flex}
.app--brand-home #main-content{max-width:none;width:auto;margin:0;padding:0}
@media(max-width:900px){.app--brand-home #main-content{padding-bottom:72px}}
</style>
