<script setup>
import { computed } from 'vue';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import WardrobeCutout from './WardrobeCutout.vue';
const props = defineProps({ pieces: { type: Array, default: () => [] } });
defineEmits(['open']);
const layout = computed(() => ({'has-dress':props.pieces.some(item=>item.slot==='dress'),'has-layer':props.pieces.some(item=>item.slot==='outer')}));
</script>
<template><div class="outfit-board" :class="layout"><button v-for="item in pieces" :key="item.id" type="button" :class="`board-${item.slot}`" :aria-label="itemName(item)" :title="itemName(item)" @click="$emit('open',item.id)"><WardrobeCutout :src="itemPhoto(item)" :category="item.category" :alt="itemName(item)" /></button></div></template>
<style scoped>
.outfit-board{position:relative;aspect-ratio:1/1;max-width:440px;width:100%;margin-inline:auto;background:#fff;isolation:isolate}.outfit-board button{position:absolute;display:block;min-width:0;min-height:0;border:0;border-radius:8px;background:transparent;padding:6px;cursor:pointer}.outfit-board :deep(img){width:100%;height:100%;object-fit:contain;display:block;transition:transform 180ms ease-out}.board-top{left:0;top:0;width:58%;height:48%;z-index:2}.board-bottom{left:2%;bottom:0;width:57%;height:54%}.board-dress{left:0;top:3%;height:94%;width:61%}.board-shoes{right:0;bottom:2%;width:37%;height:30%}.board-accessory{right:0;top:36%;width:34%;height:29%}.board-accent{right:4%;top:3%;width:30%;height:28%}.board-outer{left:0;top:1%;width:35%;height:53%;z-index:1}.has-layer:not(.has-dress) .board-top{left:25%;top:8%;width:34%;height:42%}.has-layer:not(.has-dress) .board-bottom{left:13%;width:47%}.has-dress.has-layer .board-outer{left:auto;right:1%;top:1%;width:36%;height:35%}.has-dress.has-layer .board-accent{right:31%;top:3%;width:16%;height:22%;z-index:3}.outfit-board button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(hover:hover){.outfit-board button:hover :deep(img){transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){.outfit-board :deep(img){transition:none}}
</style>
