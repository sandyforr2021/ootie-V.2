<script setup>
import {ref} from 'vue';
import {t} from '@/i18n';
const address = window.location.origin;
const copied = ref(false); const copyError=ref(false);
async function copy() {try {await navigator.clipboard.writeText(address);copied.value=true;copyError.value=false;}catch{copyError.value=true;}}
</script>
<template>
  <section class="extension-setup">
    <h2>{{ t('瀏覽器收藏助手') }}</h2>
    <p>{{ t('瀏覽商品頁時擷取名稱、圖片與購買連結，確認後帶到試穿工作室。') }}</p>
    <a class="primary" href="/downloads/ootie-browser-companion.zip" download>{{ t('下載 Chrome 擴充功能') }}</a>
    <ol>
      <li>{{ t('解壓縮下載的檔案，保留整個資料夾。') }}</li>
      <li>{{ t('在 Chrome 網址列輸入') }} <code>chrome://extensions</code>，{{ t('開啟「開發人員模式」，選擇「載入未封裝項目」。') }}</li>
      <li>{{ t('選取解壓縮後含 manifest.json 的資料夾，將 OOTIE 釘選到工具列。') }}</li>
      <li>{{ t('開啟商品頁，點擊 OOTIE 圖示。確認商品資訊與下方網站網址，再選擇「帶到 OOTIE」。') }}</li>
    </ol>
    <label>{{ t('OOTIE 網站網址') }}<input :value="address" readonly @focus="$event.target.select()" /></label>
    <button class="secondary" @click="copy">{{ t(copied ? '網址已複製' : '複製網站網址') }}</button>
    <p v-if="copyError" role="alert">{{ t('請選取上方網址並手動複製。') }}</p>
    <p class="extension-note">{{ t('此版本以資料夾安裝，尚未在 Chrome 線上應用程式商店上架。商品讀取受到各網站提供的資訊限制，缺少圖片時可在工作室上傳。') }}</p>
  </section>
</template>
<style scoped>
.extension-setup{display:grid;gap:16px}.extension-setup h2,.extension-setup p{margin:0}.extension-setup p,.extension-setup li{line-height:1.7;color:var(--muted)}.extension-setup ol{padding-left:24px;display:grid;gap:12px;margin:0}.extension-setup label{display:grid;gap:8px}.extension-setup input{width:100%;padding:12px;background:var(--paper);border:1px solid var(--line);border-radius:8px}.extension-setup .primary,.extension-setup .secondary{justify-self:start}.extension-note{font-size:13px}.extension-setup code{overflow-wrap:anywhere}
</style>
