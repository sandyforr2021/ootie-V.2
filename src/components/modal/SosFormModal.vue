<template>
  <div v-if="appStore.isSosFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal sos-form-modal">
      <button class="modal-close" :aria-label="$t('關閉')" @click="close">×</button>
      <h2>{{ t("請衣友幫忙搭配") }}</h2>
      <SosFormContent :is-modal="true" @cancel="close" @success="handleSuccess" />
    </section>
  </div>
</template>

<script setup>
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import SosFormContent from '@/components/sos/SosFormContent.vue';

const appStore = useAppStore();

const close = () => {
  appStore.isSosFormOpen = false;
  appStore.sosTargetItemId = null;
};

const handleSuccess = () => {
  close();
};
</script>

<style scoped>
.sos-form-modal {
  width: min(calc(100vw - 28px), 640px);
  max-height: min(90dvh, 800px);
  overflow-y: auto;
  padding: 30px;
  border-radius: 24px;
  background: var(--surface-raised, #fff);
}
.sos-form-modal h2 {
  margin: 0 0 20px;
  font-family: var(--font-display, inherit);
  font-size: 24px;
}
@media (max-width: 600px) {
  .sos-form-modal {
    padding: 20px 16px;
    border-radius: 18px;
  }
}
</style>
