import { colorHexValues, legacyColorNames } from '@/constants';
import { categoryFamily, colorHsl } from './commerce';

export const outfitOccasions = [
  { value: 'everyday', label: '日常' }, { value: 'work', label: '上班' },
  { value: 'date', label: '約會' }, { value: 'outdoors', label: '戶外散步' },
  { value: 'gathering', label: '聚會' }
];
const DAY = 86400000;
export function outfitDate(now = Date.now(), timezone) {
  try { return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone || undefined, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(now)); }
  catch { return new Intl.DateTimeFormat('sv-SE').format(new Date(now)); }
}
const hash = text => [...String(text)].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0);
const colorFallback = { Red:'#c63c4d', Pink:'#e6a7bc', Green:'#387d57', Lavender:'#b7a4d4', Yellow:'#f2d77b', Navy:'#253653', Orange:'#e58b4a', Mint:'#a2d8bf', Purple:'#653b83' };
function color(item) {
  return colorHsl(item.color_hex || colorHexValues[legacyColorNames[item.primary_color] || item.primary_color] || colorFallback[item.primary_color] || item.color);
}
export function outfitColorScore(a, b) {
  const x = color(a), y = color(b);
  if (!x || !y) return 0;
  const neutral = c => c.s < .18 || c.l < .18 || c.l > .86;
  if (neutral(x) || neutral(y)) return 3;
  const distance = Math.min(Math.abs(x.h - y.h), 360 - Math.abs(x.h - y.h));
  if (distance <= 45) return 3;
  if (distance >= 150) return 2;
  return 0;
}
function itemScore(item, weather, occasion, recent) {
  const temp = weather.apparent ?? weather.temperature;
  const text = `${item.category} ${item.style || ''} ${item.name || ''} ${item.name_zh || ''}`.toLowerCase();
  const season = String(item.season || '');
  let score = 0;
  if (temp < 18) {
    if (/shorts|sandals|短褲|涼鞋/.test(text)) score -= 14;
    if (/knit|wool|coat|boot|針織|羊毛|大衣|靴/.test(text)) score += 4;
    if (season === 'Spring / Summer') score -= 3;
  } else if (temp >= 28) {
    if (/wool|fleece|coat|羊毛|刷毛|大衣/.test(text)) score -= 14;
    if (/shorts|linen|tee|短褲|亞麻/.test(text)) score += 3;
    if (season === 'Autumn / Winter') score -= 4;
  }
  if ((weather.rain >= 40 || weather.weatherCode >= 51) && /sandal|suede|涼鞋|麂皮/.test(text)) score -= 8;
  const patterns = {
    work: /smart casual|shirt|trouser|loafer|blazer|襯衫|長褲|樂福|西裝/,
    date: /chic|dress|skirt|knit|洋裝|裙|針織/,
    outdoors: /casual|sneaker|pants|trouser|shorts|運動|休閒|褲/,
    gathering: /chic|dress|skirt|洋裝|裙/,
    everyday: /casual|tee|休閒/
  };
  if (patterns[occasion]?.test(text)) score += 8;
  if (occasion === 'work' && /shorts|sandal|短褲|涼鞋/.test(text)) score -= 6;
  return score - (recent.get(String(item.id)) || 0);
}

// Local, explainable ranking. OOTD tags are evidence of posting, not proof of wear.
// Day-based selection is stable on reload and rotates when the selected city's date changes.
export function recommendDailyOutfit({ items = [], posts = [], profileId, weather, occasion = 'everyday', date = outfitDate(), variant = 0 }) {
  if (!weather || !profileId) return [];
  const available = items.filter(item => item.owner_id === profileId && item.photo && item.hidden !== true && item.hidden !== 'true');
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
  const recent = new Map();
  for (const post of posts) {
    if (post.user_id !== profileId) continue;
    if (!post.created_at || !Number.isFinite(Date.parse(post.created_at))) continue;
    const age = day - Math.floor(Date.parse(`${outfitDate(post.created_at, weather.timezone)}T00:00:00Z`) / DAY);
    if (!Number.isFinite(age) || age < 0 || age > 13) continue;
    for (const id of new Set((post.item_ids || []).map(String))) recent.set(id, Math.min(16, (recent.get(id) || 0) + (age <= 2 ? 12 : age <= 6 ? 7 : 3)));
  }
  const score = item => itemScore(item, weather, occasion, recent);
  const compare = (a,b) => score(b)-score(a) || String(a.id).localeCompare(String(b.id));
  const group = family => available.filter(item => categoryFamily(item.category) === family).sort(compare).slice(0,12);
  const tops = group('upper_body'), bottoms = group('lower_body');
  let cores = tops.flatMap(top => bottoms.map(bottom => ({ pieces:[{...top,slot:'top'}, {...bottom,slot:'bottom'}], score:score(top)+score(bottom)+outfitColorScore(top,bottom) })));
  cores.push(...group('full_body').map(dress => ({pieces:[{...dress,slot:'dress'}],score:score(dress)*2+3})));
  if (!cores.length) cores = (tops.length ? tops : bottoms).map(item => ({pieces:[{...item,slot:tops.length?'top':'bottom'}],score:score(item)}));
  if (!cores.length) return [];
  const key = entry => entry.pieces.map(piece => piece.id).join(':');
  cores.sort((a,b) => b.score-a.score || key(a).localeCompare(key(b)));
  const candidates = cores.filter(entry => entry.score >= cores[0].score-6).slice(0,7);
  const chosen = candidates[(day + hash(profileId + occasion) + variant) % candidates.length];
  const result = [...chosen.pieces];
  const pick = (family, slot, filter = () => true) => {
    const options = group(family).filter(filter).filter(item => !result.some(chosen => chosen.id===item.id)).map(item => ({item,score:score(item)+result.reduce((sum,other)=>sum+outfitColorScore(item,other),0)/result.length}));
    options.sort((a,b)=>b.score-a.score || String(a.item.id).localeCompare(String(b.item.id)));
    const best = options.filter(entry => entry.score >= (options[0]?.score ?? 0)-2).slice(0,3);
    if (best.length) result.push({...best[(day+hash(slot+profileId)+variant) % best.length].item,slot});
  };
  pick('shoes','shoes');
  const layered = (weather.apparent ?? weather.temperature)<21 || (weather.max != null && weather.min != null && weather.max-weather.min>=8);
  if (layered && group('outer').length) pick('outer','outer');
  pick('accessory','accessory',item=>/bag|包/i.test(item.category));
  pick('accessory','accent',item=>!/bag|包/i.test(item.category));
  return result;
}
