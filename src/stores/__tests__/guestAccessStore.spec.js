import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '../app';
import { useAuthStore } from '../auth';
import { useClosetStore } from '../closet';
import { GUEST_CLOSET_STORAGE_KEY } from '@/services/guestAccess';
import * as clothingRepository from '@/services/clothingRepository';

const item = (id) => ({
  id,
  owner_id: null,
  name: `Guest item ${id}`,
  name_zh: `訪客單品 ${id}`,
  category: 'Tops',
  primary_color: '白色',
  secondary_color: '無彩色系',
  style: 'Casual',
  season: 'All year',
  photo: 'data:image/png;base64,guest'
});

describe('Guest closet persistence and quota', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const startGuestCloset = () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();
    appStore.loadGuestItems();
    closetStore.useGuestItems();
    return { appStore, closetStore };
  };

  it('allows two items and blocks the third at the store layer', async () => {
    const { appStore, closetStore } = startGuestCloset();
    expect((await closetStore.addItem(item('guest-1'))).ok).toBe(true);
    expect((await closetStore.addItem(item('guest-2'))).ok).toBe(true);
    const third = await closetStore.addItem(item('guest-3'));

    expect(third.ok).toBe(false);
    expect(third.error.code).toBe('GUEST_CLOSET_LIMIT');
    expect(appStore.items).toHaveLength(2);
  });

  it('frees a slot after deletion and does not count edits as additions', async () => {
    const { appStore, closetStore } = startGuestCloset();
    await closetStore.addItem(item('guest-1'));
    await closetStore.addItem(item('guest-2'));
    const firstId = appStore.items[0].id;

    expect((await closetStore.updateItem(firstId, { name: 'Edited guest item' })).ok).toBe(true);
    expect(appStore.items).toHaveLength(2);
    vi.stubGlobal('confirm', vi.fn(() => true));
    expect((await closetStore.deleteItem(firstId)).ok).toBe(true);
    expect((await closetStore.addItem(item('guest-3'))).ok).toBe(true);
    expect(appStore.items).toHaveLength(2);
  });

  it('keeps guest items after a fresh store is created', async () => {
    const { closetStore } = startGuestCloset();
    await closetStore.addItem(item('guest-1'));

    setActivePinia(createPinia());
    const appStore = useAppStore();
    appStore.loadGuestItems();
    expect(JSON.parse(localStorage.getItem(GUEST_CLOSET_STORAGE_KEY))).toHaveLength(1);
    expect(appStore.items[0].name).toBe('Guest item guest-1');
  });

  it('keeps failed guest records when remote import is partial', async () => {
    const appStore = useAppStore();
    const authStore = useAuthStore();
    const guestItems = [item('guest-1'), item('guest-2')];
    localStorage.setItem(GUEST_CLOSET_STORAGE_KEY, JSON.stringify(guestItems));
    vi.spyOn(clothingRepository, 'createClothingItem')
      .mockResolvedValueOnce({ id: 'remote-1' })
      .mockRejectedValueOnce(new Error('offline'));

    appStore.prepareGuestImport('22222222-2222-4222-8222-222222222222');
    const result = await appStore.importGuestItems();

    expect(result.ok).toBe(false);
    expect(appStore.isGuestImportOpen).toBe(true);
    const remaining = JSON.parse(localStorage.getItem(GUEST_CLOSET_STORAGE_KEY));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('guest-2');
    expect(authStore.isGuest).toBe(true);
  });
});
