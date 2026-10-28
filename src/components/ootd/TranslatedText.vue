<script setup>
import { computed, ref, watch } from 'vue';
import { locale, t } from '@/i18n';
import { CONTENT_LANGUAGES, languageNames, normalizeContentLanguage, inferContentLanguage } from '../../../shared/contentLanguages.js';
const props = defineProps({ contentId: { type: String, required: true }, kind: { type: String, default: 'post' }, text: { type: String, default: '' }, sourceLanguage: { type: String, default: null }, compact: Boolean, hideSourceSelector: Boolean, understated: Boolean, revealSourceOnTranslate: Boolean });
const source = ref('en'), translated = ref(''), showing = ref(false), busy = ref(false), error = ref(''), provider = ref('');
const requested = ref(false);
const inferred = computed(() => normalizeContentLanguage(props.sourceLanguage) || inferContentLanguage(props.text));
const canTranslate = computed(() => props.text.trim() && (inferred.value || source.value) !== locale.value);
const externalTranslationUrl = computed(() => `https://translate.google.com/?${new URLSearchParams({ sl: inferred.value || source.value, tl: locale.value, text: props.text, op: 'translate' })}`);
let version = 0;
watch([() => props.contentId, () => props.text, () => props.sourceLanguage, locale], () => {
  version++; source.value = inferred.value || 'en'; translated.value = ''; showing.value = false; busy.value = false; error.value = ''; provider.value = ''; requested.value = false;
}, { immediate: true });
async function toggle() {
  if (showing.value) { showing.value = false; requested.value = false; return; }
  requested.value = true;
  if (translated.value) { showing.value = true; return; }
  if (busy.value) return;
  const request = ++version; busy.value = true; error.value = '';
  try {
    const base = String(import.meta.env.VITE_OOTIE_AI_GATEWAY_URL || '/api').replace(/\/$/, '');
    const response = await fetch(`${base}/v1/translations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000), body: JSON.stringify({ kind: props.kind, id: props.contentId, targetLanguage: locale.value, sourceLanguage: inferred.value || source.value }) });
    const body = await response.json();
    if (request !== version) return;
    if (!response.ok) throw Object.assign(new Error(), { code: body.error?.code });
    if (typeof body.text !== 'string') throw Error();
    translated.value = body.text; showing.value = true; provider.value = body.provider;
  } catch (failure) {
    if (request === version) error.value = t(failure.code === 'TRANSLATION_DAILY_LIMIT' ? '今日翻譯額度已用完，原文仍可閱讀。' : '暫時無法翻譯，請稍後再試。');
  } finally { if (request === version) busy.value = false; }
}
function changeSource() { version++; translated.value = ''; showing.value = false; error.value = ''; busy.value = false; }
</script>
<template>
  <div class="translated-content" :class="{compact, understated}">
    <p class="content-copy" :lang="showing ? locale : (inferred || undefined)">{{ showing ? translated : text }}</p>
    <div class="translation-actions" @click.stop>
      <label v-if="!inferred && !hideSourceSelector && (!revealSourceOnTranslate || requested)" class="source-language">{{ $t('原文語言') }} <select v-model="source" @change="changeSource"><option v-for="code in CONTENT_LANGUAGES" :key="code" :value="code">{{ languageNames[code] }}</option></select></label>
      <button v-if="canTranslate" type="button" :disabled="busy" :aria-pressed="showing" :aria-expanded="revealSourceOnTranslate ? requested : undefined" @click.stop="toggle">{{ $t(busy ? '翻譯中…' : showing ? '顯示原文' : '翻譯') }}</button>
      <small v-if="showing && provider && provider !== 'original'">{{ $t('參考譯文') }} · {{ provider }}</small>
    </div>
    <p v-if="error" class="translation-error" role="status">{{ error }} <a :href="externalTranslationUrl" target="_blank" rel="noopener noreferrer" @click.stop>{{ $t('使用 Google 翻譯（新視窗）') }}</a></p>
  </div>
</template>
<style scoped>
.understated .translation-actions button{color:var(--muted);text-decoration:none}.understated .translation-actions button:hover{text-decoration:underline;color:var(--ink)}
.translated-content{min-width:0}.content-copy{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;margin:10px 0;font-size:15px;color:var(--ink)}.translation-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:6px 0 12px}.translation-actions button{border:0;background:none;padding:4px 0;color:var(--accent);font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}.translation-actions small,.source-language{font-size:11px;color:var(--muted)}.source-language select{max-width:112px;font:inherit;padding:3px;background:var(--paper);border:1px solid var(--line);border-radius:5px;color:var(--ink)}.translation-error{font-size:12px;line-height:1.5;color:var(--muted)}.compact .content-copy{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;margin:6px 0}.compact .translation-actions{gap:5px}
</style>
