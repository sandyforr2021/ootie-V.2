<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import { computed } from 'vue';
import { itemName, itemPhoto } from '@/services/itemPresentation';
const props = defineProps({ pieces: { type: Array, default: () => [] } });
defineEmits(['open']);
const visiblePieces=computed(()=>props.pieces.slice(0,4));
</script>
<template>
 <div class="outfit-preview">
  <div class="outfit-grid">
   <template v-for="index in 4" :key="index">
    <button v-if="visiblePieces[index-1]" type="button" class="outfit-piece" :aria-label="itemName(visiblePieces[index-1])" :title="itemName(visiblePieces[index-1])" @click="$emit('open',visiblePieces[index-1].id)"><MediaImage :src="itemPhoto(visiblePieces[index-1])" :alt="itemName(visiblePieces[index-1])" /></button>
    <div v-else class="outfit-piece outfit-piece-empty" aria-hidden="true"></div>
   </template>
  </div>
 </div>
</template>
<style scoped>
.outfit-preview{width:100%;max-width:360px;margin-inline:auto}.outfit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.outfit-piece{display:grid;place-items:center;width:100%;aspect-ratio:1;min-width:0;border:0;border-radius:10px;background:#fff;padding:8px;box-shadow:0 4px 16px #3022360c;cursor:pointer}.outfit-piece :deep(img){display:block;width:100%;height:100%;min-height:0;object-fit:contain;transition:transform 180ms ease-out}.outfit-piece-empty{box-shadow:none;background:#faf9fa;cursor:default}.outfit-piece:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(hover:hover){.outfit-piece:hover :deep(img){transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.outfit-piece :deep(img){transition:none}}
</style>
