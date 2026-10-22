<template>
  <div v-if="!online" class="global-status global-status--offline" role="status" aria-live="polite">
    <strong>{{ $t("目前離線") }}</strong><span>{{ $t("已載入的頁面仍可瀏覽；需要連線的操作會在網路恢復後才能使用。") }}</span>
  </div>
  <div v-if="errorMessage" class="global-status global-status--error" role="alert">
    <span><strong>{{ $t("頁面暫時無法完成操作") }}</strong>{{ errorMessage }}</span>
    <span class="global-status-actions"><button type="button" @click="retry">{{ $t("重試") }}</button><router-link to="/">{{ $t("返回首頁") }}</router-link></span>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { monitoring } from '@/services/monitoring';

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
const errorMessage = ref('');
const updateOnline = () => { online.value = navigator.onLine; };
const handleRouteError = (event) => {
  errorMessage.value = '載入頁面失敗，請檢查網路後重試。';
  monitoring.capture(new Error(event.detail?.message || 'ROUTE_LOAD_FAILED'), { source: 'router' });
};
const handleServiceError = (event) => { errorMessage.value = event.detail?.message || '服務暫時無法使用。'; };
const retry = () => { errorMessage.value = ''; window.location.reload(); };
onMounted(() => {
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  window.addEventListener('ootie:route-error', handleRouteError);
  window.addEventListener('ootie:service-error', handleServiceError);
});
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline);
  window.removeEventListener('offline', updateOnline);
  window.removeEventListener('ootie:route-error', handleRouteError);
  window.removeEventListener('ootie:service-error', handleServiceError);
});
</script>

<style scoped>
.global-status{position:fixed;z-index:1200;inset-inline:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;justify-content:space-between;gap:18px;width:min(680px,calc(100vw - 28px));padding:13px 16px;border-radius:14px;box-shadow:var(--shadow);background:var(--ink);color:#fff}.global-status strong{margin-inline-end:8px}.global-status span{line-height:1.45}.global-status--error{background:#7d4143}.global-status-actions{display:flex;align-items:center;gap:8px;flex:none}.global-status button,.global-status a{min-height:44px;padding:8px 12px;border:1px solid rgba(255,255,255,.4);border-radius:10px;background:transparent;color:#fff;font-weight:750}@media(max-width:600px){.global-status{align-items:stretch;flex-direction:column;gap:10px}.global-status-actions{justify-content:flex-end}}
</style>
