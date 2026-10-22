<template>
  <div v-if="isVisible" class="brand-opening" aria-hidden="true">
    <div class="brand-opening__veil"></div>
    <div class="brand-opening__identity">
      <span class="brand-opening__eyebrow">{{ $t('每天，都更像自己。') }}</span>
      <BrandMark class="brand-opening__mark" />
      <span class="brand-opening__line"></span>
    </div>
    <div class="brand-opening__doors">
      <div class="brand-opening__door brand-opening__door--left">
        <span class="brand-opening__door-line"></span>
        <span class="brand-opening__handle"></span>
      </div>
      <div class="brand-opening__door brand-opening__door--right">
        <span class="brand-opening__door-line"></span>
        <span class="brand-opening__handle"></span>
      </div>
    </div>
    <p class="brand-opening__enter">{{ $t('打開衣櫥，遇見更多可能。') }}</p>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import BrandMark from '@/components/layout/BrandMark.vue';

const BRAND_OPENING_DURATION_MS = 2400;
const BRAND_OPENING_SESSION_KEY = 'ootie:brand-opening:v2';

const isVisible = ref(false);
let hideTimer;

const playOpening = () => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  window.clearTimeout(hideTimer);
  isVisible.value = true;
  hideTimer = window.setTimeout(() => { isVisible.value = false; }, BRAND_OPENING_DURATION_MS);
};
onMounted(() => {
  window.addEventListener('ootie:replay-opening', playOpening);
  const isHomeEntry = window.location.pathname === '/';
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let hasPlayed = false;
  try { hasPlayed = window.sessionStorage.getItem(BRAND_OPENING_SESSION_KEY) === 'played'; } catch { /* Storage may be restricted. */ }

  if (!isHomeEntry || prefersReducedMotion || hasPlayed) return;

  try { window.sessionStorage.setItem(BRAND_OPENING_SESSION_KEY, 'played'); } catch { /* The timed exit still works. */ }
  isVisible.value = true;
  hideTimer = window.setTimeout(() => {
    isVisible.value = false;
  }, BRAND_OPENING_DURATION_MS);
});

onBeforeUnmount(() => { window.clearTimeout(hideTimer); window.removeEventListener('ootie:replay-opening', playOpening); });
</script>

<style scoped>
.brand-opening {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  pointer-events: none;
  perspective: 1400px;
  animation: opening-shell 2.4s linear both;
}

.brand-opening__veil {
  position: absolute;
  inset: 0;
  background:
    var(--paper);
  animation: opening-veil 2.4s linear both;
}

.brand-opening__identity {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 13px;
  animation: opening-identity 2.4s cubic-bezier(.16, 1, .3, 1) both;
}

.brand-opening__eyebrow {
  color: var(--muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .24em;
}

.brand-opening__mark {
  font-size: clamp(64px, 9vw, 100px) !important;
  font-weight: 800;
  letter-spacing: .15em;
}

.brand-opening__line {
  width: 76px;
  height: 2px;
  border-radius: 999px;
  background: var(--accent);
  transform-origin: center;
  animation: opening-line 2.4s cubic-bezier(.16, 1, .3, 1) both;
}

.brand-opening__doors {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.brand-opening__door {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(70, 62, 61, .13);
  background:
    linear-gradient(90deg, rgba(255,255,255,.38), transparent 18%, rgba(85,67,61,.06) 50%, transparent 82%, rgba(255,255,255,.32)),
    #eadfd7;
  box-shadow: inset 0 0 0 12px rgba(255,255,255,.18), 0 0 42px rgba(53,45,52,.16);
  backface-visibility: hidden;
  will-change: transform;
}

.brand-opening__door::before,
.brand-opening__door::after {
  content: '';
  position: absolute;
  inset: 7.5% 9%;
  border: 1px solid rgba(82, 67, 63, .18);
  border-radius: 4px;
}

.brand-opening__door::after { inset: 53% 9% 7.5%; }
.brand-opening__door--left { transform-origin: left center; animation: opening-left-door 2.4s cubic-bezier(.7, 0, .18, 1) both; }
.brand-opening__door--right { transform-origin: right center; animation: opening-right-door 2.4s cubic-bezier(.7, 0, .18, 1) both; }

.brand-opening__door-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(70, 56, 54, .2);
}

.brand-opening__door--left .brand-opening__door-line { right: 18%; }
.brand-opening__door--right .brand-opening__door-line { left: 18%; }

.brand-opening__handle {
  position: absolute;
  top: 48%;
  width: 8px;
  height: 54px;
  border-radius: 999px;
  background: linear-gradient(90deg, #b49a6f, #e7d1a0 48%, #9a815c);
  box-shadow: 0 6px 14px rgba(58, 44, 35, .22);
}

.brand-opening__door--left .brand-opening__handle { right: 22px; }
.brand-opening__door--right .brand-opening__handle { left: 22px; }

.brand-opening__enter {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: clamp(28px, 6vh, 64px);
  margin: 0;
  color: #5f585a;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .28em;
  white-space: nowrap;
  animation: opening-enter 2.4s ease both;
}

@keyframes opening-shell {
  0%, 94% { visibility: visible; }
  100% { visibility: hidden; }
}

@keyframes opening-veil {
  0%, 39% { opacity: 1; }
  48%, 100% { opacity: 0; }
}

@keyframes opening-identity {
  0% { opacity: 0; transform: translateY(12px) scale(.97); }
  12%, 34% { opacity: 1; transform: none; }
  45%, 100% { opacity: 0; transform: translateY(-8px) scale(.97); }
}

@keyframes opening-line {
  0%, 8% { opacity: 0; transform: scaleX(0); }
  22%, 36% { opacity: 1; transform: scaleX(1); }
  45%, 100% { opacity: 0; transform: scaleX(.7); }
}

@keyframes opening-left-door {
  0%, 26% { opacity: 0; transform: translateX(0) rotateY(0); }
  36%, 51% { opacity: 1; transform: translateX(0) rotateY(0); }
  88%, 100% { opacity: 1; transform: translateX(-102%) rotateY(-10deg); }
}

@keyframes opening-right-door {
  0%, 26% { opacity: 0; transform: translateX(0) rotateY(0); }
  36%, 51% { opacity: 1; transform: translateX(0) rotateY(0); }
  88%, 100% { opacity: 1; transform: translateX(102%) rotateY(10deg); }
}

@keyframes opening-enter {
  0%, 34% { opacity: 0; transform: translate(-50%, 8px); }
  43%, 55% { opacity: 1; transform: translate(-50%, 0); }
  68%, 100% { opacity: 0; transform: translate(-50%, -4px); }
}

@media (max-width: 760px) {
  .brand-opening__mark { font-size: clamp(56px, 16vw, 76px) !important; }
  .brand-opening__door::before { inset: 7% 12%; }
  .brand-opening__door::after { inset: 53% 12% 7%; }
  .brand-opening__door--left .brand-opening__handle { right: 14px; }
  .brand-opening__door--right .brand-opening__handle { left: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .brand-opening { display: none; }
}
:lang(zh-TW) .brand-opening__eyebrow,:lang(ja) .brand-opening__eyebrow{letter-spacing:.08em;font-size:13px}
</style>
