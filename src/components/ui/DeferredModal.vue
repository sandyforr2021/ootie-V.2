<template>
  <Content v-if="requested" />
</template>

<script setup>
import { defineAsyncComponent, ref, watch } from 'vue';

const props = defineProps({
  active: { type: Boolean, required: true },
  loader: { type: Function, required: true }
});

// Load on first use, then keep the instance so close watchers and in-flight
// saves keep their existing lifecycle. The modal owns its visibility.
const requested = ref(false);
watch(() => props.active, (active) => {
  if (active) requested.value = true;
}, { immediate: true });

const Content = defineAsyncComponent({ loader: props.loader, suspensible: false });
</script>
