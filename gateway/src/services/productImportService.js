import dns from 'node:dns/promises';
import net from 'node:net';
import { GatewayError } from '../errors.js';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const decodeHtml = (value = '') => String(value)
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();

const textMeta = (html, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
};

const findProduct = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findProduct(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.some((type) => String(type).toLowerCase() === 'product')) return value;
  return findProduct(value['@graph']);
};

const firstImage = (value) => Array.isArray(value) ? value[0] : (typeof value === 'object' ? value?.url : value);
const brandName = (value) => typeof value === 'object' ? (value?.name || '') : (value || '');

export function parseProductHtml(html, sourceUrl) {
  let product = null;
  const scripts = String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      product = findProduct(JSON.parse(match[1].trim()));
      if (product) break;
    } catch { /* malformed JSON-LD falls through to metadata */ }
  }

  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const title = decodeHtml(product?.name || textMeta(html, 'og:title') || textMeta(html, 'twitter:title')
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const image = decodeHtml(firstImage(product?.image) || textMeta(html, 'og:image') || textMeta(html, 'twitter:image') || '');
  const brand = decodeHtml(brandName(product?.brand) || textMeta(html, 'product:brand') || textMeta(html, 'og:site_name') || '');
  const rawPrice = offers?.price || offers?.lowPrice || textMeta(html, 'product:price:amount') || '';
  const currency = String(offers?.priceCurrency || textMeta(html, 'product:price:currency') || '').toUpperCase();
  const source = new URL(sourceUrl);
  return {
    title,
    brand,
    image,
    sourceUrl: source.href,
    sourceDomain: source.hostname.replace(/^www\./i, ''),
    price: rawPrice === '' ? '' : String(rawPrice).replace(/[^0-9.]/g, ''),
    currency,
    parser: product ? 'json-ld' : (textMeta(html, 'og:title') ? 'opengraph' : 'metadata'),
    needsManualInput: !title || !image
  };
}

const isPrivateIp = (address) => {
  if (!address) return true;
  const normalized = String(address).toLowerCase();
  if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7));
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168)) || a >= 224;
  }
  return false;
};

export class ProductImportService {
  constructor({ fetchImpl = fetch, lookup = dns.lookup } = {}) {
    this.fetchImpl = fetchImpl;
    this.lookup = lookup;
  }

  async assertSafeUrl(rawUrl) {
    let url;
    try { url = new URL(String(rawUrl || '').trim()); } catch { throw new GatewayError('INVALID_PRODUCT_URL', 400, '請輸入有效的商品網址。'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new GatewayError('INVALID_PRODUCT_URL', 400, '只接受一般 HTTP 或 HTTPS 商品網址。');
    }
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new GatewayError('PRODUCT_URL_BLOCKED', 400, '不接受內部網路網址。');
    const addresses = await this.lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
      throw new GatewayError('PRODUCT_URL_BLOCKED', 400, '不接受內部網路網址。');
    }
    return url;
  }

  async preview(rawUrl) {
    let url = await this.assertSafeUrl(rawUrl);
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let response;
      try {
        response = await this.fetchImpl(url, {
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': 'OOTIE-Product-Preview/1.0', Accept: 'text/html,application/xhtml+xml' }
        });
      } catch (error) {
        throw new GatewayError('PRODUCT_FETCH_FAILED', 422, error?.name === 'AbortError' ? '商品頁讀取逾時。' : '無法讀取商品頁。');
      } finally { clearTimeout(timeout); }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount === MAX_REDIRECTS) throw new GatewayError('PRODUCT_REDIRECT_LIMIT', 422, '商品頁重新導向次數過多。');
        const location = response.headers.get('location');
        if (!location) throw new GatewayError('PRODUCT_FETCH_FAILED', 422, '商品頁重新導向不完整。');
        url = await this.assertSafeUrl(new URL(location, url).href);
        continue;
      }
      if (!response.ok) throw new GatewayError('PRODUCT_FETCH_FAILED', 422, `商品頁回應 HTTP ${response.status}。`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('text/html')) throw new GatewayError('PRODUCT_CONTENT_UNSUPPORTED', 422, '網址不是可解析的商品頁。');
      const length = Number(response.headers.get('content-length') || 0);
      if (length > MAX_HTML_BYTES) throw new GatewayError('PRODUCT_PAGE_TOO_LARGE', 413, '商品頁內容過大。');
      const html = await response.text();
      if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw new GatewayError('PRODUCT_PAGE_TOO_LARGE', 413, '商品頁內容過大。');
      return parseProductHtml(html, url.href);
    }
    throw new GatewayError('PRODUCT_FETCH_FAILED', 422, '無法讀取商品頁。');
  }
}
