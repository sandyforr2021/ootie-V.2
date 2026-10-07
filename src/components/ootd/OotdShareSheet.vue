<template>
  <BaseModal
    :open="Boolean(ootdStore.shareSheetPostId)"
    title-id="ootd-share-title"
    content-class="ootd-share-sheet"
    @close="close"
  >
    <p class="eyebrow">Share OOTD</p>
    <h2 id="ootd-share-title">分享這套穿搭</h2>
    <p class="ootd-share-copy">選擇分享方式；實際發布仍由各平台或系統分享選單完成。</p>
    <div class="ootd-share-options">
      <button type="button" @click="shareTo('facebook')">Facebook</button>
      <button type="button" @click="shareTo('threads')">Threads</button>
      <button type="button" @click="shareTo('line')">LINE</button>
      <button type="button" @click="shareTo('instagram')">Instagram</button>
      <button type="button" class="primary" @click="copyLink">複製連結</button>
    </div>
  </BaseModal>
</template>

<script setup>
import BaseModal from '@/components/ui/BaseModal.vue';
import { useOotdStore } from '@/stores/ootd';

const ootdStore = useOotdStore();
const close = () => { ootdStore.shareSheetPostId = null; };
const copyLink = async () => {
  if (await ootdStore.copyShareLink()) close();
};
const shareTo = async (target) => {
  await ootdStore.shareTo(target);
  close();
};
</script>
