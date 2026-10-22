<template>
  <div v-if="open" class="modal-backdrop open" @mousedown.self="requestClose">
    <component
      :is="as"
      ref="dialogRef"
      :class="['modal', contentClass]"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId || undefined"
      :aria-label="titleId ? undefined : ariaLabel"
      tabindex="-1"
      @keydown="handleKeydown"
    >
      <button v-if="showClose" type="button" class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="requestClose">×</button>
      <slot />
    </component>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  titleId: { type: String, default: '' },
  ariaLabel: { type: String, default: '對話框' },
  contentClass: { type: [String, Array, Object], default: '' },
  as: { type: String, default: 'section' },
  showClose: { type: Boolean, default: true },
  closeOnBackdrop: { type: Boolean, default: true }
});

const emit = defineEmits(['close']);
const dialogRef = ref(null);
let restoreTarget = null;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const focusableElements = () => Array.from(dialogRef.value?.querySelectorAll(focusableSelector) || [])
  .filter((element) => element.getAttribute('aria-hidden') !== 'true');

const requestClose = (event) => {
  if (event?.currentTarget?.classList?.contains('modal-backdrop') && !props.closeOnBackdrop) return;
  emit('close');
};

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    requestClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusableElements();
  if (!items.length) {
    event.preventDefault();
    dialogRef.value?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const restoreFocus = () => {
  if (restoreTarget && typeof restoreTarget.focus === 'function' && document.contains(restoreTarget)) {
    restoreTarget.focus();
  }
  restoreTarget = null;
};

watch(
  () => props.open,
  async (open, wasOpen) => {
    if (open) {
      restoreTarget = document.activeElement;
      await nextTick();
      const [first] = focusableElements();
      (first || dialogRef.value)?.focus();
    } else if (wasOpen) {
      await nextTick();
      restoreFocus();
    }
  },
  { immediate: true }
);

onBeforeUnmount(restoreFocus);
</script>
