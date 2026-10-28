<script setup>
import { LANGUAGES, locale, setLocale, t } from '@/i18n';
import { useRoute, useRouter } from 'vue-router';
const router = useRouter(); const route = useRoute();
function change(event) {
  const code = event.target.value;
  if (setLocale(code)) router.replace({ path: route.path, query: { ...route.query, lang: code }, hash: route.hash });
}
</script>
<template>
  <label class="language-select"><span aria-hidden="true">◎</span><span class="language-label">{{ t('語言') }}</span><select :value="locale" :aria-label="t('語言')" @change="change"><option v-for="language in LANGUAGES" :key="language.code" :value="language.code" :lang="language.code">{{ language.label }}</option></select></label>
</template>
<style scoped>
.language-select{display:flex;align-items:center;gap:8px;flex-shrink:0;color:var(--ink,#35312e)}.language-select select{font:inherit;font-size:12px;background:var(--surface,#fffaf3);color:inherit;border:1px solid var(--line,#e7ded4);border-radius:10px;min-height:40px;padding:7px 10px;max-width:125px}.language-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.language-select select:focus-visible{outline:3px solid #6d8d9c;outline-offset:2px}
</style>
