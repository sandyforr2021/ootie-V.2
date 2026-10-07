import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import LoginGate from '../LoginGate.vue';
import { useAppStore } from '@/stores/app';

describe('shared LoginGate', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('opens the existing Auth modal and preserves returnTo context', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/tryon', component: { template: '<div />' } }]
    });
    await router.push('/tryon');
    await router.isReady();
    const wrapper = mount(LoginGate, { global: { plugins: [router] } });
    const appStore = useAppStore();
    appStore.openLoginGate('TRYON_AUTH_REQUIRED', '/tryon');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('登入後使用虛擬試穿');
    await wrapper.find('.primary').trigger('click');
    const authStore = (await import('@/stores/auth')).useAuthStore();
    expect(authStore.isAuthModalOpen).toBe(true);
    expect(appStore.isLoginGateOpen).toBe(false);
    expect(authStore.authMode).toBe('login');
  });
});
