// A combined outfit is deliberately limited to the three layers reviewed by
// the owner. Single garment requests retain the provider's existing categories.
export function outfitLayer(item = {}) {
  if (item.outfit_layer) return item.outfit_layer;
  const category = String(item.category || '').trim().toLowerCase();
  if (['outer', 'outerwear', 'jacket', 'jackets', 'coat', 'coats', '外套'].includes(category)) return 'outer';
  if (['upper_body', 'tops', 'top', 'shirt', 'shirts', 't-shirt', 't-shirts', 'blouse', 'blouses', 'knitwear', 'sweater', 'sweaters', '上衣', '上身', '襯衫', '針織'].includes(category)) return 'top';
  if (['lower_body', 'bottoms', 'bottom', 'pants', 'trouser', 'trousers', 'jeans', 'skirt', 'skirts', 'short', 'shorts', '下身', '褲子', '長褲', '短褲', '裙子', '短裙', '長裙'].includes(category)) return 'bottom';
  return 'single';
}

export function orderedOutfit(items) {
  if (!items.length || items.length > 3) return { valid: false, items: [], reason: 'count' };
  if (items.length === 1) return { valid: true, items: [...items] };
  const layers = items.map(outfitLayer);
  const order = { top: 0, bottom: 1, outer: 2 };
  if (layers.some(layer => !(layer in order)) || new Set(layers).size !== layers.length) {
    return { valid: false, items: [], reason: 'layers' };
  }
  return { valid: true, items: [...items].sort((a, b) => order[outfitLayer(a)] - order[outfitLayer(b)]) };
}
