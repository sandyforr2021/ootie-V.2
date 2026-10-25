import { categoryFamily } from './commerce';

export function tryOnCategory(category) {
  const family = categoryFamily(category);
  return family === 'outer' ? 'upper_body' : ['upper_body','lower_body','full_body','shoes'].includes(family) ? family : null;
}

// Convert an already-readable wardrobe image (including WebP) to a bounded JPEG.
// The caller resolves permissions first; the gateway still owns the new product.
export async function garmentImageData(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Garment image unavailable');
  const blob = await response.blob();
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type) || blob.size > 20 * 1024 * 1024) throw new Error('Unsupported garment image');
  const bitmap = await createImageBitmap(blob);
  try {
    if (Math.min(bitmap.width, bitmap.height) < 256) throw new Error('Garment image too small');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.9);
  } finally { bitmap.close(); }
}

export function filenameGarmentCategory(filename) {
  const text = String(filename || '').replace(/\.[^.]+$/, '').toLowerCase();
  const matches = [
    ['Dress',/dress|洋裝|連身/], ['Outerwear',/jacket|coat|外套|風衣/],
    ['Bottoms',/pants|jeans|trouser|shorts|skirt|褲|裙/],
    ['Shoes',/shoe|sneaker|boot|鞋/], ['Bags',/bag|背包|手袋|包包/],
    ['Tops',/shirt|top|knit|sweater|上衣|襯衫|針織/]
  ];
  return matches.find(([,pattern]) => pattern.test(text))?.[0] || null;
}
export function suggestedGarmentName(category, color) {
  const label = {Tops:'上衣',Bottoms:'下身',Dress:'洋裝',Outerwear:'外套',Shoes:'鞋履',Bags:'包款',Accessories:'配件'}[category] || '單品';
  return `${color || ''}${label}`;
}
