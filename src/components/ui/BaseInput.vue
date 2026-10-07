<template>
  <div :class="['base-field', { 'base-field--error': error }]">
    <label v-if="label" :for="inputId" class="base-field__label">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <input
      :id="inputId"
      :value="modelValue"
      :required="required"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="descriptionIds || undefined"
      v-bind="$attrs"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="description" :id="`${inputId}-description`" class="base-field__description">{{ description }}</p>
    <p v-if="error" :id="`${inputId}-error`" class="base-field__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  description: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});

defineEmits(['update:modelValue']);

const inputId = computed(() => props.id);
const descriptionIds = computed(() => [
  props.description ? `${props.id}-description` : '',
  props.error ? `${props.id}-error` : ''
].filter(Boolean).join(' '));
</script>
