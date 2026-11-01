<template>
  <div v-if="appStore.isSosDetailOpen && targetPost" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal sos-detail-modal">
      <button class="modal-close" :aria-label="$t('關閉')" @click="close">×</button>
      <SosDetailContent :post="targetPost" :is-modal="true" @close="close" @deleted="close" />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { updateDocumentMeta } from '@/services/documentMeta';
import SosDetailContent from '@/components/sos/SosDetailContent.vue';

const appStore = useAppStore();
const sosStore = useSosStore();

const targetPost = computed(() => {
  return sosStore.sosPosts.find((p) => p.id === appStore.activeSosDetailId);
});

const close = () => {
  appStore.isSosDetailOpen = false;
  appStore.activeSosDetailId = null;
  updateDocumentMeta({ name: 'Sos' });
};
</script>
