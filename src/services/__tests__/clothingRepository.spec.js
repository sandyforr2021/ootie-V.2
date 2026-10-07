import { describe, expect, it, vi } from 'vitest';
import {
  getCurrentUserItems,
  fetchClothingItems,
  getItemById,
  createClothingItem,
  updateClothingItem,
  deleteClothingItem,
  getPublicItemsByIds
} from '../clothingRepository';
import { ServiceError, SERVICE_ERROR_CODE } from '../serviceError';

describe('clothingRepository (READ-ONLY)', () => {
  const mockProfileId = '33333333-3333-4333-8333-333333333333';
  const mockItemId = '44444444-4444-4444-8444-444444444444';

  describe('getCurrentUserItems', () => {
    it('throws VALIDATION_ERROR when profileId is invalid', async () => {
      await expect(getCurrentUserItems('not-a-uuid')).rejects.toThrowError(ServiceError);
      await expect(getCurrentUserItems('not-a-uuid')).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.VALIDATION_ERROR
      });
    });

    it('rejects mock identity profile-01', async () => {
      await expect(getCurrentUserItems('profile-01')).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.VALIDATION_ERROR
      });
    });

    it('queries ootie_clothing_items where owner_id = profileId sorted by created_at desc', async () => {
      const mockItems = [{ id: mockItemId, name: 'White Tee', owner_id: mockProfileId }];
      const orderFn = vi.fn().mockResolvedValue({ data: mockItems, error: null });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      const fromFn = vi.fn().mockReturnValue({ select: selectFn });
      const mockClient = { from: fromFn };

      const result = await getCurrentUserItems(mockProfileId, mockClient);
      expect(result).toEqual(mockItems);
      expect(fromFn).toHaveBeenCalledWith('ootie_clothing_items');
      expect(fromFn).not.toHaveBeenCalledWith('items');
      expect(fromFn).not.toHaveBeenCalledWith('profiles');
      expect(selectFn).toHaveBeenCalledWith('*');
      expect(eqFn).toHaveBeenCalledWith('owner_id', mockProfileId);
      expect(orderFn).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns empty array when no items exist', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      };

      const result = await getCurrentUserItems(mockProfileId, mockClient);
      expect(result).toEqual([]);
    });

    it('normalizes Supabase errors', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'permission denied', status: 403 }
              })
            })
          })
        })
      };

      await expect(getCurrentUserItems(mockProfileId, mockClient)).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.PERMISSION_DENIED
      });
    });

    it('fetchClothingItems alias calls getCurrentUserItems', async () => {
      expect(fetchClothingItems).toBe(getCurrentUserItems);
    });
  });

  describe('getItemById', () => {
    it('throws VALIDATION_ERROR when itemId is not a UUID', async () => {
      await expect(getItemById('invalid-id')).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.VALIDATION_ERROR
      });
    });

    it('queries ootie_clothing_items by id', async () => {
      const mockItem = { id: mockItemId, name: 'Blue Jeans', owner_id: mockProfileId };
      const maybeSingleFn = vi.fn().mockResolvedValue({ data: mockItem, error: null });
      const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      const fromFn = vi.fn().mockReturnValue({ select: selectFn });
      const mockClient = { from: fromFn };

      const result = await getItemById(mockItemId, mockClient);
      expect(result).toEqual(mockItem);
      expect(fromFn).toHaveBeenCalledWith('ootie_clothing_items');
      expect(fromFn).not.toHaveBeenCalledWith('items');
      expect(eqFn).toHaveBeenCalledWith('id', mockItemId);
    });

    it('returns null when item is not found', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      };

      const result = await getItemById(mockItemId, mockClient);
      expect(result).toBeNull();
    });

    it('normalizes and propagates errors', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Failed to fetch', name: 'TypeError' }
              })
            })
          })
        })
      };

      await expect(getItemById(mockItemId, mockClient)).rejects.toMatchObject({
        code: SERVICE_ERROR_CODE.NETWORK_ERROR
      });
    });
  });

  describe('getPublicItemsByIds', () => {
    it('queries only valid unique IDs and relies on RLS for readable rows', async () => {
      const inFn = vi.fn().mockResolvedValue({ data: [{ id: mockItemId, photo: '/item.webp' }], error: null });
      const selectFn = vi.fn().mockReturnValue({ in: inFn });
      const fromFn = vi.fn().mockReturnValue({ select: selectFn });
      const result = await getPublicItemsByIds([mockItemId, mockItemId, 'invalid'], { from: fromFn });
      expect(result).toHaveLength(1);
      expect(fromFn).toHaveBeenCalledWith('ootie_clothing_items');
      expect(inFn).toHaveBeenCalledWith('id', [mockItemId]);
    });
  });

  describe('remote CRUD ownership boundaries', () => {
    it('creates an item with the verified profile id and discards a forged owner_id', async () => {
      const createdItem = { id: mockItemId, owner_id: mockProfileId, name: 'Verified shirt' };
      const singleFn = vi.fn().mockResolvedValue({ data: createdItem, error: null });
      const selectFn = vi.fn().mockReturnValue({ single: singleFn });
      const insertFn = vi.fn().mockReturnValue({ select: selectFn });
      const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

      const result = await createClothingItem(mockProfileId, {
        name: 'Verified shirt',
        category: 'Tops',
        price: '',
        owner_id: '99999999-9999-4999-8999-999999999999',
        id: '88888888-8888-4888-8888-888888888888',
        created_at: '2000-01-01T00:00:00.000Z'
      }, { from: fromFn });

      expect(result).toEqual(createdItem);
      expect(fromFn).toHaveBeenCalledWith('ootie_clothing_items');
      expect(insertFn).toHaveBeenCalledWith({
        name: 'Verified shirt',
        category: 'Tops',
        price: null,
        owner_id: mockProfileId
      });
    });

    it('does not create when the payload has no item name', async () => {
      const fromFn = vi.fn();

      await expect(createClothingItem(mockProfileId, { category: 'Tops' }, { from: fromFn }))
        .rejects.toMatchObject({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR });
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('rejects a decimal price because the existing schema only accepts bigint', async () => {
      const fromFn = vi.fn();

      await expect(createClothingItem(mockProfileId, { name: 'Fractional price', price: 99.5 }, { from: fromFn }))
        .rejects.toMatchObject({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR });
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('updates only the specified item owned by the verified profile and strips system fields', async () => {
      const updatedItem = { id: mockItemId, owner_id: mockProfileId, name: 'Updated shirt' };
      const maybeSingleFn = vi.fn().mockResolvedValue({ data: updatedItem, error: null });
      const selectFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const ownerEqFn = vi.fn().mockReturnValue({ select: selectFn });
      const itemEqFn = vi.fn().mockReturnValue({ eq: ownerEqFn });
      const updateFn = vi.fn().mockReturnValue({ eq: itemEqFn });
      const fromFn = vi.fn().mockReturnValue({ update: updateFn });

      const result = await updateClothingItem(mockProfileId, mockItemId, {
        name: 'Updated shirt',
        owner_id: '99999999-9999-4999-8999-999999999999',
        id: '88888888-8888-4888-8888-888888888888',
        created_at: '2000-01-01T00:00:00.000Z'
      }, { from: fromFn });

      expect(result).toEqual(updatedItem);
      expect(updateFn).toHaveBeenCalledWith({ name: 'Updated shirt' });
      expect(itemEqFn).toHaveBeenCalledWith('id', mockItemId);
      expect(ownerEqFn).toHaveBeenCalledWith('owner_id', mockProfileId);
    });

    it('reports NOT_FOUND when an owner-scoped update affects no row', async () => {
      const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const ownerEqFn = vi.fn().mockReturnValue({ select: selectFn });
      const itemEqFn = vi.fn().mockReturnValue({ eq: ownerEqFn });
      const updateFn = vi.fn().mockReturnValue({ eq: itemEqFn });
      const fromFn = vi.fn().mockReturnValue({ update: updateFn });

      await expect(updateClothingItem(mockProfileId, mockItemId, { name: 'No row' }, { from: fromFn }))
        .rejects.toMatchObject({ code: SERVICE_ERROR_CODE.NOT_FOUND });
      expect(ownerEqFn).toHaveBeenCalledWith('owner_id', mockProfileId);
    });

    it('deletes only the specified item owned by the verified profile', async () => {
      const maybeSingleFn = vi.fn().mockResolvedValue({ data: { id: mockItemId }, error: null });
      const selectFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const ownerEqFn = vi.fn().mockReturnValue({ select: selectFn });
      const itemEqFn = vi.fn().mockReturnValue({ eq: ownerEqFn });
      const deleteFn = vi.fn().mockReturnValue({ eq: itemEqFn });
      const fromFn = vi.fn().mockReturnValue({ delete: deleteFn });

      await expect(deleteClothingItem(mockProfileId, mockItemId, { from: fromFn })).resolves.toEqual({ id: mockItemId });
      expect(fromFn).toHaveBeenCalledWith('ootie_clothing_items');
      expect(itemEqFn).toHaveBeenCalledWith('id', mockItemId);
      expect(ownerEqFn).toHaveBeenCalledWith('owner_id', mockProfileId);
      expect(selectFn).toHaveBeenCalledWith('id');
    });

    it('normalizes a failed remote delete instead of accepting it as success', async () => {
      const maybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied', status: 403 }
      });
      const selectFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const ownerEqFn = vi.fn().mockReturnValue({ select: selectFn });
      const itemEqFn = vi.fn().mockReturnValue({ eq: ownerEqFn });
      const deleteFn = vi.fn().mockReturnValue({ eq: itemEqFn });
      const fromFn = vi.fn().mockReturnValue({ delete: deleteFn });

      await expect(deleteClothingItem(mockProfileId, mockItemId, { from: fromFn }))
        .rejects.toMatchObject({ code: SERVICE_ERROR_CODE.PERMISSION_DENIED });
    });
  });
});
