import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import ClosetView from '../ClosetView.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { IDENTITY_STATUS } from '@/services/identityResolver';
import * as clothingRepository from '@/services/clothingRepository';
import { ASYNC_STATUS } from '@/contracts/asyncState';
import { SERVICE_ERROR_CODE, ServiceError } from '@/services/serviceError';
import { GUEST_CLOSET_STORAGE_KEY } from '@/services/guestAccess';
import { defaultItems } from '@/constants';

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/closet', component: ClosetView }]
});

describe('ClosetView.vue Integration Test', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.setItem(GUEST_CLOSET_STORAGE_KEY, JSON.stringify([defaultItems[0]]));
    router.push('/closet');
    await router.isReady();
  });

  it('renders closet page title and item grid', () => {
    const wrapper = mount(ClosetView, {
      global: {
        plugins: [router]
      }
    });

    expect(wrapper.text()).toContain('我的衣櫥');
    expect(wrapper.find('.grid').exists()).toBe(true);
    expect(wrapper.findAll('.item-card').length).toBeGreaterThan(0);
  });

  it('filters items when category button is clicked', async () => {
    const wrapper = mount(ClosetView, {
      global: {
        plugins: [router]
      }
    });

    const categoryBtns = wrapper.findAll('.category');
    const topsBtn = categoryBtns.find((b) => b.text() === '上衣');

    await topsBtn.trigger('click');

    const cards = wrapper.findAll('.item-card');
    cards.forEach((card) => {
      expect(card.text()).toContain('上衣');
    });
  });

  it('opens item detail modal when an item image card is clicked', async () => {
    const appStore = useAppStore();
    const wrapper = mount(ClosetView, {
      global: {
        plugins: [router]
      }
    });

    const firstImageCard = wrapper.find('.item-image');
    await firstImageCard.trigger('click');

    expect(appStore.isDetailOpen).toBe(true);
    expect(appStore.selectedItemId).not.toBeNull();
  });

  it('triggers item form modal when add item button is clicked', async () => {
    const appStore = useAppStore();
    const wrapper = mount(ClosetView, {
      global: {
        plugins: [router]
      }
    });

    const addBtn = wrapper.find('.closet-header-add');
    await addBtn.trigger('click');

    expect(appStore.isItemFormOpen).toBe(true);
    expect(appStore.editingItemId).toBeNull();
  });

  describe('remote read runtime wiring', () => {
    const authUserId = '11111111-1111-4111-8111-111111111111';
    const profileId = '22222222-2222-4222-8222-222222222222';

    const setProfileReady = (authStore) => {
      authStore.session = { user: { id: authUserId } };
      authStore.profileIdentity = {
        status: IDENTITY_STATUS.PROFILE_READY,
        authUserId,
        profileId,
        profile: { id: profileId, user_id: authUserId },
        error: null
      };
    };

    it('loads remote items once for a signed-in user with a ready profile', async () => {
      const remoteItems = [{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        owner_id: profileId,
        name: 'Remote Blazer',
        name_zh: '遠端西裝外套',
        category: 'Outerwear',
        style: 'Minimal',
        season: 'All year'
      }];
      const readItems = vi.spyOn(clothingRepository, 'getCurrentUserItems').mockResolvedValue(remoteItems);
      const wrapper = mount(ClosetView, { global: { plugins: [router] } });
      const authStore = useAuthStore();

      setProfileReady(authStore);
      await flushPromises();
      authStore.profileIdentity = { ...authStore.profileIdentity };
      await flushPromises();

      expect(readItems).toHaveBeenCalledTimes(1);
      expect(readItems).toHaveBeenCalledWith(profileId);
      expect(useAppStore().items).toEqual(remoteItems);
      expect(wrapper.text()).toContain('遠端西裝外套');
    });

    it('keeps guest local mode without querying the repository or using demo data', async () => {
      const readItems = vi.spyOn(clothingRepository, 'getCurrentUserItems');
      const wrapper = mount(ClosetView, { global: { plugins: [router] } });

      await flushPromises();

      expect(readItems).not.toHaveBeenCalled();
      expect(wrapper.findAll('.item-card').length).toBeGreaterThan(0);
      expect(wrapper.text()).toContain('白色經典襯衫');
    });

    it('does not query clothing when the signed-in user has no OOTIE profile', async () => {
      const readItems = vi.spyOn(clothingRepository, 'getCurrentUserItems');
      const wrapper = mount(ClosetView, { global: { plugins: [router] } });
      const authStore = useAuthStore();
      authStore.session = { user: { id: authUserId } };
      authStore.profileIdentity = {
        status: IDENTITY_STATUS.PROFILE_MISSING,
        authUserId,
        profileId: null,
        profile: null,
        error: new Error('Profile missing')
      };

      await flushPromises();

      expect(readItems).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain('找不到 OOTIE 個人檔案');
      expect(wrapper.findAll('.item-card')).toHaveLength(0);
    });

    it('keeps an authoritative remote empty result empty instead of restoring fixture items', async () => {
      vi.spyOn(clothingRepository, 'getCurrentUserItems').mockResolvedValue([]);
      const wrapper = mount(ClosetView, { global: { plugins: [router] } });
      const authStore = useAuthStore();

      setProfileReady(authStore);
      await flushPromises();
      await flushPromises();

      expect(useAppStore().items).toEqual([]);
      expect(wrapper.text()).toContain('衣櫥目前沒有衣物');
      expect(wrapper.text()).not.toContain('太棒了！你的每件衣服都很常穿');
      expect(wrapper.findAll('.item-card')).toHaveLength(0);
    });

    it('shows remote failure instead of presenting demo items as a successful closet', async () => {
      vi.spyOn(clothingRepository, 'getCurrentUserItems').mockRejectedValue(new Error('offline'));
      const wrapper = mount(ClosetView, { global: { plugins: [router] } });
      const authStore = useAuthStore();

      setProfileReady(authStore);
      await flushPromises();

      expect(useClosetStore().remoteState.status).toBe(ASYNC_STATUS.ERROR);
      expect(wrapper.text()).toContain('遠端衣櫥載入失敗');
      expect(wrapper.findAll('.item-card')).toHaveLength(0);
    });

    it('shows a denied state for an RLS permission failure without falling back to demo items', async () => {
      vi.spyOn(clothingRepository, 'getCurrentUserItems').mockRejectedValue(
        new ServiceError(SERVICE_ERROR_CODE.PERMISSION_DENIED)
      );
      const wrapper = mount(ClosetView, { global: { plugins: [router] } });
      const authStore = useAuthStore();

      setProfileReady(authStore);
      await flushPromises();

      expect(useClosetStore().remoteState.status).toBe(ASYNC_STATUS.DENIED);
      expect(wrapper.text()).toContain('沒有權限讀取遠端衣櫥');
      expect(wrapper.findAll('.item-card')).toHaveLength(0);
    });
  });
});
