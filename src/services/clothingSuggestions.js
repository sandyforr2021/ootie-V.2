// File names are optional hints, not a vision model. Ambiguous names are never
// used as a classification, and camera-generated names are not useful titles.
const types = [
  ['Bottoms', /(?:\b(?:jeans|pants|trousers|shorts|skirt)\b|牛仔褲|長褲|短褲|褲子|裙子|スカート|パンツ)/i],
  ['Tops', /(?:\b(?:shirt|blouse|sweater|jumper|tee|top)\b|襯衫|毛衣|上衣|シャツ|ブラウス)/i],
  ['Dress', /(?:\b(?:dress|jumpsuit)\b|洋裝|連身裙|ワンピース)/i],
  ['Outerwear', /(?:\b(?:coat|jacket|blazer)\b|外套|大衣|コート|ジャケット)/i],
  ['Shoes', /(?:\b(?:shoes|boots|sneakers|loafers)\b|鞋子|皮鞋|靴子|靴)/i],
  ['Bags', /(?:\b(?:bag|handbag|tote)\b|包包|手提包|バッグ)/i],
  ['Accessories', /(?:\b(?:hat|scarf|belt|cap)\b|帽子|圍巾|皮帶|帽子)/i]
];

export function suggestFromClothingFilename(filename) {
  const name = String(filename || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const matches = types.filter(([, pattern]) => pattern.test(name));
  if (matches.length !== 1) return null;
  return { name: name.slice(0, 100), category: matches[0][0] };
}
