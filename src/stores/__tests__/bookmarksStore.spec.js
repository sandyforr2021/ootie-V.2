import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBookmarksStore } from '../bookmarks';
import { BOOKMARKS_STORAGE_KEY, defaultBookmarks } from '@/constants';

describe('Bookmarks Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('starts with no bookmarks until the user saves one', () => {
    const store = useBookmarksStore();
    expect(store.bookmarks).toEqual([]);
  });

  it('should add a new bookmark and persist to localStorage', async () => {
    const store = useBookmarksStore();
    const initialCount = store.bookmarks.length;

    const newBookmark = await store.addBookmark({
      title: 'Silk Slip Dress',
      product_url: 'https://example.com/dress',
      price: '2800',
      currency: 'TWD',
      brand: 'Zara',
      color: 'Black',
      size: 'S'
    });

    expect(store.bookmarks.length).toBe(initialCount + 1);
    expect(store.bookmarks[0].title).toBe('Silk Slip Dress');
    expect(store.bookmarks[0].price).toBe('2800');
    expect(store.lastMutationSyncStatus).toBe('LOCAL_ONLY');

    const saved = JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY));
    expect(saved).toBeTruthy();
    expect(saved.some((b) => b.title === 'Silk Slip Dress')).toBe(true);
  });

  it('should update an existing bookmark', async () => {
    const store = useBookmarksStore();
    store.bookmarks = JSON.parse(JSON.stringify(defaultBookmarks));
    const targetId = store.bookmarks[0].id;

    await store.updateBookmark(targetId, {
      title: 'Updated Cardigan Title',
      price: '4500',
      currency: 'TWD',
      notes: 'New note'
    });

    const updated = store.bookmarks.find((b) => b.id === targetId);
    expect(updated.title).toBe('Updated Cardigan Title');
    expect(updated.price).toBe('4500');
    expect(updated.notes).toBe('New note');
  });

  it('should delete a bookmark', async () => {
    const store = useBookmarksStore();
    store.bookmarks = JSON.parse(JSON.stringify(defaultBookmarks));
    const initialCount = store.bookmarks.length;
    const targetId = store.bookmarks[0].id;

    await store.deleteBookmark(targetId);

    expect(store.bookmarks.length).toBe(initialCount - 1);
    expect(store.bookmarks.some((b) => b.id === targetId)).toBe(false);
  });

  it('should batch delete selected bookmarks', async () => {
    const store = useBookmarksStore();
    store.bookmarks = JSON.parse(JSON.stringify(defaultBookmarks));
    const initialCount = store.bookmarks.length;
    const idsToDelete = [store.bookmarks[0].id, store.bookmarks[1].id];

    store.selectedBookmarkIds = [...idsToDelete];
    const deletedCount = await store.deleteSelectedBookmarks();

    expect(deletedCount).toBe(2);
    expect(store.bookmarks.length).toBe(initialCount - 2);
    expect(store.selectedBookmarkIds.length).toBe(0);
    expect(store.isManagerMode).toBe(false);
  });

  it('should detect duplicate bookmarks with matching url, variant, color, and size', () => {
    const store = useBookmarksStore();
    store.bookmarks = JSON.parse(JSON.stringify(defaultBookmarks));
    const first = store.bookmarks[0];

    const duplicate = store.findDuplicateBookmark(
      first.product_url,
      first.variant_name,
      first.color,
      first.size
    );

    expect(duplicate).toBeTruthy();
    expect(duplicate.id).toBe(first.id);

    // Should return null if excluded by same ID
    const excluded = store.findDuplicateBookmark(
      first.product_url,
      first.variant_name,
      first.color,
      first.size,
      first.id
    );
    expect(excluded).toBeFalsy();
  });
});
