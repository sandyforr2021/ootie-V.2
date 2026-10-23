import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import AppBottomNav from '../AppBottomNav.vue';
import { useAppStore } from '@/stores/app';

const paths = ['/shop', '/', '/closet', '/explore', '/sos', '/bookmarks', '/stats', '/profile', '/ai', '/tryon', '/membership', '/settings'];
const routeNames = {
  '/shop': 'Shop',
  '/': 'Home',
  '/closet': 'Closet',
  '/explore': 'Explore',
  '/sos': 'Sos',
  '/bookmarks': 'Bookmarks',
  '/stats': 'Stats',
  '/profile': 'Profile',
  '/ai': 'Ai',
  '/tryon': 'Tryon',
  '/membership': 'Membership',
  '/settings': 'Settings'
};

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: paths.map((path) => ({ path, name: routeNames[path], component: { template: '<div />' } }))
});

const mountNav = async (path = '/') => {
  const router = makeRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(AppBottomNav, { global: { plugins: [router] } });
  return { router, wrapper };
};

describe('mobile navigation information architecture', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('keeps exactly four primary destinations plus More in the bottom bar', async () => {
    const { wrapper } = await mountNav();
    const nav = wrapper.find('nav.bottom-nav');
    expect(nav.findAll('a').map((link) => link.text())).toEqual(['首頁', '試穿', '探索', '衣櫥']);
    expect(nav.findAll('button')).toHaveLength(1);
    expect(nav.find('button').text()).toBe('更多');
  });

  it('shows only secondary destinations in More without repeating primary destinations', async () => {
    const { wrapper } = await mountNav();
    await wrapper.find('.mobile-more-trigger').trigger('click');

    const destinationLabels = wrapper.findAll('.mobile-more-destinations .mobile-more-link strong').map((item) => item.text());
    expect(destinationLabels).toEqual(['穿搭求救', '個人檔案', '衣櫥統計', '帳號設定', '通知']);
    for (const label of ['首頁', '探索', '衣櫥', 'SOS']) {
      expect(destinationLabels).not.toContain(label);
    }
  });

  it('limits Quick Add to the four real creation actions', async () => {
    const { wrapper } = await mountNav();
    await wrapper.find('.mobile-more-trigger').trigger('click');

    const labels = wrapper.findAll('.quick-action-item strong').map((item) => item.text());
    expect(labels).toEqual(['加入單品', '發布 OOTD', '發布求救', '收藏商品']);
    expect(wrapper.find('.quick-action-grid').text()).not.toContain('AI 助手');
    expect(wrapper.find('.quick-action-grid').text()).not.toContain('虛擬試穿');
  });

  it('routes to Style SOS from secondary navigation and closes the menu', async () => {
    const { router, wrapper } = await mountNav();
    await wrapper.find('.mobile-more-trigger').trigger('click');
    const aiLink = wrapper.findAll('.mobile-more-link').find((link) => link.text().includes('穿搭求救'));
    await aiLink.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/sos');
    expect(wrapper.find('.quick-action-menu').exists()).toBe(false);
  });

  it('opens the shared login gate before a guest can publish OOTD', async () => {
    const { wrapper } = await mountNav();
    await wrapper.find('.mobile-more-trigger').trigger('click');
    const publishButton = wrapper.findAll('.quick-action-item').find((button) => button.text().includes('發布 OOTD'));
    await publishButton.trigger('click');

    const appStore = useAppStore();
    expect(appStore.isLoginGateOpen).toBe(true);
    expect(appStore.loginGateReason).toBe('OOTD_PUBLISH_AUTH_REQUIRED');
    expect(appStore.loginGateReturnTo).toBe('/explore?quick=add-ootd');
    expect(appStore.isOotdFormOpen).toBe(false);
  });

  it('opens member authentication for guest notification access and supports Escape', async () => {
    const { wrapper } = await mountNav('/explore');
    await wrapper.find('.mobile-more-trigger').trigger('click');
    await wrapper.find('.mobile-more-action').trigger('click');
    expect(wrapper.find('.quick-action-menu').exists()).toBe(false);

    await wrapper.find('.mobile-more-trigger').trigger('click');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('.quick-action-menu').exists()).toBe(false);
  });
});
