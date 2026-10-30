<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import { computed,ref,watch } from 'vue';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import AppIcon from '@/components/ui/AppIcon.vue';
import {t} from '@/i18n';
const props = defineProps({ pieces: { type: Array, default: () => [] } });
defineEmits(['open']);
const page=ref(0);
const pageCount=computed(()=>Math.max(1,Math.ceil(props.pieces.length/4)));
const visiblePieces=computed(()=>props.pieces.slice(page.value*4,page.value*4+4));
watch(()=>props.pieces,()=>{page.value=0;});
</script>
<template>
 <div class="outfit-preview">
  <div class="outfit-grid">
   <template v-for="index in 4" :key="index">
    <button v-if="visiblePieces[index-1]" type="button" class="outfit-piece" :aria-label="itemName(visiblePieces[index-1])" :title="itemName(visiblePieces[index-1])" @click="$emit('open',visiblePieces[index-1].id)"><MediaImage :src="itemPhoto(visiblePieces[index-1])" :alt="itemName(visiblePieces[index-1])" /></button>
    <div v-else class="outfit-piece outfit-piece-empty" aria-hidden="true"></div>
   </template>
  </div>
  <nav v-if="pageCount>1" class="outfit-piece-pages" :aria-label="t('本套使用單品')">
   <button type="button" :disabled="page===0" :aria-label="t('上一頁')" @click="page--"><AppIcon name="back" :size="16"/></button>
   <span aria-live="polite">{{ page+1 }} / {{ pageCount }}</span>
   <button type="button" :disabled="page===pageCount-1" :aria-label="t('下一頁')" @click="page++"><AppIcon name="arrow" :size="16"/></button>
  </nav>
 </div>
</template>
<style scoped>
.outfit-preview{width:100%;max-width:360px;margin-inline:auto}.outfit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.outfit-piece{display:grid;place-items:center;width:100%;aspect-ratio:1;min-width:0;border:0;border-radius:10px;background:#fff;padding:8px;box-shadow:0 4px 16px #3022360c;cursor:pointer}.outfit-piece :deep(img){display:block;width:100%;height:100%;min-height:0;object-fit:contain;transition:transform 180ms ease-out}.outfit-piece-empty{box-shadow:none;background:#faf9fa;cursor:default}.outfit-piece:focus-visible,.outfit-piece-pages button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.outfit-piece-pages{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:12px;color:var(--muted);font-size:11px}.outfit-piece-pages button{display:grid;place-items:center;width:32px;height:32px;padding:0;background:#fff;border:0;border-radius:50%;cursor:pointer}.outfit-piece-pages button:disabled{opacity:.3;cursor:default}@media(hover:hover){.outfit-piece:hover :deep(img){transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.outfit-piece :deep(img){transition:none}}
</style>
