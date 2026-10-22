import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useAppStore } from '../app';
import { STORAGE_KEY } from '@/constants';

describe('App Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('starts empty without fabricated identity, clothing or notifications', () => {
    const store = useAppStore();
    expect(store.items).toEqual([]);
    expect(store.profile.username).toBe('');
    expect(store.notifications).toEqual([]);
    expect(store.toastVisible).toBe(false);
  });

  it('shows the persisted nickname after a fresh profile load even when the legacy name differs', () => {
    const store = useAppStore();
    store.setMemberProfile({ name: 'Old name', display_name: 'Saved nickname', avatar_url: 'https://example.test/saved.webp' });
    expect(store.profile.name).toBe('Saved nickname');
    expect(store.profile.avatar_url).toBe('https://example.test/saved.webp');
  });

  it('should handle toast messages and auto-hide', () => {
    const store = useAppStore();
    store.showToast('Test Toast Notification');

    expect(store.toastMessage).toBe('Test Toast Notification');
    expect(store.toastVisible).toBe(true);

    vi.advanceTimersByTime(2300);
    expect(store.toastVisible).toBe(false);
  });

  it('should add notifications correctly', () => {
    const store = useAppStore();
    const initialCount = store.notifications.length;

    store.addNotification('Someone liked your outfit', 'explore');

    expect(store.notifications.length).toBe(initialCount + 1);
    expect(store.notifications[0].text).toBe('Someone liked your outfit');
    expect(store.notifications[0].read).toBe(false);
    expect(store.notifications[0].target).toBe('explore');
  });

  it('should toggle modal visibility states', () => {
    const store = useAppStore();

    expect(store.isItemFormOpen).toBe(false);
    store.isItemFormOpen = true;
    expect(store.isItemFormOpen).toBe(true);

    expect(store.isDetailOpen).toBe(false);
    store.selectedItemId = '1';
    store.isDetailOpen = true;
    expect(store.isDetailOpen).toBe(true);
    expect(store.selectedItemId).toBe('1');
  });

  it('persists the local closet snapshot while remote items are the active display source', async () => {
    const store = useAppStore();
    const localItems = JSON.parse(JSON.stringify(store.items));
    const remoteItems = [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      owner_id: '22222222-2222-4222-8222-222222222222',
      name: 'Remote only item'
    }];

    store.beginRemoteItems();
    store.items = remoteItems;
    await nextTick();

    expect(store.items).toEqual(remoteItems);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).items).toEqual(localItems);

    store.restoreLocalItems();
    expect(store.items).toEqual(localItems);
  });
});
