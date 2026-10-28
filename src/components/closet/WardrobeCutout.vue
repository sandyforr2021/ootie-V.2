<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { clothingCutoutPreview } from '@/services/clothingCutout';

const props = defineProps({ src: String, alt: String, category: String });
const preview = ref('');
const busy = ref(false);
let version = 0;
watch(() => props.src, () => { version++; preview.value = ''; busy.value = false; });
onBeforeUnmount(() => { version++; });
async function prepare() {
  // These originals were processed and visually checked ahead of time. Do not
  // download a model or repeatedly process them when daily suggestions rotate.
  if (props.src?.startsWith('/catalog/cutouts/')) return;
  if (preview.value || busy.value || !props.src) return;
  busy.value = true;
  const request = version;
  let image;
  try {
    const result = await clothingCutoutPreview(props.src, props.category);
    if (request !== version) return;
    image = await createImageBitmap(result.displayBlob);
    const scale = Math.min(1, 480 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = data.data;
    // Trim transparent margins, never the garment itself, for a balanced layout.
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (left > right || top > bottom) return;
    const cropped = document.createElement('canvas');
    cropped.width = right - left + 13; cropped.height = bottom - top + 13;
    const croppedContext = cropped.getContext('2d');
    if (!croppedContext) return;
    croppedContext.drawImage(canvas, left, top, right - left + 1, bottom - top + 1, 6, 6, right - left + 1, bottom - top + 1);
    if (request === version) preview.value = cropped.toDataURL('image/png');
  } catch (error) { if (import.meta.env.DEV) console.warn('Clothing preview:', error?.message); }
  finally { image?.close(); if (request === version) busy.value = false; }
}
</script>
<template><img :src="preview || src" :alt="alt" :aria-busy="busy" loading="lazy" @load="prepare" /></template>
