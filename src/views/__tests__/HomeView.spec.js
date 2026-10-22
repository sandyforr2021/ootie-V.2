import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../HomeView.vue';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { IDENTITY_STATUS } from '@/services/identityResolver';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Home', component: HomeView },
    { path: '/closet', component: { template: '<div>Closet</div>' } },
    { path: '/shop', component: { template: '<div>Shop</div>' } },
    { path: '/sos', component: { template: '<div>SOS</div>' } },
    { path: '/explore', component: { template: '<div>Explore</div>' } },
    { path: '/ai', component: { template: '<div>AI</div>' } },
    { path: '/tryon', component: { template: '<div>Tryon</div>' } },
    { path: '/membership', component: { template: '<div>Membership</div>' } },
    { path: '/ootd/:id', name: 'OotdDetail', component: { template: '<div>Post</div>' } }
  ]
});

describe('HomeView guest/member presentation', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await router.push('/');
    await router.isReady();
  });

  it('shows working entry points without invented community activity', () => {
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    expect(wrapper.text()).toContain('買之前，');
    expect(wrapper.text()).toContain('先穿進自己的生活。');
    expect(wrapper.text()).toContain('開始購物試穿');
    expect(wrapper.findAll('.trending-card')).toHaveLength(0);
    expect(wrapper.find('.hero-photo img').attributes('src')).toBe('/assets/ootie-home-hero-v2-1024.webp');
    expect(wrapper.find('.hero-photo img').attributes('fetchpriority')).toBe('high');
    expect(wrapper.find('a[href="/shop?tab=album"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/shop?tab=community"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/closet?quick=add-item"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('switches to the utility dashboard for a resolved member', async () => {
    const auth = useAuthStore();
    const app = useAppStore();
    auth.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    auth.user = auth.session.user;
    auth.profileIdentity = { status: IDENTITY_STATUS.PROFILE_READY, authUserId: auth.user.id, profileId: '22222222-2222-4222-8222-222222222222', profile: { id: '22222222-2222-4222-8222-222222222222' }, error: null };
    app.setMemberProfile({ id: auth.profileId, name: 'OOTIE Demo', username: '@ootie_demo' });
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.text()).toContain('歡迎回來， OOTIE');
    expect(wrapper.find('a[href="/closet?quick=add-item"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/membership"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('取得 AI 穿搭建議');
    wrapper.unmount();
  });
});
