<template>
  <a class="skip-link" href="#main-content">跳到主要內容</a>
  <BrandOpening />
  <GlobalStatus />

  <div class="app">
    <!-- Sidebar -->
    <AppSidebar />

    <main id="main-content" tabindex="-1">
      <!-- Topbar -->
      <AppTopbar />

      <!-- Page Views -->
      <router-view v-slot="{ Component }">
        <Suspense>
          <component :is="Component" />
          <template #fallback>
            <div class="route-loading" role="status" aria-live="polite">正在開啟頁面…</div>
          </template>
        </Suspense>
      </router-view>
    </main>
  </div>

  <!-- Mobile Bottom Nav -->
  <AppBottomNav />

  <!-- Modals -->
  <AuthModal />
  <ItemDetailModal />
  <ItemFormModal />
  <OotdFormModal />
  <SosFormModal />
  <SuggestionModal />
  <SosDetailModal />
  <SosCloseConfirmModal />
  <CommentModal />
  <ProfileEditModal />
  <NotificationModal />
  <LoginGate />
  <GuestImportPrompt />
  <OotdShareSheet />

  <!-- Toast Message -->
  <BaseToast />
</template>

<script setup>
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppTopbar from '@/components/layout/AppTopbar.vue';
import AppBottomNav from '@/components/layout/AppBottomNav.vue';
import BrandOpening from '@/components/layout/BrandOpening.vue';
import GlobalStatus from '@/components/ui/GlobalStatus.vue';

import AuthModal from '@/components/modal/AuthModal.vue';
import ItemDetailModal from '@/components/modal/ItemDetailModal.vue';
import ItemFormModal from '@/components/modal/ItemFormModal.vue';
import OotdFormModal from '@/components/modal/OotdFormModal.vue';
import SosFormModal from '@/components/modal/SosFormModal.vue';
import SuggestionModal from '@/components/modal/SuggestionModal.vue';
import SosDetailModal from '@/components/modal/SosDetailModal.vue';
import SosCloseConfirmModal from '@/components/modal/SosCloseConfirmModal.vue';
import CommentModal from '@/components/modal/CommentModal.vue';
import ProfileEditModal from '@/components/modal/ProfileEditModal.vue';
import NotificationModal from '@/components/modal/NotificationModal.vue';
import LoginGate from '@/components/ui/LoginGate.vue';
import GuestImportPrompt from '@/components/ui/GuestImportPrompt.vue';
import OotdShareSheet from '@/components/ootd/OotdShareSheet.vue';

import BaseToast from '@/components/ui/BaseToast.vue';
</script>
