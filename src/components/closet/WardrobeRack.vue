<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Heart } from '@lucide/vue';
import { categoryFamily } from '@/services/commerce';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import WardrobeCutout from './WardrobeCutout.vue';

const props = defineProps({ items: { type: Array, default: () => [] }, showFavorites: { type: Boolean, default: true } });
defineEmits(['open', 'favorite']);
const tracks = new Map();
const edges = ref({});
let resizeObserver;
function measure() {
  for (const [id,el] of tracks) {
    const next={start:el.scrollLeft<=1,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-1};
    if(edges.value[id]?.start!==next.start || edges.value[id]?.end!==next.end) edges.value[id]=next;
  }
}
function attach(id,el) {
  if(tracks.get(id)===el)return;
  if(tracks.get(id))resizeObserver?.unobserve(tracks.get(id));
  if(el){tracks.set(id,el);resizeObserver?.observe(el);}else tracks.delete(id);
}
onMounted(()=>{if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(measure);for(const el of tracks.values())resizeObserver.observe(el);}measure();});
onBeforeUnmount(()=>resizeObserver?.disconnect());
watch(()=>props.items,async()=>{await nextTick();measure();});
const rows = computed(() => [
  { id: 'outer', label: '外套', family: 'outer' },
  { id: 'upper', label: '上衣', family: 'upper_body' },
  { id: 'lower', label: '下身', family: 'lower_body' },
  { id: 'dress', label: '洋裝', family: 'full_body' },
  { id: 'shoes', label: '鞋履', family: 'shoes', shelf: true },
  { id: 'accessories', label: '包款與配件', family: 'accessory', shelf: true }
].map(row => ({...row, items: props.items.filter(item => (item.outfit_layer === 'outer' ? 'outer' : categoryFamily(item.category)) === row.family)})).filter(row => row.items.length));
function slide(id, direction) {
  const element = tracks.get(id);
  element?.scrollBy({ left: direction * element.clientWidth * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
</script>
<template>
  <div class="wardrobe-rack">
    <section v-for="row in rows" :key="row.id" class="rack-row" :class="{'rack-shelf':row.shelf}">
      <header><h2 :id="`rack-heading-${row.id}`">{{ $t(row.label) }} <span>{{ row.items.length }}</span></h2><div class="rack-controls"><button type="button" :disabled="edges[row.id]?.start ?? true" :aria-label="`${$t('向左滑動')} · ${$t(row.label)}`" @click="slide(row.id,-1)"><ChevronLeft :size="18" /></button><button type="button" :disabled="edges[row.id]?.end ?? true" :aria-label="`${$t('向右滑動')} · ${$t(row.label)}`" @click="slide(row.id,1)"><ChevronRight :size="18" /></button></div></header>
      <div :ref="el => attach(row.id,el)" class="rack-track" tabindex="0" role="region" :aria-labelledby="`rack-heading-${row.id}`" @scroll="measure">
        <article v-for="item in row.items" :key="item.id" class="rack-item">
          <button class="rack-piece" type="button" :aria-label="`${$t('查看單品')}: ${itemName(item)}`" @click="$emit('open',item.id)"><WardrobeCutout :src="itemPhoto(item)" :category="item.category" :alt="itemName(item)" /></button>
          <div class="rack-caption"><span :title="itemName(item)">{{ itemName(item) }}</span><button v-if="showFavorites" class="rack-favorite" type="button" :aria-pressed="Boolean(item.favorite)" :aria-label="`${$t(item.favorite?'移除最愛':'加入最愛')} ${itemName(item)}`" @click="$emit('favorite',item.id)"><Heart :size="16" :fill="item.favorite?'currentColor':'none'" /></button></div>
        </article>
      </div>
    </section>
  </div>
</template>
<style scoped>
.rack-controls button:disabled{opacity:.3;cursor:default}
.wardrobe-rack{padding:8px 0 24px}.rack-row+ .rack-row{margin-top:26px}.rack-row header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.rack-row h2{font:500 15px/1.5 var(--font-body);margin:0}.rack-row h2 span{font-size:12px;color:var(--muted);margin-left:8px;font-variant-numeric:tabular-nums}.rack-controls{display:flex;gap:6px}.rack-controls button{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:50%;background:transparent;color:var(--ink)}
.rack-track{display:flex;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scroll-padding-inline:12px;padding:18px 12px 12px;background:#fff;border-top:0;border-radius:9px 9px 0 0;scrollbar-width:none}.rack-track::-webkit-scrollbar{display:none}.rack-item{flex:0 0 155px;min-width:0;scroll-snap-align:start}.rack-piece{display:block;padding:8px;width:100%;height:192px;background:white;border:0;border-radius:6px;cursor:pointer}.rack-piece :deep(img){width:100%;height:100%;object-fit:contain}.rack-shelf .rack-piece{height:128px}.rack-shelf .rack-track{border-top:0;border-bottom:0;border-radius:0 0 9px 9px}.rack-caption{display:flex;align-items:center;gap:8px;padding:10px 2px 0}.rack-caption>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.rack-favorite{flex-shrink:0;margin-left:auto;border:0;background:none;color:var(--accent);padding:8px;display:grid;place-items:center}.rack-track:focus-visible,.rack-piece:focus-visible,.rack-controls button:focus-visible,.rack-favorite:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(hover:hover){.rack-piece:hover{background:#faf6f8}.rack-controls button:hover{background:var(--accent-pink-soft)}}@media(max-width:600px){.rack-item{flex-basis:132px}.rack-piece{height:168px}.rack-track{gap:8px;padding-inline:6px}.rack-controls button{width:40px;height:40px}}
</style>
