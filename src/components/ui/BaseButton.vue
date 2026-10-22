<template>
  <button
    :type="type"
    :class="['base-button', `base-button--${variant}`, $attrs.class]"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    :aria-label="accessibleName || undefined"
    v-bind="forwardedAttrs"
  >
    <span v-if="loading" class="base-button__spinner" aria-hidden="true"></span>
    <span :class="{ 'sr-only': loading && hideLabelWhileLoading }">
      <slot>{{ label }}</slot>
    </span>
    <span v-if="loading" class="sr-only">{{ $t("處理中") }}</span>
  </button>
</template>

<script setup>
import { computed, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  label: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  hideLabelWhileLoading: { type: Boolean, default: false }
});

const attrs = useAttrs();
const accessibleName = computed(() => props.ariaLabel || attrs['aria-label'] || props.label);
const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});
</script>
