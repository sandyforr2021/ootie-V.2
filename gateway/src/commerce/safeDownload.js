import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { GatewayError } from '../errors.js';

export function isPublicAddress(address) {
  // Only globally routable IPv4 is accepted. This also rejects IPv4-mapped IPv6.
  if (net.isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113));
}

export function publicHttpUrl(value, { optional = false } = {}) {
  if (optional && !value) return '';
  let url;
  try { url = new URL(String(value)); } catch { throw new GatewayError('INVALID_PRODUCT_URL', 400, '請輸入完整的商品網址。'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
    || (url.port && !['80', '443'].includes(url.port)) || url.href.length > 4096) {
    throw new GatewayError('INVALID_PRODUCT_URL', 400, '僅支援一般 HTTP／HTTPS 網址。');
  }
  return url.href;
}

export async function safeDownload(value, { maxBytes = 8 * 1024 * 1024, timeoutMs = 15000, lookup = dns.lookup, redirects = 3 } = {}) {
  const url = new URL(publicHttpUrl(value));
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new GatewayError('PRODUCT_URL_BLOCKED', 400, '無法使用內部或特殊網路位址。');
  }
  // Pin the validated address at connection time; a second DNS lookup could rebind it.
  const pinned = addresses[0];
  const result = await new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      lookup: (_host, options, callback) => options.all ? callback(null, [pinned]) : callback(null, pinned.address, 4),
      headers: { Accept: 'image/jpeg,image/png,image/webp,text/html', 'User-Agent': 'OOTIE/2.0' }
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (!response.headers.location) { reject(new GatewayError('REMOTE_IMAGE_UNAVAILABLE', 422)); return; }
        resolve({ redirect: response.headers.location });
        return;
      }
      if (response.statusCode !== 200 || Number(response.headers['content-length']) > maxBytes) {
        response.destroy();
        reject(new GatewayError('REMOTE_IMAGE_UNAVAILABLE', 422, '無法讀取圖片，請改用上傳。'));
        return;
      }
      const chunks = [];
      let length = 0;
      response.on('data', (chunk) => {
        length += chunk.length;
        if (length > maxBytes) response.destroy(new GatewayError('IMAGE_TOO_LARGE', 413, '圖片或網頁過大。'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({ buffer: Buffer.concat(chunks), mimeType: String(response.headers['content-type'] || '').split(';')[0], url: url.href }));
      response.on('error', reject);
    });
    const timer = setTimeout(() => request.destroy(new GatewayError('REMOTE_TIMEOUT', 422, '讀取逾時，請改用上傳。')), timeoutMs);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
  if (result.redirect) {
    if (redirects <= 0) throw new GatewayError('REDIRECT_LIMIT', 422, '重新導向過多。');
    return safeDownload(new URL(result.redirect, url).href, { maxBytes, timeoutMs, lookup, redirects: redirects - 1 });
  }
  return result;
}
