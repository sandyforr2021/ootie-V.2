import { publicClothingSource } from '../../shared/publicClothingSource.js';

const asId = (value) => String(value || '').trim();

export const resolvePostTaggedItems = (post, availableItems = []) => {
  const ids = Array.isArray(post?.item_ids) ? post.item_ids.map(asId).filter(Boolean) : [];
  const wearing = Array.isArray(post?.wearing) ? post.wearing : [];
  if (!ids.length) {
    return wearing.map((entry, index) => ({
      key: `legacy-${index}`,
      id: '',
      name: typeof entry === 'string' ? entry : entry?.name || '已移除的衣物',
      photo: typeof entry === 'object' ? entry?.photo || '' : '',
      brand: typeof entry === 'object' ? entry?.brand || '' : '',
      category: typeof entry === 'object' ? entry?.category || '' : '',
      primary_color: typeof entry === 'object' ? entry?.primary_color || '' : '',
      removed: false
    }));
  }

  const itemById = new Map(availableItems.map((item) => [asId(item?.id), item]));
  const snapshotById = new Map(
    wearing
      .filter((entry) => entry && typeof entry === 'object' && asId(entry.id))
      .map((entry) => [asId(entry.id), entry])
  );
  return [...new Set(ids)].map((id) => {
    const item = itemById.get(id);
    const snapshot = snapshotById.get(id);
    return {
      key: id,
      id,
      name: item?.name_zh || item?.name || snapshot?.name || '已移除的衣物',
      photo: item?.photo || snapshot?.photo || '',
      brand: item?.brand || snapshot?.brand || '',
      category: item?.category || snapshot?.category || '',
      primary_color: item?.primary_color || snapshot?.primary_color || '',
      can_try_on: Boolean(item?.photo_display_path || publicClothingSource(item?.photo, import.meta.env.VITE_SUPABASE_URL)),
      removed: !item && !snapshot
    };
  });
};
