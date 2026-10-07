<template>
  <div
    :class="['toast', `toast--${appStore.toastType}`, { show: appStore.toastVisible }]"
    :role="appStore.toastType === 'error' ? 'alert' : 'status'"
    :aria-live="appStore.toastType === 'error' ? 'assertive' : 'polite'"
    aria-atomic="true"
  >
    <span class="toast__icon" aria-hidden="true">{{ icon }}</span>
    <span>
      {{ appStore.toastMessage }}
      <small v-if="appStore.toastSyncStatus" class="toast__sync-status">
        {{ syncLabel }}
      </small>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const icon = computed(() => ({ success: '✓', error: '!', warning: '△', info: 'i' }[appStore.toastType] || 'i'));
const syncLabel = computed(() => ({
  LOCAL_ONLY: '僅保存在此裝置',
  REMOTE_FAILED: '遠端同步失敗',
  UNSYNCED: '尚未同步',
  SYNCED: '已同步'
}[appStore.toastSyncStatus] || appStore.toastSyncStatus));
</script>
