import { locale } from '@/i18n';
import catalogCutouts from '@/data/catalogCutouts.json';
import {curatedWardrobePhoto} from './curatedWardrobeMedia';

export function itemName(item) {
  if (!item) return '';
  return locale.value === 'zh-TW' ? item.name_zh || item.name || item.title || '' : item.name || item.name_zh || item.title || '';
}

// Correct only the original seeded merchant close-up. User replacement photos
// have different storage paths and must keep their own pixels.
export function itemPhoto(item) {
  const curated=curatedWardrobePhoto(item);
  if(curated)return curated;
  const prepared = catalogCutouts[item?.source_url];
  if (prepared && /\/merchant-v[23]\/display\.(jpeg|jpg|png|webp)$/.test(item.photo_display_path || '')) return prepared;
  if (item?.source_url === 'https://colorfulstandard.com/products/linen-oversized-shirt-bubblegum-pink-female'
    && /\/merchant-v3\/display\.(jpeg|jpg)$/.test(item.photo_display_path || '')) {
    return '/catalog/linen-shirt-bubblegum-pink.jpg';
  }
  if (item?.source_url === 'https://colorfulstandard.com/products/sunglass-17-sunglasses-deep-black-solid-lavender'
    && /\/merchant-v3\/display\.(jpeg|jpg)$/.test(item.photo_display_path || '')) {
    return '/catalog/sunglass-17-lavender.jpg';
  }
  return item?.photo || '';
}
