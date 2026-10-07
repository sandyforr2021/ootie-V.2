import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import TryonView from '../TryonView.vue';
import AiView from '../AiView.vue';
import ProfileView from '../ProfileView.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { IDENTITY_STATUS } from '@/services/identityResolver';

const makeRouter = (path) => createRouter({
  history: createMemoryHistory(),
  routes: [{ path, component: { template: '<div />' } }]
});

describe('Guest and Member feature gates', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('shows a locked Try-on state for Guest and opens Login Gate before use', async () => {
    const router = makeRouter('/tryon');
    await router.push('/tryon');
    await router.isReady();
    const wrapper = mount(TryonView, { global: { plugins: [router] } });
    const appStore = useAppStore();

    expect(wrapper.text()).toContain('登入後使用私人 AI 圖像功能');
    await wrapper.find('button').trigger('click');
    expect(appStore.isLoginGateOpen).toBe(true);
    expect(appStore.loginGateReason).toBe('TRYON_AUTH_REQUIRED');
  });

  it('keeps the existing Try-on page for a resolved Member', async () => {
    const authStore = useAuthStore();
    authStore.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = {
      status: IDENTITY_STATUS.PROFILE_READY,
      authUserId: authStore.user.id,
      profileId: '22222222-2222-4222-8222-222222222222',
      profile: { id: '22222222-2222-4222-8222-222222222222' },
      error: null
    };
    const router = makeRouter('/tryon');
    await router.push('/tryon');
    await router.isReady();
    const wrapper = mount(TryonView, { global: { plugins: [router] } });

    expect(wrapper.text()).toContain('生成試穿');
    expect(wrapper.text()).not.toContain('登入後使用私人 AI 圖像功能');
  });

  it('gates paid AI styling for Guest before any provider request', async () => {
    const router = makeRouter('/ai');
    await router.push('/ai');
    await router.isReady();
    const wrapper = mount(AiView, { global: { plugins: [router] } });
    const appStore = useAppStore();

    await wrapper.find('.member-gate button').trigger('click');
    await flushPromises();

    expect(appStore.isLoginGateOpen).toBe(true);
    expect(appStore.loginGateReason).toBe('AUTH_REQUIRED');
    expect(wrapper.text()).toContain('訪客不會觸發付費 AI Request');
  });

  it('gates the Guest own Profile while keeping public profile context available', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/profile', component: ProfileView },
        { path: '/explore', component: { template: '<div />' } },
        { path: '/ootd/:id', component: { template: '<div />' } }
      ]
    });
    await router.push('/profile');
    await router.isReady();
    const wrapper = mount(ProfileView, { global: { plugins: [router] } });
    const appStore = useAppStore();

    expect(wrapper.text()).toContain('登入後查看你的個人檔案');
    await wrapper.find('button').trigger('click');
    expect(appStore.loginGateReason).toBe('AUTH_REQUIRED');

    await router.push('/profile?user=%40minji');
    await flushPromises();
    expect(wrapper.text()).not.toContain('登入後查看你的個人檔案');
  });
});
