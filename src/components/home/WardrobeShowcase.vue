<script setup>
import {useAuthStore} from '@/stores/auth';
import {useRouter} from 'vue-router';
import AppIcon from '@/components/ui/AppIcon.vue';
const auth=useAuthStore(),router=useRouter();
const join=()=>auth.isLoggedIn?router.push('/closet?quick=add-item'):auth.openAuthModal('login',null,'/closet?quick=add-item');
const images=['01','07','02','03','08','10'].map(id=>`/demo/garments/${id}.webp`);
</script>
<template>
 <figure class="wardrobe-showcase" :aria-label="$t('衣櫥展示')">
  <figcaption><span><AppIcon name="Closet" :size="20"/>{{ $t('衣櫥展示') }}</span></figcaption>
  <div class="showcase-window"><div class="showcase-track" ><div v-for="copy in 2" :key="copy" class="showcase-group" :aria-hidden="copy===2?'true':undefined"><div v-for="src in images" :key="src" class="showcase-garment"><img :src="src" :alt="copy===1?$t('服飾展示'):''" loading="lazy" width="240" height="300"/></div></div></div></div>
  <div class="showcase-tools" aria-hidden="true"><span><AppIcon name="search" :size="18"/></span><span><AppIcon name="heart" :size="18"/></span><span><AppIcon name="Stats" :size="18"/></span></div>
 </figure>
</template>
<style scoped>
.wardrobe-showcase{position:relative;min-width:0;width:100%;margin:0;border-radius:16px;padding:22px 0;background:linear-gradient(145deg,#f4efff,#fff9f6 55%,#fff4df);overflow:hidden}
.wardrobe-showcase figcaption{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 24px 16px;font-size:14px;color:var(--muted)}
figcaption>span{display:flex;align-items:center;gap:10px}
.showcase-window{overflow:hidden;padding:8px 0 18px}
.showcase-track{display:flex;width:max-content;animation:wardrobe-drift 35s linear infinite}
.showcase-group{display:flex;gap:18px;padding-right:18px}
.showcase-garment{width:180px;aspect-ratio:3/4;padding:12px;background:white;border-radius:14px;box-shadow:0 8px 24px -18px #55435e66}
.showcase-garment img{width:100%;height:100%;object-fit:contain;border-radius:8px}
.showcase-window:hover .showcase-track,.wardrobe-showcase:focus-within .showcase-track{animation-play-state:paused}
.showcase-tools{display:flex;gap:12px;justify-content:center;padding-top:12px}
.showcase-tools span{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#fff9;color:var(--accent)}
@keyframes wardrobe-drift{to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.showcase-track{animation:none}.showcase-window{overflow-x:auto}.showcase-group[aria-hidden=true]{display:none}}
@media(max-width:600px){.showcase-garment{width:145px}.wardrobe-showcase{padding-top:14px}}
</style>
