import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import AppTopbar from '../AppTopbar.vue';
import { useAuthStore } from '@/stores/auth';

let wrapper;
describe('AppTopbar logout navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => {
    wrapper?.unmount();
    vi.restoreAllMocks();
  });

  it('returns to the public homepage after logging out from a member page', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<h1>Home</h1>' } },
        { path: '/closet', component: { template: '<h1>Closet</h1>' } }
      ]
    });
    await router.push('/closet');
    await router.isReady();
    const auth = useAuthStore();
    auth.initialized = true;
    auth.session = { user: { id: 'member-user' } };
    auth.user = auth.session.user;
    const logout = vi.spyOn(auth, 'logout').mockResolvedValue();

    wrapper = mount(AppTopbar, {
      global: {
        plugins: [router],
        mocks: { $t: key => key },
        stubs: { BrandMark: true, LanguageSelect: true, MediaImage: true }
      }
    });
    await wrapper.find('.account-trigger').trigger('click');
    await wrapper.find('.popover-actions button').trigger('click');
    await flushPromises();

    expect(logout).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.path).toBe('/');
  });
});
