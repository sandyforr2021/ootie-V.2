import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePostTaggedItems } from '../ootdTaggedItems';

describe('canonical OOTD tagged item resolver', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('enables published older images only from a readable canonical row', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    const source = { id: 'shirt', photo: 'https://project.supabase.co/storage/v1/object/public/ootie-ootd-images/ootd/shirt.webp' };
    const post = { item_ids: ['shirt'], wearing: [source] };
    expect(resolvePostTaggedItems(post, [source])[0].can_try_on).toBe(true);
    expect(resolvePostTaggedItems(post)[0].can_try_on).toBe(false);
    expect(resolvePostTaggedItems(post, [{ ...source, photo: 'https://other.example/shirt.webp' }])[0].can_try_on).toBe(false);
  });
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
