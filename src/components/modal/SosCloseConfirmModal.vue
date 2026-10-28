<template>
  <BaseConfirmDialog
    :open="appStore.isSosCloseConfirmOpen"
    :title="t('結束這次求救？')"
    :message="t('結束後將不再接受新的搭配建議，但你仍可以查看目前收到的所有回覆。')"
    :confirm-label="t('確認結束')"
    content-class="sos-close-confirm-modal"
    @cancel="close"
    @confirm="handleConfirm"
  />
</template>

<script setup>
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import BaseConfirmDialog from '@/components/ui/BaseConfirmDialog.vue';

const appStore = useAppStore();
const sosStore = useSosStore();

const close = () => {
  appStore.isSosCloseConfirmOpen = false;
  appStore.sosToCloseId = null;
};

const handleConfirm = async () => {
  if (appStore.sosToCloseId) {
    const success = await sosStore.closeSosPost(appStore.sosToCloseId);
    if (!success) return;
  }
  close();
};
</script>
