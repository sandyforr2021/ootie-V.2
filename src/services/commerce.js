import { AiGatewayError } from './aiGateway';
import { colorHexValues } from '@/constants';

export function createCommerceClient({ baseUrl = import.meta.env.VITE_OOTIE_AI_GATEWAY_URL, fetchImpl = fetch } = {}) {
  const request = async (path, token, body, options = {}) => {
    if (!baseUrl) throw new AiGatewayError('GATEWAY_NOT_CONFIGURED', '購物服務尚未連線，請稍後再試。');
    let response;
    try {
      response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/v1/shop/${path}`, {
        method: options.method || (body ? 'POST' : 'GET'), signal: AbortSignal.timeout(30000),
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    } catch { throw new AiGatewayError('NETWORK_UNCERTAIN', '連線中斷。重新確認工作列表後，可用同一提交編號重試。'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new AiGatewayError(data?.error?.code || 'COMMERCE_UNAVAILABLE', data?.error?.message || '暫時無法完成，請稍後再試。', response.status);
    return data;
  };
  return { request };
}
export const commerceClient = createCommerceClient();

export function safeCommerceUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}

export function colorHsl(hex) {
  const hsl = /^hsl\(\s*(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i.exec(hex || '');
  if (hsl) return { h: ((Number(hsl[1]) % 360) + 360) % 360, s: Number(hsl[2]) / 100, l: Number(hsl[3]) / 100 };
  if (!/^#[\da-f]{6}$/i.test(hex || '')) return null;
  const rgb = [1,3,5].map((i) => parseInt(hex.slice(i,i+2),16)/255);
  const [r,g,b] = rgb; const max = Math.max(...rgb); const min = Math.min(...rgb); const d = max-min;
  let hue = d === 0 ? 0 : max === r ? ((g-b)/d)%6 : max === g ? (b-r)/d+2 : (r-g)/d+4;
  hue = (hue*60+360)%360;
  const lightness = (max+min)/2;
  return { h: hue, s: d === 0 ? 0 : d/(1-Math.abs(2*lightness-1)), l: lightness };
}
export function categoryFamily(value) {
  const text = String(value || '').toLowerCase();
  if (/full|dress|洋裝|連身/.test(text)) return 'full_body';
  if (/upper|top|shirt|knit|sweater|上衣|襯衫|針織/.test(text)) return 'upper_body';
  if (/lower|bottom|pants|trouser|jeans|shorts|skirt|褲|裙/.test(text)) return 'lower_body';
  if (/shoe|sneaker|loafer|boot|sandal|鞋/.test(text)) return 'shoes';
  if (/outer|jacket|coat|外套/.test(text)) return 'outer';
  return 'accessory';
}

export function wardrobeMatches(product, items, profileId, { palette = [] } = {}) {
  const main = colorHsl(product.color);
  const inspirationColors = palette.map((entry) => colorHsl(entry.color)).filter(Boolean);
  return items.filter((item) => item.owner_id === profileId && !item.hidden && item.id !== product.closet_item_id)
    .filter((item) => {
      const family = categoryFamily(item.category);
      return family !== product.category && !(product.category === 'full_body' && ['upper_body','lower_body'].includes(family));
    }).map((item) => {
      const color = colorHsl(item.color_hex || colorHexValues[item.primary_color] || item.primary_color || item.color);
      const neutral = !!color && (color.s < .17 || color.l < .16 || color.l > .88);
      const distance = main && color ? Math.min(Math.abs(main.h-color.h),360-Math.abs(main.h-color.h)) : null;
      const similar = distance !== null && distance < 40;
      const contrast = distance !== null && distance > 140;
      const personal = !!color && inspirationColors.some((suggestion) => {
        const hueDistance = Math.min(Math.abs(suggestion.h - color.h), 360 - Math.abs(suggestion.h - color.h));
        return hueDistance < 35 && Math.abs(suggestion.l - color.l) < 0.28;
      });
      return { item, score: personal ? 4 : neutral ? 3 : similar || contrast ? 2 : 1, reason: personal ? 'personal' : neutral ? 'neutral' : similar ? 'tonal' : contrast ? 'contrast' : 'category' };
    }).sort((a,b) => b.score-a.score || String(a.item.id).localeCompare(String(b.item.id))).slice(0,3);
}

export function personalPalette(colors) {
  const skin = colorHsl(colors?.skin_color);
  if (!skin) return [];
  // Aesthetic options based on measured colors, not a seasonal/medical classification.
  return [
    { key:'soft', color:`hsl(${Math.round(skin.h)} 25% 78%)` },
    { key:'contrast', color:`hsl(${Math.round((skin.h+180)%360)} 35% 40%)` },
    { key:'neutral', color: colors.hair_color || '#534c46' }
  ];
}
