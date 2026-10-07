<template>
  <BaseModal
    :open="appStore.isGuestImportOpen"
    title-id="guest-import-title"
    content-class="guest-import-modal"
    @close="appStore.dismissGuestImport()"
  >
    <p class="eyebrow">Welcome back</p>
    <h2 id="guest-import-title">要把試用期間加入的衣物帶進會員衣櫥嗎？</h2>
    <p>共 {{ appStore.guestImportItems.length }} 件。匯入後會沿用你的會員身份與遠端衣櫥權限。</p>
    <p v-if="appStore.guestImportError" class="guest-import-error" role="alert">
      {{ appStore.guestImportError }}
    </p>
    <div class="guest-import-actions">
      <button
        type="button"
        class="primary"
        :disabled="appStore.guestImportLoading"
        @click="appStore.importGuestItems()"
      >
        {{ appStore.guestImportLoading ? '正在匯入…' : '加入我的衣櫥' }}
      </button>
      <button type="button" class="secondary" :disabled="appStore.guestImportLoading" @click="appStore.dismissGuestImport()">
        稍後處理
      </button>
    </div>
  </BaseModal>
</template>

<script setup>
import { useAppStore } from '@/stores/app';
import BaseModal from './BaseModal.vue';

const appStore = useAppStore();
</script>

<style scoped>
.guest-import-modal {
  width: min(480px, calc(100vw - 32px));
  padding: 30px;
}

.guest-import-modal h2 {
  margin: 8px 0 12px;
  font-family: "Playfair Display", serif;
  font-size: 26px;
}

.guest-import-modal > p:not(.eyebrow):not(.guest-import-error) {
  color: var(--muted);
  line-height: 1.6;
}

.guest-import-error {
  margin-top: 14px;
  color: #9a4c47;
  line-height: 1.5;
}

.guest-import-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.guest-import-actions button {
  flex: 1;
}
</style>
