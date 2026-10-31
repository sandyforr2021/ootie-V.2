<script setup>
import { onBeforeUnmount, ref } from 'vue';
import AppIcon from './AppIcon.vue';
const frame = ref(null);
let animation;
function reset() {
  cancelAnimationFrame(animation);
  if (frame.value) frame.value.style.transform = '';
}
function tilt(event) {
  if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width - .5) * 7;
  const y = ((event.clientY - bounds.top) / bounds.height - .5) * -5;
  cancelAnimationFrame(animation);
  animation = requestAnimationFrame(() => {
    if (frame.value) frame.value.style.transform = `perspective(1000px) rotateX(${y}deg) rotateY(${x}deg)`;
  });
}
onBeforeUnmount(() => cancelAnimationFrame(animation));
</script>
<template>
  <div ref="frame" class="editorial-visual" @pointermove="tilt" @pointerleave="reset">
    <figure class="editorial-frame">
      <picture class="hero-photo">
        <source srcset="/assets/ootie-home-hero-v2-720.webp 720w, /assets/ootie-home-hero-v2-1024.webp 1024w" sizes="(max-width: 600px) 92vw, 460px" type="image/webp" />
        <img src="/assets/ootie-home-hero-v2-1024.webp" width="1024" height="1536" fetchpriority="high" :alt="$t('在明亮衣櫥前挑選柔黃色針織衫的穿搭情境')" />
      </picture>
      <div class="editorial-note"><AppIcon name="Closet" :size="24" /><div><strong>{{ $t('新衣，遇見舊愛。') }}</strong><span>{{ $t('從自己的衣櫥找到更多穿法') }}</span></div></div>
    </figure>
  </div>
</template>
<style scoped>
.editorial-visual{
  background:linear-gradient(155deg,#efbdd2 0%,#f9e2ec 52%,#efc0d5 100%);
  border-radius:180px 180px 16px 16px;
  box-shadow:0 18px 44px 8px #ffffffcc,0 5px 18px #fffffff2;
  margin:0;min-width:0;padding:28px 20px 16px;
  transform-style:preserve-3d;transition:transform 280ms ease-out;
}
.editorial-frame{margin:0;position:relative;transform-style:preserve-3d}
.hero-photo{
  display:block;background:var(--accent-pink-soft);overflow:hidden;
  border-radius:120px 120px 12px 12px;
}
.hero-photo img{display:block;width:100%;height:clamp(380px,42vw,560px);object-fit:cover;object-position:50% 25%}
.editorial-note{position:absolute;bottom:72px;left:-28px;display:flex;align-items:center;gap:14px;background:var(--accent-yellow);padding:19px 22px;box-shadow:0 12px 35px #30231a22;transform:translateZ(35px) rotate(-3deg) scale(.6);transform-origin:left bottom;max-width:94%}
.editorial-note strong,.editorial-note span{display:block}.editorial-note strong{font-size:15px;font-weight:600}.editorial-note span{font-size:11px;color:var(--muted);margin-top:5px}
@media(max-width:600px){.editorial-visual{padding:12px 10px 12px 14px}.hero-photo img{height:360px}.editorial-note{left:-14px;bottom:60px;padding:15px}}
@media(prefers-reduced-motion:reduce){.editorial-visual{transform:none!important;transition:none}.editorial-note{transform:scale(.6)!important;transition:none}}
</style>
