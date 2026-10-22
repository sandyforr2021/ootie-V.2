import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from '../app';
import { useClosetStore } from '../closet';
import * as clothingRepo from '@/services/clothingRepository';
import * as clothingMediaRepo from '@/services/clothingMediaRepository';
import { ASYNC_STATUS, SYNC_STATUS } from '@/contracts/asyncState';
import { SERVICE_ERROR_CODE, ServiceError } from '@/services/serviceError';

describe('Closet Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('should filter items by category', () => {
    const closetStore = useClosetStore();
    expect(closetStore.filteredItems.length).toBeGreaterThan(0);

    closetStore.activeCategory = 'Tops';
    expect(closetStore.filteredItems.every((item) => item.category === 'Tops')).toBe(true);

    closetStore.activeCategory = 'Shoes';
    expect(closetStore.filteredItems.every((item) => item.category === 'Shoes')).toBe(true);
  });

  it('should filter items by search query and options', () => {
    const closetStore = useClosetStore();

    closetStore.searchQuery = '襯衫';
    expect(closetStore.filteredItems.length).toBeGreaterThan(0);
    expect(closetStore.filteredItems.every((i) => (i.name + i.name_zh).includes('襯衫'))).toBe(true);

    closetStore.clearFilters();
    closetStore.colorFilter = 'White';
    expect(closetStore.filteredItems.every((i) => i.primary_color === 'White')).toBe(true);
  });

  it('should toggle favorite status of an item', () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();

    const targetItem = appStore.items[0];
    const initialFavorite = targetItem.favorite;

    closetStore.toggleFavorite(targetItem.id);
    expect(targetItem.favorite).toBe(!initialFavorite);

    closetStore.toggleFavorite(targetItem.id);
    expect(targetItem.favorite).toBe(initialFavorite);
  });

  it('should add a new item to closet', () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();

    const initialCount = appStore.items.length;
    const newItem = {
      name: 'Silk Scarf',
      name_zh: '絲巾',
      category: 'Accessories',
      primary_color: 'Beige',
      style: 'Chic',
      season: 'Spring / Summer',
      photo: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3'
    };

    closetStore.addItem(newItem);

    expect(appStore.items.length).toBe(initialCount + 1);
    expect(appStore.items[0].name).toBe('Silk Scarf');
    expect(appStore.items[0].category).toBe('Accessories');
  });

  it('should update an existing item', () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();

    const targetId = appStore.items[0].id;
    closetStore.updateItem(targetId, { name_zh: '改名的襯衫', brand: 'Uniqlo U' });

    const updated = appStore.items.find((i) => i.id === targetId);
    expect(updated.name_zh).toBe('改名的襯衫');
    expect(updated.brand).toBe('Uniqlo U');
  });

  it('should prompt confirmation and delete item', () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();

    // Mock confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const initialCount = appStore.items.length;
    const targetId = appStore.items[0].id;

    closetStore.deleteItem(targetId);

    expect(appStore.items.length).toBe(initialCount - 1);
    expect(appStore.items.find((i) => i.id === targetId)).toBeUndefined();
  });

  describe('Remote Read and Local-Only Isolation', () => {
    const validProfileId = '12345678-1234-4234-8234-123456789abc';

    it('successfully loads remote items into appStore with SYNCED status', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();

      const mockRemoteItems = [
        {
          id: 'item-uuid-1',
          owner_id: validProfileId,
          name: 'Remote Jacket',
          name_zh: '遠端外套',
          category: 'Outerwear'
        }
      ];

      vi.spyOn(clothingRepo, 'getCurrentUserItems').mockResolvedValue(mockRemoteItems);

      const result = await closetStore.loadRemoteItems(validProfileId);
      expect(result.ok).toBe(true);
      expect(result.data).toEqual(mockRemoteItems);
      expect(appStore.items).toEqual(mockRemoteItems);
      expect(closetStore.remoteState.status).toBe(ASYNC_STATUS.SUCCESS);
      expect(closetStore.remoteState.syncStatus).toBe(SYNC_STATUS.SYNCED);
    });

    it('sets REMOTE_FAILED on error without silent fallback to success', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      const toastSpy = vi.spyOn(appStore, 'showToast');

      vi.spyOn(clothingRepo, 'getCurrentUserItems').mockRejectedValue(new Error('Network error'));

      const result = await closetStore.loadRemoteItems(validProfileId);
      expect(result.ok).toBe(false);
      expect(closetStore.remoteState.status).toBe(ASYNC_STATUS.ERROR);
      expect(closetStore.remoteState.syncStatus).toBe(SYNC_STATUS.REMOTE_FAILED);
      expect(toastSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ syncStatus: SYNC_STATUS.REMOTE_FAILED })
      );
    });

    it('addItem remains purely LOCAL_ONLY in BATCH-02', () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      const toastSpy = vi.spyOn(appStore, 'showToast');

      closetStore.addItem({ name: 'Local Scarf', category: 'Accessories' });
      expect(toastSpy).toHaveBeenCalledWith(
        '單品已保存在此裝置',
        expect.objectContaining({ syncStatus: SYNC_STATUS.LOCAL_ONLY })
      );
    });

    it('does not persist Favorite locally when the authoritative closet is remote', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      const remoteItems = [{
        id: '87654321-4321-4234-8234-123456789abc',
        owner_id: validProfileId,
        name: 'Remote shirt',
        category: 'Tops'
      }];
      vi.spyOn(clothingRepo, 'getCurrentUserItems').mockResolvedValue(remoteItems);
      const updateItem = vi.spyOn(clothingRepo, 'updateClothingItem').mockRejectedValue(
        new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED)
      );

      await closetStore.loadRemoteItems(validProfileId);
      const result = await closetStore.toggleFavorite(remoteItems[0].id);

      expect(result.ok).toBe(false);
      expect(appStore.items).toEqual(remoteItems);
      expect(updateItem).toHaveBeenCalledWith(validProfileId, remoteItems[0].id, { favorite: true });
    });
  });

  describe('Remote CRUD database-confirmed flow', () => {
    const validProfileId = '12345678-1234-4234-8234-123456789abc';
    const validItemId = '87654321-4321-4234-8234-123456789abc';
    const remoteItem = {
      id: validItemId,
      owner_id: validProfileId,
      name: 'Remote shirt',
      category: 'Tops'
    };

    const enterRemoteMode = async (closetStore) => {
      vi.spyOn(clothingRepo, 'getCurrentUserItems').mockResolvedValue([remoteItem]);
      await closetStore.loadRemoteItems(validProfileId);
    };

    it('adds a remote item only after the repository confirms the database row', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      const created = {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        owner_id: validProfileId,
        name: 'Confirmed jacket',
        category: 'Outerwear'
      };
      const createItem = vi.spyOn(clothingRepo, 'createClothingItem').mockResolvedValue(created);

      const result = await closetStore.addItem({
        name: 'Confirmed jacket',
        category: 'Outerwear',
        owner_id: '99999999-9999-4999-8999-999999999999'
      });

      expect(result.ok).toBe(true);
      expect(createItem).toHaveBeenCalledWith(validProfileId, expect.objectContaining({
        name: 'Confirmed jacket',
        owner_id: '99999999-9999-4999-8999-999999999999'
      }));
      expect(appStore.items).toEqual([created, remoteItem]);
    });

    it('keeps the remote closet unchanged when create fails', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      vi.spyOn(clothingRepo, 'createClothingItem').mockRejectedValue(
        new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED)
      );

      const result = await closetStore.addItem({ name: 'Ghost item', category: 'Tops' });

      expect(result.ok).toBe(false);
      expect(appStore.items).toEqual([remoteItem]);
    });

    it('removes staged Storage objects when the database save fails', async () => {
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      const uploaded = {
        originalPath: 'closet/user/item/op/original.jpg',
        displayPath: 'closet/user/item/op/display.webp',
        databaseFields: { photo_original_path: 'one', photo_display_path: 'two' }
      };
      vi.spyOn(clothingMediaRepo, 'uploadClothingMedia').mockResolvedValue(uploaded);
      const cleanup = vi.spyOn(clothingMediaRepo, 'cleanupUploadedClothingMedia').mockResolvedValue();
      vi.spyOn(clothingRepo, 'createClothingItem').mockRejectedValue(
        new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED)
      );

      const result = await closetStore.addItem({
        name: 'Safe staged shirt',
        category: 'Tops',
        __preparedMedia: { originalFile: new Blob(['original']), displayBlob: new Blob(['display']) }
      });

      expect(result.ok).toBe(false);
      expect(cleanup).toHaveBeenCalledWith(uploaded);
    });

    it('replaces a remote item only after an owner-scoped update succeeds', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      const updated = { ...remoteItem, name: 'Updated remote shirt' };
      const updateItem = vi.spyOn(clothingRepo, 'updateClothingItem').mockResolvedValue(updated);

      const result = await closetStore.updateItem(validItemId, { name: 'Updated remote shirt' });

      expect(result.ok).toBe(true);
      expect(updateItem).toHaveBeenCalledWith(validProfileId, validItemId, expect.objectContaining({ name: 'Updated remote shirt' }));
      expect(appStore.items).toEqual([updated]);
    });

    it('does not call remote update for an item owned by another profile', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      appStore.items = [{ ...remoteItem, owner_id: '99999999-9999-4999-8999-999999999999' }];
      const updateItem = vi.spyOn(clothingRepo, 'updateClothingItem');

      const result = await closetStore.updateItem(validItemId, { name: 'Should not update' });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SERVICE_ERROR_CODE.NOT_FOUND);
      expect(updateItem).not.toHaveBeenCalled();
    });

    it('keeps the original remote item when update fails', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      vi.spyOn(clothingRepo, 'updateClothingItem').mockRejectedValue(
        new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED)
      );

      const result = await closetStore.updateItem(validItemId, { name: 'Ghost update' });

      expect(result.ok).toBe(false);
      expect(appStore.items).toEqual([remoteItem]);
    });

    it('removes an item only after an owner-scoped delete succeeds', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const deleteItem = vi.spyOn(clothingRepo, 'deleteClothingItem').mockResolvedValue({ id: validItemId });

      const result = await closetStore.deleteItem(validItemId);

      expect(result.ok).toBe(true);
      expect(deleteItem).toHaveBeenCalledWith(validProfileId, validItemId);
      expect(appStore.items).toEqual([]);
    });

    it('keeps the original remote item when delete fails', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(clothingRepo, 'deleteClothingItem').mockRejectedValue(
        new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED)
      );

      const result = await closetStore.deleteItem(validItemId);

      expect(result.ok).toBe(false);
      expect(appStore.items).toEqual([remoteItem]);
    });

    it('persists clearance in the existing notes field after the database confirms it', async () => {
      const appStore = useAppStore();
      const closetStore = useClosetStore();
      await enterRemoteMode(closetStore);
      const updated = { ...remoteItem, notes: '[待出清]' };
      const updateItem = vi.spyOn(clothingRepo, 'updateClothingItem').mockResolvedValue(updated);

      const result = await closetStore.markItemForClearance(validItemId);

      expect(result.ok).toBe(true);
      expect(updateItem).toHaveBeenCalledWith(validProfileId, validItemId, { notes: '[待出清]' });
      expect(appStore.items).toEqual([updated]);
    });

    it('blocks mutations in BLOCKED mode without calling a repository mutation', async () => {
      const closetStore = useClosetStore();
      closetStore.setAwaitingProfile();
      const createItem = vi.spyOn(clothingRepo, 'createClothingItem');

      const result = await closetStore.addItem({ name: 'Blocked item', category: 'Tops' });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(SERVICE_ERROR_CODE.PROFILE_NOT_READY);
      expect(createItem).not.toHaveBeenCalled();
    });
  });
});
