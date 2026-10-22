import { locale } from '@/i18n';

export function itemName(item) {
  if (!item) return '';
  return locale.value === 'zh-TW' ? item.name_zh || item.name || '' : item.name || item.name_zh || '';
}
