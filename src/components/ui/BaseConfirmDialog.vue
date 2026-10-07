<template>
  <BaseModal
    :open="open"
    :title-id="titleId"
    :content-class="['confirm-dialog', contentClass]"
    :close-on-backdrop="!busy"
    @close="cancel"
  >
    <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
    <h2 :id="titleId">{{ title }}</h2>
    <p class="confirm-dialog__message">{{ message }}</p>
    <div class="form-actions">
      <BaseButton variant="secondary" :disabled="busy" @click="cancel">{{ cancelLabel }}</BaseButton>
      <BaseButton :variant="destructive ? 'danger' : 'primary'" :loading="busy" @click="$emit('confirm')">
        {{ confirmLabel }}
      </BaseButton>
    </div>
  </BaseModal>
</template>

<script setup>
import BaseButton from './BaseButton.vue';
import BaseModal from './BaseModal.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, required: true },
  titleId: { type: String, default: 'confirm-dialog-title' },
  eyebrow: { type: String, default: '' },
  confirmLabel: { type: String, default: '確認' },
  cancelLabel: { type: String, default: '取消' },
  destructive: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  contentClass: { type: [String, Array, Object], default: '' }
});

const emit = defineEmits(['confirm', 'cancel']);
const cancel = () => {
  if (!props.busy) emit('cancel');
};
</script>
