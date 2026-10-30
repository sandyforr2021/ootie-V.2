<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue';
const root=ref(null),visible=ref(true);
let observer;
onMounted(()=>{
 if(typeof IntersectionObserver==='undefined')return;
 observer=new IntersectionObserver(entries=>{visible.value=entries.some(entry=>entry.isIntersecting);});
 observer.observe(root.value);
});
onBeforeUnmount(()=>observer?.disconnect());
</script>

<template>
 <div ref="root" class="hero-editorial" :class="{'is-visible':visible}" aria-hidden="true">
  <div class="hero-editorial-arrival"><img class="hero-editorial-image" src="/assets/brand/wardrobe-editorial-v2-900.webp" srcset="/assets/brand/wardrobe-editorial-v2-480.webp 480w, /assets/brand/wardrobe-editorial-v2-900.webp 900w, /assets/brand/wardrobe-editorial-v2-1448.webp 1448w" sizes="(max-width:700px) calc(100vw - 48px), (max-width:1100px) 44vw, 600px" width="1448" height="1086" alt="" fetchpriority="high" decoding="async" /></div>
 </div>
</template>

<style scoped>
.hero-editorial{width:100%;height:100%;display:grid;place-items:center;pointer-events:none}
.hero-editorial-arrival{width:100%;height:100%;display:grid;place-items:center;animation:editorial-arrive 950ms cubic-bezier(.16,1,.3,1) both}
.hero-editorial-image{display:block;width:100%;height:100%;object-fit:contain;object-position:center;transform-origin:68% 75%;animation:editorial-drift 7s ease-in-out 950ms infinite alternate;animation-play-state:paused}
.is-visible .hero-editorial-image{animation-play-state:running}
@keyframes editorial-arrive{from{opacity:.4;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes editorial-drift{0%{transform:translate3d(0,5px,0) rotate(-.55deg)}50%{transform:translate3d(-3px,-2px,0) rotate(.1deg)}100%{transform:translate3d(2px,-7px,0) rotate(.55deg)}}
@media(max-width:700px){.hero-editorial{height:auto;aspect-ratio:4/3}.hero-editorial-image{animation-name:editorial-drift-mobile}@keyframes editorial-drift-mobile{from{transform:translateY(3px) rotate(-.3deg)}to{transform:translateY(-4px) rotate(.3deg)}}}
@media(prefers-reduced-motion:reduce){.hero-editorial-arrival,.hero-editorial-image{animation:none;transform:none;opacity:1}}
</style>
