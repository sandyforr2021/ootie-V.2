import { describe, expect, it } from 'vitest';
import {
  getOwnedTryOnItemIds,
  isTryOnItemId,
  reconcileTryOnSelection
} from '../tryOnSelection';

const profileId = '22222222-2222-4222-8222-222222222222';
const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherProfileId = '33333333-3333-4333-8333-333333333333';
const remoteItems = [
  { id: firstId, owner_id: profileId },
  { id: secondId, owner_id: profileId },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', owner_id: otherProfileId }
];

describe('Try-on clothing selection integrity', () => {
  it('rejects local placeholder IDs before a paid request can be enabled', () => {
    expect(isTryOnItemId('1')).toBe(false);
    expect(getOwnedTryOnItemIds([{ id: '1', owner_id: profileId }], profileId)).toEqual([]);
  });

  it('replaces a stale local selection after the authenticated closet loads', () => {
    expect(reconcileTryOnSelection({
      currentIds: ['1'],
      items: remoteItems,
      profileId,
      mode: 'single'
    })).toEqual([firstId]);
  });

  it('keeps valid owner-scoped selections and excludes cross-user items', () => {
    expect(reconcileTryOnSelection({
      currentIds: [secondId, remoteItems[2].id, firstId],
      items: remoteItems,
      profileId,
      mode: 'outfit'
    })).toEqual([secondId, firstId]);
  });

  it('applies a valid route selection only after it exists remotely', () => {
    expect(reconcileTryOnSelection({
      currentIds: ['1'],
      requestedIds: [secondId],
      items: remoteItems,
      profileId,
      mode: 'single'
    })).toEqual([secondId]);
  });

  it('keeps one item for VTO and caps outfit preview at five owned items', () => {
    const extraOwned = Array.from({ length: 5 }, (_, index) => ({
      id: `${index + 1}${String(index + 1).repeat(7)}-${String(index + 1).repeat(4)}-4${String(index + 1).repeat(3)}-8${String(index + 1).repeat(3)}-${String(index + 1).repeat(12)}`,
      owner_id: profileId
    }));
    const items = [...remoteItems.slice(0, 2), ...extraOwned];
    const ids = items.map((item) => item.id);

    expect(reconcileTryOnSelection({ currentIds: ids, items, profileId, mode: 'single' })).toEqual([firstId]);
    expect(reconcileTryOnSelection({ currentIds: ids, items, profileId, mode: 'outfit' })).toHaveLength(5);
  });
});
