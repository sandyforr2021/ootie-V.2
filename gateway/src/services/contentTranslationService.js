import { createHash } from 'node:crypto';
import { GatewayError } from '../errors.js';
import { normalizeContentLanguage, inferContentLanguage } from '../../../shared/contentLanguages.js';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const targets = new Set(['zh-TW', 'en', 'ja', 'es']);
// MyMemory's documented public GET API allows 500 UTF-8 bytes per segment.
const segments = text => {
  const result = []; let part = '';
  for (const char of text) {
    if (Buffer.byteLength(part + char, 'utf8') > 450) {
      const boundary = part.lastIndexOf(' ');
      if (boundary > 0) { result.push(part.slice(0, boundary + 1)); part = part.slice(boundary + 1); }
      else { result.push(part); part = ''; }
    }
    part += char;
    if (/[。！？.!?\n]/u.test(char) && Buffer.byteLength(part, 'utf8') > 160) { result.push(part); part = ''; }
  }
  if (part) result.push(part);
  return result;
};
const decodeEntities = text => String(text).replace(/&(?:amp|lt|gt|quot|apos|#39|#x[\da-f]+|#\d+);/gi, match => {
  const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
  if (named[match]) return named[match];
  const n = match.startsWith('&#x') ? parseInt(match.slice(3,-1),16) : parseInt(match.slice(2,-1),10);
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
});

export function createContentTranslationService({ supabase, fetchImpl = fetch }) {
  const pending = new Map();
  return {
    async translate(input) {
      const { kind = 'post', id, targetLanguage } = input || {};
      if (!['post', 'comment'].includes(kind) || !UUID.test(id || '') || !targets.has(targetLanguage)) throw new GatewayError('INVALID_TRANSLATION_REQUEST', 400);
      const table = kind === 'post' ? 'ootie_ootd_posts' : 'ootie_post_comments';
      const field = kind === 'post' ? 'caption' : 'body';
      const langField = kind === 'post' ? 'caption_language' : 'body_language';
      // Public credentials enforce the same read policies as the public post page.
      const response = await fetchImpl(`${supabase.url}/rest/v1/${table}?id=eq.${id}&select=${field},${langField}`, {
        headers: { apikey: supabase.publishableKey }, signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new GatewayError('TRANSLATION_UNAVAILABLE', 503);
      const [row] = await response.json();
      if (!row) throw new GatewayError('CONTENT_NOT_FOUND', 404);
      const original = String(row[field] || '');
      if (!original.trim() || original.length > 4000) throw new GatewayError('TRANSLATION_TEXT_LIMIT', 400);
      const source = normalizeContentLanguage(row[langField]) || inferContentLanguage(original) || normalizeContentLanguage(input.sourceLanguage);
      if (!source) throw new GatewayError('TRANSLATION_SOURCE_REQUIRED', 400);
      if (source === targetLanguage) return { text: original, sourceLanguage: source, targetLanguage, provider: 'original' };
      const sourceHash = createHash('sha256').update(source + '\n' + original).digest('hex');
      const key = `${kind}:${id}:${sourceHash}:${targetLanguage}`;
      const query = `/rest/v1/ootie_content_translations?kind=eq.${kind}&content_id=eq.${id}&source_hash=eq.${sourceHash}&target_language=eq.${targetLanguage}&select=translated_text,provider`;
      const [cached] = await supabase.serviceRequest(query);
      if (cached) return { text: cached.translated_text, sourceLanguage: source, targetLanguage, provider: cached.provider };
      if (pending.has(key)) return pending.get(key);
      if (pending.size >= 3) throw new GatewayError('TRANSLATION_BUSY', 429);
      const work = (async () => {
        const reserved = await supabase.serviceRequest('/rest/v1/rpc/ootie_reserve_translation_chars', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_chars: [...original].length })
        });
        if (!reserved) throw new GatewayError('TRANSLATION_DAILY_LIMIT', 429);
        const parts = segments(original), translated = new Array(parts.length);
        let next = 0;
        const translatePart = async index => {
          const segment = parts[index];
          const url = new URL('https://api.mymemory.translated.net/get');
          url.searchParams.set('q', segment); url.searchParams.set('langpair', `${source}|${targetLanguage}`);
          let result;
          try {
            const r = await fetchImpl(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
            if (!r.ok) {
              console.warn(JSON.stringify({ event: 'translation_provider_http', status: r.status }));
              throw new GatewayError(r.status === 429 ? 'TRANSLATION_BUSY' : 'TRANSLATION_UNAVAILABLE', r.status === 429 ? 429 : 503);
            }
            result = await r.json();
          } catch (error) {
            if (error instanceof GatewayError) throw error;
            console.warn(JSON.stringify({ event: 'translation_provider_network', code: error?.cause?.code || error?.name || 'unknown' }));
            throw new GatewayError('TRANSLATION_UNAVAILABLE', 503);
          }
          if (result.quotaFinished || Number(result.responseStatus) === 429) throw new GatewayError('TRANSLATION_DAILY_LIMIT', 429);
          const text = result.responseData?.translatedText;
          if (Number(result.responseStatus) !== 200 || typeof text !== 'string' || !text.trim()) {
            console.warn(JSON.stringify({ event: 'translation_provider_result', status: result.responseStatus, quotaFinished: !!result.quotaFinished }));
            throw new GatewayError('TRANSLATION_UNAVAILABLE', 503);
          }
          const prefix = segment.match(/^\s*/u)[0], suffix = segment.match(/\s*$/u)[0];
          translated[index] = prefix + decodeEntities(text).trim() + suffix;
        };
        // Bound vendor concurrency and the whole request to the browser timeout.
        const deadline = Date.now() + 45000;
        await Promise.all(Array.from({ length: Math.min(2, parts.length) }, async () => {
          while (next < parts.length) {
            if (Date.now() > deadline) throw new GatewayError('TRANSLATION_UNAVAILABLE', 503);
            await translatePart(next++);
          }
        }));
        const text = translated.join('');
        await supabase.serviceRequest('/rest/v1/ootie_content_translations?on_conflict=kind,content_id,source_hash,target_language', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify({ kind, content_id: id, source_hash: sourceHash, source_language: source, target_language: targetLanguage, translated_text: text, provider: 'MyMemory' })
        });
        return { text, sourceLanguage: source, targetLanguage, provider: 'MyMemory' };
      })().finally(() => pending.delete(key));
      pending.set(key, work);
      return work;
    }
  };
}
