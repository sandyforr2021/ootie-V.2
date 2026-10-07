import { describe, expect, it } from 'vitest';
import { resolvePostTaggedItems } from '../ootdTaggedItems';

describe('canonical OOTD tagged item resolver', () => {
  it('matches public snapshots by item id rather than array position', () => {
    const resolved = resolvePostTaggedItems({
      item_ids: ['item-b', 'item-a'],
      wearing: [
        { id: 'item-a', name: '白色襯衫', photo: '/a.webp' },
        { id: 'item-b', name: '黑色長褲', photo: '/b.webp' }
      ]
    });
    expect(resolved.map((item) => item.name)).toEqual(['黑色長褲', '白色襯衫']);
    expect(resolved.map((item) => item.photo)).toEqual(['/b.webp', '/a.webp']);
  });

  it('prefers a readable canonical clothing row over its published snapshot', () => {
    const resolved = resolvePostTaggedItems({
      item_ids: ['item-a'],
      wearing: [{ id: 'item-a', name: '舊名稱', photo: '/old.webp' }]
    }, [{
      id: 'item-a', name_zh: '最新名稱', photo: '/new.webp', brand: 'COS',
      category: 'Tops', primary_color: '米白色'
    }]);
    expect(resolved[0]).toMatchObject({
      id: 'item-a', name: '最新名稱', photo: '/new.webp', brand: 'COS',
      category: 'Tops', primary_color: '米白色', removed: false
    });
  });

  it('does not attach a different snapshot to a missing canonical id', () => {
    const resolved = resolvePostTaggedItems({
      item_ids: ['item-missing'],
      wearing: [{ id: 'item-other', name: '錯誤單品', photo: '/wrong.webp' }]
    });
    expect(resolved[0]).toMatchObject({ id: 'item-missing', name: '已移除的衣物', photo: '', removed: true });
  });
});
